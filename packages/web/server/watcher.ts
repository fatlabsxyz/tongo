/**
 * Long-running watcher: polls Starknet RPC for incoming STRK transfers to the
 * service hot wallet. When a deposit is detected, matches it to the oldest
 * pending fund request with that exact amount and calls
 *   outside_fund(tongoPubKey, tongoAmount)
 * from the service wallet (auto-deploying it first if needed).
 *
 * Run with: pnpm watcher
 */
import "./env";
import { RpcProvider, Contract, num, hash as snHash, type Call, CallData, uint256 } from "starknet";
import { NETWORKS, type NetworkConfig, type NetworkId } from "../src/lib/networks";
import { getServiceWalletKey, getServiceAccount, isServiceWalletDeployed, deployServiceWallet } from "../src/lib/service-wallet";
import { listPendingFundRequests, updateFundRequest, type FundRequest } from "./db";

const POLL_INTERVAL_MS = 10_000;
const TRANSFER_EVENT_KEY = snHash.getSelectorFromName("Transfer");
const NETWORKS_TO_WATCH: NetworkId[] = ["sepolia", "mainnet"];

const TONGO_ABI_MIN = [
  { name: "get_rate", type: "function", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
] as const;

interface ChainCursor {
  lastProcessedBlock: number;
}
const cursors = new Map<NetworkId, ChainCursor>();

async function getRate(network: NetworkConfig, provider: RpcProvider): Promise<bigint> {
  const tongo = new Contract({ abi: TONGO_ABI_MIN as never, address: network.tongoAddress, providerOrAccount: provider });
  const r = await tongo.get_rate();
  return BigInt(r.toString());
}

function felt(addr: string): string {
  return num.toHex(num.toBigInt(addr));
}

async function fetchIncomingTransfers(
  provider: RpcProvider,
  network: NetworkConfig,
  to: string,
  fromBlock: number,
  toBlock: number,
): Promise<Array<{ from: string; amount: bigint; txHash: string; block: number }>> {
  const toFelt = felt(to);
  // Poll Transfer events on the Tongo's underlying ERC20 (STRK on sepolia, USDC on mainnet).
  const strkFelt = felt(network.underlyingErc20);
  const events: Array<{ from: string; amount: bigint; txHash: string; block: number }> = [];
  let continuationToken: string | undefined;
  do {
    const res = await provider.getEvents({
      from_block: { block_number: fromBlock },
      to_block: { block_number: toBlock },
      address: strkFelt,
      // Transfer(from, to, value). On Starknet, indexed args go into `keys` (after selector).
      // Many ERC20s only index the event selector, leaving from/to as data. We'll filter client-side.
      keys: [[TRANSFER_EVENT_KEY]],
      chunk_size: 50,
      continuation_token: continuationToken,
    });
    for (const ev of res.events) {
      // Decode whatever format STRK uses on Sepolia (keys[1]=from, keys[2]=to, data=[u256 low, u256 high])
      // Fallback: data layout = [from, to, amount_low, amount_high]
      let fromAddr: string | null = null;
      let toAddr: string | null = null;
      let amount: bigint = 0n;
      if (ev.keys.length >= 3) {
        fromAddr = num.toHex(num.toBigInt(ev.keys[1]!));
        toAddr = num.toHex(num.toBigInt(ev.keys[2]!));
        const lo = BigInt(ev.data[0]!);
        const hi = BigInt(ev.data[1] ?? "0x0");
        amount = lo + (hi << 128n);
      } else if (ev.data.length >= 4) {
        fromAddr = num.toHex(num.toBigInt(ev.data[0]!));
        toAddr = num.toHex(num.toBigInt(ev.data[1]!));
        const lo = BigInt(ev.data[2]!);
        const hi = BigInt(ev.data[3] ?? "0x0");
        amount = lo + (hi << 128n);
      }
      if (!toAddr) continue;
      if (num.toBigInt(toAddr) !== num.toBigInt(toFelt)) continue;
      events.push({
        from: fromAddr ?? "",
        amount,
        txHash: ev.transaction_hash,
        block: ev.block_number ?? 0,
      });
    }
    continuationToken = res.continuation_token;
  } while (continuationToken);
  return events;
}

async function ensureDeployed(network: NetworkConfig): Promise<void> {
  const deployed = await isServiceWalletDeployed(network);
  if (deployed) return;
  console.log(`[${network.id}] service wallet not deployed, deploying…`);
  const { transactionHash } = await deployServiceWallet(network);
  console.log(`[${network.id}] deploy tx: ${transactionHash}`);
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  await provider.waitForTransaction(transactionHash, { retryInterval: 2000 });
  console.log(`[${network.id}] service wallet deployed ✓`);
}

async function processRequest(network: NetworkConfig, req: FundRequest, deposit: { txHash: string; amount: bigint }): Promise<void> {
  try {
    if (!network.tongoDeployed) {
      throw new Error(`Tongo not deployed on ${network.id} yet — deposit detected but cannot credit`);
    }
    await ensureDeployed(network);
    const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
    const rate = await getRate(network, provider);
    // Floor division: deposit (in underlying-wei) → Tongos. Dust (<1 Tongo)
    // stays in the service wallet; safer than failing on rounding errors from
    // LayerSwap fees.
    const tongoAmount = deposit.amount / rate;
    if (tongoAmount === 0n) {
      throw new Error(`deposit ${deposit.amount} too small for rate ${rate}`);
    }

    await updateFundRequest(req.id, { status: "funding", detectedDepositTxHash: deposit.txHash });

    const account = getServiceAccount(network);
    const tongoPk = { x: req.tongoPubKey.x, y: req.tongoPubKey.y };

    // Approve exactly tongoAmount * rate (the amount the Tongo contract will
    // pull via transferFrom). The leftover dust (if any) remains in the
    // service wallet.
    const approveAmount = tongoAmount * rate;
    const approve: Call = {
      contractAddress: network.underlyingErc20,
      entrypoint: "approve",
      calldata: CallData.compile({ spender: network.tongoAddress, amount: uint256.bnToUint256(approveAmount) }),
    };
    const outsideFund: Call = {
      contractAddress: network.tongoAddress,
      entrypoint: "outside_fund",
      calldata: CallData.compile([{ to: tongoPk, amount: tongoAmount }]),
    };
    const { transaction_hash } = await account.execute([approve, outsideFund]);
    console.log(`[${network.id}] outside_fund tx: ${transaction_hash} (${tongoAmount} Tongos for req ${req.id})`);
    await provider.waitForTransaction(transaction_hash, { retryInterval: 2000 });

    await updateFundRequest(req.id, {
      status: "completed",
      fundTxHash: transaction_hash,
      fundedAmountStrk: deposit.amount.toString(),
      fundedAmountTongo: tongoAmount.toString(),
    });
    console.log(`[${network.id}] req ${req.id} completed ✓`);
  } catch (e) {
    console.error(`[${network.id}] req ${req.id} failed:`, e);
    await updateFundRequest(req.id, { status: "failed", error: (e as Error).message });
  }
}

async function tick(networkId: NetworkId) {
  const network = NETWORKS[networkId];
  if (!network.enabled) return;
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  const head = await provider.getBlockNumber();
  let cursor = cursors.get(networkId);
  if (!cursor) {
    cursor = { lastProcessedBlock: Math.max(0, head - 50) };
    cursors.set(networkId, cursor);
  }
  if (head < cursor.lastProcessedBlock) return;

  const pendings = await listPendingFundRequests(networkId);
  if (pendings.length === 0) {
    cursor.lastProcessedBlock = head;
    return;
  }

  const { address: depositAddress } = getServiceWalletKey();
  const transfers = await fetchIncomingTransfers(provider, network, depositAddress, cursor.lastProcessedBlock, head);

  for (const t of transfers) {
    // FIFO match with 0.5% tolerance. LayerSwap (and similar bridges) may
    // deliver slightly different wei than quoted due to slippage/fee rounding,
    // so an exact match is too brittle. We pick the oldest awaiting_deposit
    // request whose expected amount is within the tolerance window AND prefer
    // the closest match to handle multiple concurrent requests.
    const reqs = await listPendingFundRequests(networkId);
    const candidates = reqs
      .filter((r) => r.status === "awaiting_deposit")
      .map((r) => {
        const expected = BigInt(r.requestedAmountStrk);
        // 0.5% tolerance both directions; floor to 1 wei minimum.
        const tol = expected / 200n || 1n;
        const within = t.amount >= expected - tol && t.amount <= expected + tol;
        const drift = t.amount > expected ? t.amount - expected : expected - t.amount;
        return { r, within, drift };
      })
      .filter((c) => c.within)
      .sort((a, b) => {
        // Closest drift first, then oldest.
        if (a.drift !== b.drift) return a.drift < b.drift ? -1 : 1;
        return a.r.createdAt - b.r.createdAt;
      });
    const match = candidates[0]?.r;
    if (!match) {
      console.log(`[${networkId}] unmatched deposit ${t.txHash} amount=${t.amount} (no pending request within tolerance)`);
      continue;
    }
    console.log(`[${networkId}] matched deposit ${t.txHash} (${t.amount} vs req ${match.requestedAmountStrk}) → req ${match.id}`);
    await processRequest(network, match, { txHash: t.txHash, amount: t.amount });
  }

  cursor.lastProcessedBlock = head;
}

async function main() {
  const { address } = getServiceWalletKey();
  console.log(`Watcher started.`);
  console.log(`Service wallet: ${address}`);
  console.log(`Networks: ${NETWORKS_TO_WATCH.join(", ")}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Initial deploy check
  for (const id of NETWORKS_TO_WATCH) {
    const network = NETWORKS[id];
    if (!network.enabled) continue;
    const deployed = await isServiceWalletDeployed(network);
    console.log(`[${id}] service wallet deployed: ${deployed}`);
  }

  // Main loop
  while (true) {
    for (const id of NETWORKS_TO_WATCH) {
      try { await tick(id); }
      catch (e) { console.error(`[${id}] tick error:`, e); }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
