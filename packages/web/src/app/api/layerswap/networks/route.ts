/**
 * Proxy to LayerSwap's networks list. We filter source networks that can
 * route to STARKNET_MAINNET with STRK (so funds land on our service wallet).
 */
import { NextResponse } from "next/server";

interface LSToken { symbol: string; logo?: string; decimals: number; price_in_usd?: number }
interface LSNetwork { name: string; display_name: string; logo?: string; tokens: LSToken[]; type?: string }

export async function GET() {
  try {
    const res = await fetch("https://api.layerswap.io/api/v2/networks", { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `LayerSwap networks: ${res.status}` }, { status: 502 });
    }
    const { data } = (await res.json()) as { data: LSNetwork[] };
    // Keep popular source networks that have STRK or ETH (so we can bridge to STARKNET_MAINNET).
    const PREFERRED = ["ETHEREUM_MAINNET", "BASE_MAINNET", "ARBITRUM_MAINNET", "OPTIMISM_MAINNET", "POLYGON_MAINNET", "BSC_MAINNET", "SCROLL_MAINNET"];
    const filtered = data
      .filter((n) => n.name !== "STARKNET_MAINNET")
      .filter((n) => n.tokens.some((t) => t.symbol === "ETH" || t.symbol === "STRK" || t.symbol === "USDC"))
      .sort((a, b) => {
        const ai = PREFERRED.indexOf(a.name);
        const bi = PREFERRED.indexOf(b.name);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.display_name.localeCompare(b.display_name);
      });
    return NextResponse.json({ networks: filtered });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
