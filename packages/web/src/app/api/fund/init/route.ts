import { NextResponse } from "next/server";
import { createFundRequest } from "../../../../../server/db";
import { getServiceWalletKey } from "@/lib/service-wallet";
import { NETWORKS, type NetworkId } from "@/lib/networks";

interface Body {
  network: NetworkId;
  tongoPubKey: { x: string; y: string };
  tongoAddress: string;
  requestedAmountStrk: string;
  bridge?: {
    provider: "layerswap" | "manual";
    swapId?: string;
    fromChain?: string;
    fromAsset?: string;
  };
}

function validate(b: unknown): b is Body {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  if (x.network !== "sepolia" && x.network !== "mainnet") return false;
  if (typeof x.tongoAddress !== "string") return false;
  if (typeof x.requestedAmountStrk !== "string" || !/^\d+$/.test(x.requestedAmountStrk)) return false;
  if (!x.tongoPubKey || typeof x.tongoPubKey !== "object") return false;
  const pk = x.tongoPubKey as Record<string, unknown>;
  if (typeof pk.x !== "string" || typeof pk.y !== "string") return false;
  return true;
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!validate(body)) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const network = NETWORKS[body.network];
  if (!network.enabled) return NextResponse.json({ error: `network ${body.network} not enabled` }, { status: 400 });

  const { address: depositAddress } = getServiceWalletKey();
  const r = await createFundRequest({
    network: body.network,
    tongoPubKey: body.tongoPubKey,
    tongoAddress: body.tongoAddress,
    requestedAmountStrk: body.requestedAmountStrk,
    depositAddress,
    bridge: body.bridge,
  });
  return NextResponse.json({ request: r });
}
