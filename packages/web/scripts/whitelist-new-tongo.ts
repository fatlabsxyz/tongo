/**
 * Re-whitelist the new Tongo (deployed via Vault) on the existing Relayer.
 * Run: pnpm exec tsx scripts/whitelist-new-tongo.ts
 */
import "../server/env";
import { Account, RpcProvider, Contract } from "starknet";
import { getServiceWalletKey } from "../src/lib/service-wallet";
import { NETWORKS } from "../src/lib/networks";

const RELAYER = process.env.NEXT_PUBLIC_MAINNET_RELAYER_ADDRESS!;
const NEW_TONGO = process.env.NEXT_PUBLIC_MAINNET_TONGO_ADDRESS!;

async function main() {
  const { pk, address } = getServiceWalletKey();
  const network = NETWORKS.mainnet;
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  const account = new Account({
    provider, address, signer: pk, cairoVersion: "1", transactionVersion: "0x3",
  });
  console.log("Relayer:   ", RELAYER);
  console.log("New Tongo: ", NEW_TONGO);

  const RELAYER_ABI = [
    { name: "whitelist_target", type: "function",
      inputs: [{ name: "target", type: "core::starknet::contract_address::ContractAddress" }],
      outputs: [], state_mutability: "external" },
  ] as const;
  const relayer = new Contract({ abi: RELAYER_ABI as never, address: RELAYER, providerOrAccount: account });

  console.log("Whitelisting new Tongo as target on Relayer…");
  const tx = await relayer.whitelist_target(NEW_TONGO);
  console.log("  tx:", tx.transaction_hash);
  await provider.waitForTransaction(tx.transaction_hash, { retryInterval: 2000 });
  console.log("Done ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
