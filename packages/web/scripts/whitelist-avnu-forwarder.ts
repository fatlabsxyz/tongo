/**
 * Whitelists the actual AVNU paymaster forwarder on the existing Relayer.
 * Run after observing the `Caller` field in a failed paymaster_executeTransaction
 * response. The hardcoded guess in deploy-relayer-mainnet.ts was wrong — the
 * real forwarder showed up as 0x127021a1...
 *
 * Run: pnpm exec tsx scripts/whitelist-avnu-forwarder.ts
 */
import "../server/env";
import { Account, RpcProvider, Contract } from "starknet";
import { getServiceWalletKey } from "../src/lib/service-wallet";
import { NETWORKS } from "../src/lib/networks";

const RELAYER = process.env.NEXT_PUBLIC_MAINNET_RELAYER_ADDRESS!;
const AVNU_FORWARDER = "0x127021a1b5a52d3174c2ab077c2b043c80369250d29428cee956d76ee51584f";

const RELAYER_ABI = [
  { name: "whitelist_forwarder", type: "function",
    inputs: [{ name: "forwarder", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [], state_mutability: "external" },
  { name: "is_forwarder_whitelisted", type: "function",
    inputs: [{ name: "forwarder", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::bool" }], state_mutability: "view" },
] as const;

async function main() {
  const { pk, address } = getServiceWalletKey();
  const network = NETWORKS.mainnet;
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  const account = new Account({ provider, address, signer: pk, cairoVersion: "1", transactionVersion: "0x3" });

  console.log("Relayer:        ", RELAYER);
  console.log("AVNU forwarder: ", AVNU_FORWARDER);
  console.log();

  const relayer = new Contract({ abi: RELAYER_ABI as never, address: RELAYER, providerOrAccount: account });

  const already = await relayer.is_forwarder_whitelisted(AVNU_FORWARDER);
  if (already) {
    console.log("Already whitelisted");
    return;
  }

  console.log("Whitelisting…");
  const tx = await relayer.whitelist_forwarder(AVNU_FORWARDER);
  console.log("  tx:", tx.transaction_hash);
  await provider.waitForTransaction(tx.transaction_hash, { retryInterval: 2000 });

  const after = await relayer.is_forwarder_whitelisted(AVNU_FORWARDER);
  console.log(`Verified: ${after ? "OK" : "FAILED"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
