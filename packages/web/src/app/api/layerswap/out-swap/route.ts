/**
 * Cross-chain WITHDRAW: source is hardcoded to STARKNET_MAINNET/USDC; the
 * client picks destination_network + destination_address (the user's address
 * on their target chain). LayerSwap returns a per-swap deposit address on
 * Starknet, which the frontend uses as the `to` for Tongo.withdraw — the
 * Relayer then dispatches USDC from the Vault to that LS deposit address, and
 * LayerSwap auto-bridges to the user's chain.
 *
 * The companion API for the FUND direction is /api/layerswap/swap.
 */
import { NextResponse } from "next/server";

interface Body {
  destination_network: string;
  destination_token: string;
  destination_address: string;
  amount: number;
  reference_id?: string;
}

function validate(b: unknown): b is Body {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  if (typeof x.destination_network !== "string") return false;
  if (typeof x.destination_token !== "string") return false;
  if (typeof x.destination_address !== "string") return false;
  if (typeof x.amount !== "number" || !(x.amount > 0)) return false;
  return true;
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!validate(body)) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  try {
    // For Starknet outbound, LayerSwap rejects use_deposit_address:true with
    // "Preparing transaction failed". Instead it uses a watchdog contract that
    // identifies the swap via a sequence_number call. The deposit_actions[]
    // entry's call_data carries both the asset transfer AND the watch call;
    // they need to be executed atomically by the depositor (our service wallet
    // — see /api/layerswap/relay-deposit).
    const res = await fetch("https://api.layerswap.io/api/v2/swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_network: "STARKNET_MAINNET",
        source_token: "USDC",
        destination_network: body.destination_network,
        destination_token: body.destination_token,
        destination_address: body.destination_address,
        amount: body.amount,
        reference_id: body.reference_id,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: "layerswap rejected", detail: json }, { status: 502 });
    }
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const res = await fetch(`https://api.layerswap.io/api/v2/swaps/${id}`);
    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: "layerswap rejected", detail: json }, { status: 502 });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
