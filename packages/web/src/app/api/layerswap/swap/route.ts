/**
 * Creates a LayerSwap v2 swap. Destination is fixed to our mainnet service
 * wallet (the deposit address the watcher polls).
 *
 * Returns the swap object including deposit_actions[] so the UI can show
 * "send N <token> to <deposit_address>".
 */
import { NextResponse } from "next/server";
import { getServiceWalletKey } from "@/lib/service-wallet";

interface Body {
  source_network: string;
  source_token: string;
  amount: number;
  reference_id?: string;
}

function validate(b: unknown): b is Body {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  if (typeof x.source_network !== "string") return false;
  if (typeof x.source_token !== "string") return false;
  if (typeof x.amount !== "number" || !(x.amount > 0)) return false;
  return true;
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!validate(body)) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { address: destination } = getServiceWalletKey();

  try {
    const res = await fetch("https://api.layerswap.io/api/v2/swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_network: body.source_network,
        source_token: body.source_token,
        destination_network: "STARKNET_MAINNET",
        // USDC matches the Tongo mainnet ERC20 so the watcher can call
        // outside_fund directly with the received amount.
        destination_token: "USDC",
        destination_address: destination,
        amount: body.amount,
        reference_id: body.reference_id,
        // Force per-swap deposit address: without this, LayerSwap returns a
        // shared address with a 32-byte memo appended to call_data that plain
        // wallets/QRs don't include, so swaps never get attributed.
        use_deposit_address: true,
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
  // Lookup an existing swap by id (?id=...)
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
