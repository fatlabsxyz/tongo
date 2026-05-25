/**
 * Whitelist native USDC as asset + the new Tongo as target on the existing
 * mainnet Relayer. Forwarders (AVNU + service wallet) were already whitelisted
 * on the original Relayer deploy, so we don't repeat them.
 *
 * Run: pnpm exec tsx scripts/whitelist-native-usdc-and-tongo.ts
 */
import "../server/env";
import { Account, RpcProvider, Contract } from "starknet";
import { getServiceWalletKey } from "../src/lib/service-wallet";
import { NETWORKS } from "../src/lib/networks";

const RELAYER = process.env.NEXT_PUBLIC_MAINNET_RELAYER_ADDRESS!;
const NATIVE_USDC = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS!;
const NEW_TONGO = process.env.NEXT_PUBLIC_MAINNET_TONGO_ADDRESS!;

const RELAYER_ABI = [
  { name: "whitelist_asset", type: "function",
    inputs: [{ name: "asset", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [], state_mutability: "external" },
  { name: "whitelist_target", type: "function",
    inputs: [{ name: "target", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [], state_mutability: "external" },
] as const;

async function main() {
  const { pk, address } = getServiceWalletKey();
  const network = NETWORKS.mainnet;
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  const account = new Account({
    provider, address, signer: pk, cairoVersion: "1", transactionVersion: "0x3",
  });

  console.log("Relayer:    ", RELAYER);
  console.log("USDC native:", NATIVE_USDC);
  console.log("New Tongo:  ", NEW_TONGO);
  console.log();

  const relayer = new Contract({ abi: RELAYER_ABI as never, address: RELAYER, providerOrAccount: account });

  console.log("Whitelisting native USDC as asset…");
  const wlAsset = await relayer.whitelist_asset(NATIVE_USDC);
  console.log("  tx:", wlAsset.transaction_hash);
  await provider.waitForTransaction(wlAsset.transaction_hash, { retryInterval: 2000 });

  console.log("Whitelisting new Tongo as target…");
  const wlTarget = await relayer.whitelist_target(NEW_TONGO);
  console.log("  tx:", wlTarget.transaction_hash);
  await provider.waitForTransaction(wlTarget.transaction_hash, { retryInterval: 2000 });

  console.log("\nDone ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
