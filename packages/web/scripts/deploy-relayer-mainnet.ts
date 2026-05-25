/**
 * Declares and deploys the Tongo Relayer contract on Starknet Mainnet.
 * Then whitelists USDC as asset + Tongo as target + AVNU forwarder.
 *
 * Run: pnpm exec tsx scripts/deploy-relayer-mainnet.ts
 */
import "../server/env";
import fs from "fs";
import path from "path";
import { Account, RpcProvider, CallData, json, Contract } from "starknet";
import { getServiceWalletKey } from "../src/lib/service-wallet";
import { NETWORKS } from "../src/lib/networks";

const RELAYER_OWNER = process.env.SERVICE_WALLET_ADDRESS!;
const USDC = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS!;
const TONGO = process.env.NEXT_PUBLIC_MAINNET_TONGO_ADDRESS!;
const STRK = process.env.NEXT_PUBLIC_MAINNET_STRK_ADDRESS!;
// AVNU mainnet forwarder — same logical role as the sepolia one. If the actual
// address differs we'll override via env later.
const AVNU_MAINNET_FORWARDER =
  process.env.AVNU_MAINNET_FORWARDER ||
  "0x07ad48bbb1a18d2b97cf3eebf41bb6166fd6d61d4ad6da7ec45f3df2cb71cad9";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const RELEASE_DIR = path.join(REPO_ROOT, "packages/contracts/target/release");

function loadJson(p: string) {
  return json.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const { pk, address } = getServiceWalletKey();
  const network = NETWORKS.mainnet;
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  const account = new Account({
    provider, address, signer: pk, cairoVersion: "1", transactionVersion: "0x3",
  });

  console.log("Account:           ", address);
  console.log("Relayer owner:     ", RELAYER_OWNER);
  console.log("USDC mainnet:      ", USDC);
  console.log("Tongo mainnet:     ", TONGO);
  console.log("AVNU forwarder:    ", AVNU_MAINNET_FORWARDER);
  console.log();

  const sierra = loadJson(path.join(RELEASE_DIR, "tongo_Relayer.contract_class.json"));
  const casm = loadJson(path.join(RELEASE_DIR, "tongo_Relayer.compiled_contract_class.json"));

  console.log("Declaring + deploying Relayer…");
  const res = await account.declareAndDeploy({
    contract: sierra,
    casm,
    constructorCalldata: CallData.compile({ owner: RELAYER_OWNER }),
  });
  const relayerAddress = res.deploy.contract_address;
  const relayerClassHash = res.declare.class_hash;
  console.log("  declared:", relayerClassHash);
  console.log("  deployed:", relayerAddress);
  console.log("  tx (deploy):", res.deploy.transaction_hash);

  await provider.waitForTransaction(res.deploy.transaction_hash, { retryInterval: 2000 });
  console.log("Relayer confirmed.\n");

  // Whitelist USDC + Tongo + Forwarder
  // Note: contract address fetched after deploy. Build an inline minimal interface.
  const RELAYER_ABI_MIN = [
    { name: "whitelist_asset", type: "function",
      inputs: [{ name: "asset", type: "core::starknet::contract_address::ContractAddress" }],
      outputs: [], state_mutability: "external" },
    { name: "whitelist_target", type: "function",
      inputs: [{ name: "target", type: "core::starknet::contract_address::ContractAddress" }],
      outputs: [], state_mutability: "external" },
    { name: "whitelist_forwarder", type: "function",
      inputs: [{ name: "forwarder", type: "core::starknet::contract_address::ContractAddress" }],
      outputs: [], state_mutability: "external" },
  ] as const;
  const relayer = new Contract({ abi: RELAYER_ABI_MIN as never, address: relayerAddress, providerOrAccount: account });

  console.log("Whitelisting USDC as asset…");
  const wlAsset = await relayer.whitelist_asset(USDC);
  console.log("  tx:", wlAsset.transaction_hash);
  await provider.waitForTransaction(wlAsset.transaction_hash, { retryInterval: 2000 });

  console.log("Whitelisting Tongo as target…");
  const wlTarget = await relayer.whitelist_target(TONGO);
  console.log("  tx:", wlTarget.transaction_hash);
  await provider.waitForTransaction(wlTarget.transaction_hash, { retryInterval: 2000 });

  console.log("Whitelisting AVNU forwarder (best-effort guess)…");
  const wlFwd = await relayer.whitelist_forwarder(AVNU_MAINNET_FORWARDER);
  console.log("  tx:", wlFwd.transaction_hash);
  await provider.waitForTransaction(wlFwd.transaction_hash, { retryInterval: 2000 });

  console.log("Whitelisting service wallet as forwarder (fallback path)…");
  const wlSelfFwd = await relayer.whitelist_forwarder(address);
  console.log("  tx:", wlSelfFwd.transaction_hash);
  await provider.waitForTransaction(wlSelfFwd.transaction_hash, { retryInterval: 2000 });

  console.log("\nAll done ✓");
  console.log("Add to .env.local:");
  console.log(`  NEXT_PUBLIC_MAINNET_RELAYER_ADDRESS=${relayerAddress}`);
  console.log(`  NEXT_PUBLIC_MAINNET_RELAYER_CLASS_HASH=${relayerClassHash}`);

  // Acknowledge unused vars (lint)
  void STRK;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
