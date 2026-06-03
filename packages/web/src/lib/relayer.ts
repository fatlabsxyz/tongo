/**
 * AVNU paymaster + Relayer contract flow.
 *
 * - sepolia: Relayer contract has signature verification bypassed; we send
 *   ["0x1","0x1"] as the signature. AVNU pays gas in STRK.
 * - mainnet: Relayer enforces real ECDSA over the OutsideExecution typed data,
 *   signed by the Tongo private key (the same one that produced the proof).
 *   AVNU pays gas in USDC because Tongo wraps USDC and the Relayer's
 *   `compare_and_set_asset` requires the asset to match the Tongo's ERC20.
 */
import { Account, PaymasterRpc, num, typedData as td, ec, type PaymasterDetails, type Call, type TypedData } from "starknet";
import { poseidonHashMany } from "@scure/starknet";
import type { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
import type { PubKey } from "@fatsolutions/tongo-sdk";
import type { NetworkConfig } from "./networks";
import { getProvider } from "./tongo-client";

function computeRelayNonce(pubkey: PubKey, tongoNonce: bigint): string {
  return num.toHex(poseidonHashMany([BigInt(pubkey.x), BigInt(pubkey.y), tongoNonce]));
}

/** AVNU paymaster gas token. Must equal the Tongo's underlying ERC20 because
 *  the Relayer's compare_and_set_asset requires all calls to touch the same
 *  asset (Tongo's fee accrual is in Tongo's ERC20 wei units). */
function pickGasToken(network: NetworkConfig): string {
  if (network.id === "mainnet") {
    return process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS
      || "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
  }
  // sepolia Tongo wraps STRK
  return network.strkAddress;
}

function buildSignature(
  network: NetworkConfig,
  tongoPk: bigint,
  typedData: TypedData,
): string[] {
  if (network.id === "sepolia") {
    // Sepolia Relayer has sig verification bypassed.
    return ["0x1", "0x1"];
  }
  // Mainnet: compute typed-data hash with the Relayer contract address as the
  // signer scope, then sign with the user's Tongo pk.
  const hash = td.getMessageHash(typedData, network.relayerAddress);
  const pkHex = "0x" + tongoPk.toString(16);
  const sig = ec.starkCurve.sign(hash, pkHex);
  return [num.toHex(sig.r), num.toHex(sig.s)];
}

interface RelayInput {
  call: Call;
  pubkey: PubKey;
  tongoNonce: bigint;
  tongoPk: bigint;
}

export async function relayViaPaymaster(
  input: RelayInput,
  network: NetworkConfig,
): Promise<{ transactionHash: string }> {
  const provider = getProvider(network);
  const paymaster = new PaymasterRpc({ nodeUrl: network.paymasterUrl });

  const relayer = new Account({
    provider,
    address: network.relayerAddress,
    signer: "0x0000000000000000000000000000000000000000000000000000000000000001",
    paymaster,
    cairoVersion: "1",
    transactionVersion: "0x3",
  });

  const gasToken = pickGasToken(network);
  const feesDetails: PaymasterDetails = {
    feeMode: { mode: "default", gasToken },
  };

  const relayNonce = computeRelayNonce(input.pubkey, input.tongoNonce);

  const prepared = (await relayer.buildPaymasterTransaction([input.call], feesDetails)) as unknown as {
    typed_data: TypedData;
    parameters: unknown;
  };

  const typedData: TypedData = {
    ...prepared.typed_data,
    message: { ...prepared.typed_data.message, Nonce: relayNonce },
  };

  const signature = buildSignature(network, input.tongoPk, typedData);

  const paymasterAny = (relayer as unknown as { paymaster: { executeTransaction: (a: unknown, b: unknown) => Promise<{ transaction_hash: string }> } }).paymaster;
  const res = await paymasterAny.executeTransaction(
    {
      type: "invoke",
      invoke: {
        userAddress: relayer.address,
        typedData,
        signature,
      },
    },
    prepared.parameters,
  );

  return { transactionHash: res.transaction_hash };
}

/**
 * UI-side reservation budget for the dynamic relay fee. The actual amount
 * charged is computed per-tx by estimateSafeFeeTongos(), which queries the
 * paymaster for the live AVNU gas cost and applies a small safety multiplier.
 *
 * Empirically AVNU charges ~67-100k USDC wei (0.067-0.1 USDC) per Relayer
 * call on mainnet, which after the 1.5x safety multiplier comes out to
 * ~100-150 Tongos. 150 gives MAX a tight but realistic reservation so the
 * "send everything" UX doesn't strand 0.15+ USDC of headroom.
 */
export const DEFAULT_RELAY_FEE_TONGOS = 150n;

/** Multiplier applied to the live paymaster gas estimate. AVNU returns the
 *  exact amount it wants right now; the only gap we hedge against is gas
 *  drift between the estimate and the submit a couple of seconds later.
 *  1.5x is plenty for that window and keeps user-visible fees close to the
 *  true on-chain cost (relayer margin ~33%). Bigger buffers were observable
 *  on Voyager as "way less than 0.3 USD" txs paying 0.2 USDC — pure waste. */
const FEE_SAFETY_NUMERATOR = 15n;
const FEE_SAFETY_DENOMINATOR = 10n;

interface PreparedTypedData {
  typed_data: TypedData;
  parameters: unknown;
}

/**
 * Runs buildPaymasterTransaction with a placeholder call to learn how much
 * USDC (in wei) AVNU intends to deduct for gas. The returned amount is taken
 * from the LAST call in the prepared OutsideExecution — that's the asset
 * transfer to the forwarder which the Relayer also sees and validates against
 * `fee_to_sender * rate`.
 */
async function estimateAvnuAmountInWei(network: NetworkConfig, placeholderCall: Call): Promise<bigint> {
  const provider = getProvider(network);
  const paymaster = new PaymasterRpc({ nodeUrl: network.paymasterUrl });
  const relayer = new Account({
    provider, address: network.relayerAddress,
    signer: "0x1", paymaster, cairoVersion: "1", transactionVersion: "0x3",
  });
  const feesDetails: PaymasterDetails = {
    feeMode: { mode: "default", gasToken: pickGasToken(network) },
  };
  const prepared = (await relayer.buildPaymasterTransaction([placeholderCall], feesDetails)) as unknown as PreparedTypedData;
  const message = prepared.typed_data.message as { Calls?: Array<{ To: string; Selector: string; Calldata: string[] }> };
  const calls = message.Calls ?? [];
  if (calls.length === 0) throw new Error("paymaster returned empty Calls");
  // Asset transfer is the last call. Calldata layout: [recipient, low, high].
  const assetCall = calls[calls.length - 1]!;
  const lo = BigInt(assetCall.Calldata[1] ?? "0x0");
  const hi = BigInt(assetCall.Calldata[2] ?? "0x0");
  return lo + (hi << 128n);
}

/**
 * Estimates a safe fee_to_sender (in Tongos) by querying the paymaster once
 * with a placeholder op, ceiling-dividing the resulting wei by the Tongo rate,
 * then adding a buffer. Always returns at least 1 (contract asserts fee > 0).
 */
async function estimateSafeFeeTongos(network: NetworkConfig, placeholderCall: Call): Promise<bigint> {
  const wei = await estimateAvnuAmountInWei(network, placeholderCall);
  const requiredTongos = (wei + network.tongoRate - 1n) / network.tongoRate;
  const safe = (requiredTongos * FEE_SAFETY_NUMERATOR) / FEE_SAFETY_DENOMINATOR + 1n;
  console.log(`[relayer] avnu wants ${wei} wei → ${requiredTongos} tongos → safe fee ${safe}`);
  return safe < 1n ? 1n : safe;
}

interface RelayArgsBase {
  account: TongoAccount;
  tongoPk: bigint;
  /** Override the estimated fee. Mostly for tests. */
  feeToSender?: bigint;
  network: NetworkConfig;
}

export async function relayTransfer(args: RelayArgsBase & { to: PubKey; amount: bigint }): Promise<{ transactionHash: string }> {
  const tongoNonce = await args.account.nonce();
  // Build a placeholder op (fee=1) just to discover how much USDC AVNU wants.
  const placeholderOp = await args.account.transfer({
    amount: args.amount, to: args.to,
    sender: args.network.relayerAddress, fee_to_sender: 1n,
  });
  const fee = args.feeToSender ?? await estimateSafeFeeTongos(args.network, placeholderOp.toCalldata());
  const op = await args.account.transfer({
    amount: args.amount, to: args.to,
    sender: args.network.relayerAddress, fee_to_sender: fee,
  });
  return relayViaPaymaster(
    { call: op.toCalldata(), pubkey: args.account.publicKey, tongoNonce, tongoPk: args.tongoPk },
    args.network,
  );
}

export async function relayWithdraw(args: RelayArgsBase & { to: string; amount: bigint }): Promise<{ transactionHash: string }> {
  const tongoNonce = await args.account.nonce();
  const placeholderOp = await args.account.withdraw({
    amount: args.amount, to: args.to,
    sender: args.network.relayerAddress, fee_to_sender: 1n,
  });
  const fee = args.feeToSender ?? await estimateSafeFeeTongos(args.network, placeholderOp.toCalldata());
  const op = await args.account.withdraw({
    amount: args.amount, to: args.to,
    sender: args.network.relayerAddress, fee_to_sender: fee,
  });
  return relayViaPaymaster(
    { call: op.toCalldata(), pubkey: args.account.publicKey, tongoNonce, tongoPk: args.tongoPk },
    args.network,
  );
}

export async function relayRagequit(args: RelayArgsBase & { to: string }): Promise<{ transactionHash: string }> {
  const tongoNonce = await args.account.nonce();
  const placeholderOp = await args.account.ragequit({
    to: args.to, sender: args.network.relayerAddress, fee_to_sender: 1n,
  });
  const fee = args.feeToSender ?? await estimateSafeFeeTongos(args.network, placeholderOp.toCalldata());
  const op = await args.account.ragequit({
    to: args.to, sender: args.network.relayerAddress, fee_to_sender: fee,
  });
  return relayViaPaymaster(
    { call: op.toCalldata(), pubkey: args.account.publicKey, tongoNonce, tongoPk: args.tongoPk },
    args.network,
  );
}
