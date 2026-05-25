import { NextResponse } from "next/server";
import { getServiceWalletKey, isServiceWalletDeployed } from "@/lib/service-wallet";
import { NETWORKS, type NetworkId } from "@/lib/networks";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const networkId = (url.searchParams.get("network") || "sepolia") as NetworkId;
  const network = NETWORKS[networkId];
  if (!network) return NextResponse.json({ error: "unknown network" }, { status: 400 });

  const { address, pubKey } = getServiceWalletKey();
  let deployed = false;
  try { deployed = await isServiceWalletDeployed(network); } catch {}

  return NextResponse.json({
    network: network.id,
    address,
    pubKey,
    deployed,
    note: deployed
      ? "Service wallet is deployed and ready to relay outside_fund / rollover."
      : "Service wallet is precomputed. Fund it with STRK + ETH on Sepolia, then it auto-deploys on first send.",
  });
}
