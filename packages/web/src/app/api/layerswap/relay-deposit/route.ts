/**
 * Service-wallet relay for outbound LayerSwap deposits.
 *
 * Starknet→other-chain swaps use a shared deposit address + a watchdog
 * contract call that identifies the swap (sequence_number). Both calls must
 * land in the same tx so LayerSwap can correlate the deposit. Our Tongo
 * withdraw can only emit a single ERC20 transfer, so we route in two hops:
 *
 *   1. user does Tongo.withdraw → service wallet on Starknet (frontend)
 *   2. this endpoint: service wallet executes the LS-provided call_data
 *      ([USDC.transfer(LS_address, amount), watchdog.watch(seq)])
 *
 * Then LayerSwap detects + bridges to the user's destination chain.
 */
import { NextResponse } from "next/server";
import type { Call } from "starknet";
import { num } from "starknet";
import { getServiceAccount, isServiceWalletDeployed } from "@/lib/service-wallet";
import { NETWORKS } from "@/lib/networks";

interface Body {
  swap_id: string;
}

function validate(b: unknown): b is Body {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  return typeof x.swap_id === "string" && x.swap_id.length > 0;
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!validate(body)) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const network = NETWORKS.mainnet;
  if (!network.enabled) return NextResponse.json({ error: "mainnet not enabled" }, { status: 400 });

  try {
    // Fetch the swap so we get fresh call_data from LayerSwap. We don't trust
    // any call_data the client might supply — LS is the source of truth.
    const lsRes = await fetch(`https://api.layerswap.io/api/v2/swaps/${body.swap_id}`);
    const lsJson = await lsRes.json();
    if (!lsRes.ok) return NextResponse.json({ error: "layerswap rejected", detail: lsJson }, { status: 502 });

    const swap = lsJson?.data?.swap;
    const action = lsJson?.data?.deposit_actions?.[0];
    if (!swap || !action || typeof action.call_data !== "string") {
      return NextResponse.json({ error: "no deposit action on swap" }, { status: 400 });
    }

    // Defensive: only proceed if LS sees the swap as awaiting our deposit.
    if (swap.status && swap.status !== "user_transfer_pending" && swap.status !== "created") {
      return NextResponse.json({ error: `swap status is ${swap.status}, not awaiting deposit` }, { status: 400 });
    }

    let calls: Call[];
    try {
      calls = JSON.parse(action.call_data);
    } catch {
      return NextResponse.json({ error: "could not parse layerswap call_data" }, { status: 502 });
    }
    if (!Array.isArray(calls) || calls.length === 0) {
      return NextResponse.json({ error: "layerswap call_data is empty" }, { status: 502 });
    }
    // The first call must be an ERC20 transfer of our underlying USDC. This is
    // a sanity check so a malicious / mis-shaped LS response can't drain the
    // service wallet to an arbitrary token.
    const usdcBn = num.toBigInt(network.underlyingErc20);
    const firstAddr = (calls[0] as Call).contractAddress;
    if (!firstAddr || num.toBigInt(firstAddr) !== usdcBn) {
      return NextResponse.json({ error: "layerswap first call is not USDC" }, { status: 502 });
    }

    if (!(await isServiceWalletDeployed(network))) {
      return NextResponse.json({ error: "service wallet not deployed" }, { status: 500 });
    }
    const account = getServiceAccount(network);
    const { transaction_hash } = await account.execute(calls);
    return NextResponse.json({ transactionHash: transaction_hash });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
