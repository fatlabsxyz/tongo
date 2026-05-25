/**
 * Receives a prepared Tongo Call from the client (rollover only, currently)
 * and forwards it through the service hot wallet.
 *
 * SECURITY: this endpoint must NEVER accept arbitrary calls. The service
 * wallet holds funds and is reused across users. We restrict to:
 *   - target = configured Tongo contract for the current network
 *   - selector in an explicit allowlist (currently: rollover)
 *   - max one call per request
 */
import { NextResponse } from "next/server";
import { Call, RpcProvider, hash, num } from "starknet";
import { getServiceAccount, isServiceWalletDeployed, deployServiceWallet } from "@/lib/service-wallet";
import { NETWORKS, type NetworkId } from "@/lib/networks";

interface Body {
  network: NetworkId;
  calls: Call[];
}

function validate(b: unknown): b is Body {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  if (x.network !== "sepolia" && x.network !== "mainnet") return false;
  if (!Array.isArray(x.calls) || x.calls.length === 0 || x.calls.length > 1) return false;
  for (const c of x.calls) {
    if (!c || typeof c !== "object") return false;
    const cc = c as Record<string, unknown>;
    if (typeof cc.contractAddress !== "string") return false;
    if (typeof cc.entrypoint !== "string") return false;
  }
  return true;
}

const ALLOWED_ENTRYPOINTS = new Set(["rollover"]);
const ROLLOVER_SELECTOR = hash.getSelectorFromName("rollover");

function selectorOf(call: Call): string {
  // starknet.js accepts either an entrypoint name or a raw selector; normalize.
  if (call.entrypoint.startsWith("0x")) return num.toHex(num.toBigInt(call.entrypoint));
  return hash.getSelectorFromName(call.entrypoint);
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!validate(body)) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const network = NETWORKS[body.network];
  if (!network.enabled) return NextResponse.json({ error: `network ${body.network} not enabled` }, { status: 400 });

  // Enforce that every call targets the Tongo contract for the chosen network
  // AND uses an allowlisted selector. This prevents abuse where a caller could
  // drain the service wallet by submitting an erc20.transfer.
  const tongoAddrBN = num.toBigInt(network.tongoAddress);
  for (const call of body.calls) {
    if (num.toBigInt(call.contractAddress) !== tongoAddrBN) {
      return NextResponse.json({ error: "call target must be the Tongo contract" }, { status: 400 });
    }
    const sel = selectorOf(call);
    if (num.toBigInt(sel) !== num.toBigInt(ROLLOVER_SELECTOR)) {
      return NextResponse.json({ error: "selector not allowed" }, { status: 400 });
    }
    if (!ALLOWED_ENTRYPOINTS.has(call.entrypoint) && !call.entrypoint.startsWith("0x")) {
      return NextResponse.json({ error: "entrypoint not allowed" }, { status: 400 });
    }
  }

  try {
    if (!(await isServiceWalletDeployed(network))) {
      const deploy = await deployServiceWallet(network);
      const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
      await provider.waitForTransaction(deploy.transactionHash, { retryInterval: 2000 });
    }
    const account = getServiceAccount(network);
    const res = await account.execute(body.calls);
    return NextResponse.json({ transactionHash: res.transaction_hash });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
