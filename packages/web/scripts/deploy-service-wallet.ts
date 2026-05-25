/**
 * Deploys the service hot wallet derived from SERVICE_WALLET_SEEDPHRASE.
 * Requires the precomputed address to already hold STRK + ETH for deployment fee.
 *
 * Run: pnpm exec tsx scripts/deploy-service-wallet.ts [sepolia|mainnet]
 */
import "../server/env";
import { RpcProvider } from "starknet";
import { NETWORKS, type NetworkId } from "../src/lib/networks";
import { deployServiceWallet, getServiceWalletKey, isServiceWalletDeployed } from "../src/lib/service-wallet";

async function main() {
  const networkId = (process.argv[2] || "sepolia") as NetworkId;
  const network = NETWORKS[networkId];
  if (!network) throw new Error(`Unknown network: ${networkId}`);
  if (!network.enabled) throw new Error(`Network ${networkId} not enabled (missing env config)`);

  const { address, pubKey } = getServiceWalletKey();
  console.log(`Network:  ${network.label}`);
  console.log(`Address:  ${address}`);
  console.log(`Pub key:  ${pubKey}`);

  const deployed = await isServiceWalletDeployed(network);
  if (deployed) {
    console.log(`\nService wallet already deployed on ${networkId}. Nothing to do.`);
    return;
  }

  console.log(`\nDeploying…`);
  const { transactionHash } = await deployServiceWallet(network);
  console.log(`Deploy tx: ${transactionHash}`);

  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  console.log(`Waiting for confirmation…`);
  await provider.waitForTransaction(transactionHash, { retryInterval: 2000 });
  console.log(`Deployed ✓`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
