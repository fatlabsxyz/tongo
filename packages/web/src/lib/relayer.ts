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
 * Flat relay fee charged by the Relayer per outside_execution call, in Tongos.
 * In USDC wei this is fee * rate (rate=1000 → 1 Tongo = 1000 wei = 0.001 USDC).
 *
 * Hidden from the user UI: the Relayer needs fee > 0 (contract assertion) and
 * `fee * rate >= sum(asset_calls)` to balance. Estimating gas dynamically would
 * be cleaner but for the demo we keep it constant. If gas spikes the Relayer
 * subsidizes — that's intentional for the demo since the relay fee is far
 * below the actual paymaster gas cost.
 */
export const DEFAULT_RELAY_FEE_TONGOS = 1n;

interface RelayArgsBase {
  account: TongoAccount;
  tongoPk: bigint;
  feeToSender?: bigint;
  network: NetworkConfig;
}

export async function relayTransfer(args: RelayArgsBase & { to: PubKey; amount: bigint }): Promise<{ transactionHash: string }> {
  const fee = args.feeToSender ?? DEFAULT_RELAY_FEE_TONGOS;
  const tongoNonce = await args.account.nonce();
  const op = await args.account.transfer({
    amount: args.amount,
    to: args.to,
    sender: args.network.relayerAddress,
    fee_to_sender: fee,
  });
  return relayViaPaymaster(
    { call: op.toCalldata(), pubkey: args.account.publicKey, tongoNonce, tongoPk: args.tongoPk },
    args.network,
  );
}

export async function relayWithdraw(args: RelayArgsBase & { to: string; amount: bigint }): Promise<{ transactionHash: string }> {
  const fee = args.feeToSender ?? DEFAULT_RELAY_FEE_TONGOS;
  const tongoNonce = await args.account.nonce();
  const op = await args.account.withdraw({
    amount: args.amount,
    to: args.to,
    sender: args.network.relayerAddress,
    fee_to_sender: fee,
  });
  return relayViaPaymaster(
    { call: op.toCalldata(), pubkey: args.account.publicKey, tongoNonce, tongoPk: args.tongoPk },
    args.network,
  );
}

export async function relayRagequit(args: RelayArgsBase & { to: string }): Promise<{ transactionHash: string }> {
  const fee = args.feeToSender ?? DEFAULT_RELAY_FEE_TONGOS;
  const tongoNonce = await args.account.nonce();
  const op = await args.account.ragequit({
    to: args.to,
    sender: args.network.relayerAddress,
    fee_to_sender: fee,
  });
  return relayViaPaymaster(
    { call: op.toCalldata(), pubkey: args.account.publicKey, tongoNonce, tongoPk: args.tongoPk },
    args.network,
  );
}
