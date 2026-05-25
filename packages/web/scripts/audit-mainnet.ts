/**
 * Read-only audit script: verifies the on-chain state of the mainnet deployment
 * matches what the app expects.
 *
 * Run: pnpm exec tsx scripts/audit-mainnet.ts
 */
import "../server/env";
import { RpcProvider, Contract, num, hash as snHash } from "starknet";
import { NETWORKS } from "../src/lib/networks";

const SERVICE_WALLET = process.env.SERVICE_WALLET_ADDRESS!;
const USDC = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS!;
const TONGO = process.env.NEXT_PUBLIC_MAINNET_TONGO_ADDRESS!;
const VAULT = process.env.NEXT_PUBLIC_MAINNET_VAULT_ADDRESS!;
const RELAYER = process.env.NEXT_PUBLIC_MAINNET_RELAYER_ADDRESS!;
const AVNU_FWD = process.env.AVNU_MAINNET_FORWARDER || "0x07ad48bbb1a18d2b97cf3eebf41bb6166fd6d61d4ad6da7ec45f3df2cb71cad9";

const TONGO_ABI = [
  { name: "get_vault", type: "function", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { name: "ERC20", type: "function", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { name: "get_rate", type: "function", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { name: "get_bit_size", type: "function", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { name: "get_owner", type: "function", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { name: "get_tag", type: "function", inputs: [], outputs: [{ type: "core::felt252" }], state_mutability: "view" },
] as const;

const VAULT_ABI = [
  { name: "ERC20", type: "function", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { name: "get_rate", type: "function", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { name: "get_bit_size", type: "function", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { name: "get_tongo_class_hash", type: "function", inputs: [], outputs: [{ type: "core::starknet::class_hash::ClassHash" }], state_mutability: "view" },
  { name: "is_known_tongo", type: "function", inputs: [{ name: "address", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
] as const;

const RELAYER_ABI = [
  { name: "get_owner", type: "function", inputs: [], outputs: [{ type: "core::starknet::contract_address::ContractAddress" }], state_mutability: "view" },
  { name: "is_target_whitelisted", type: "function", inputs: [{ name: "target", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
  { name: "is_asset_whitelisted", type: "function", inputs: [{ name: "asset", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
  { name: "is_forwarder_whitelisted", type: "function", inputs: [{ name: "forwarder", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
  { name: "get_tongo_selectors", type: "function", inputs: [], outputs: [{ type: "core::array::Span::<core::felt252>" }], state_mutability: "view" },
  { name: "get_asset_selectors", type: "function", inputs: [], outputs: [{ type: "core::array::Span::<core::felt252>" }], state_mutability: "view" },
  {
    type: "struct", name: "tongo::relayer::structs::TargetConfig",
    members: [
      { name: "erc20", type: "core::starknet::contract_address::ContractAddress" },
      { name: "rate", type: "core::integer::u256" },
    ],
  },
  { name: "get_target_config", type: "function", inputs: [{ name: "target", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "tongo::relayer::structs::TargetConfig" }], state_mutability: "view" },
] as const;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { name: "allowance", type: "function", inputs: [{ name: "owner", type: "core::starknet::contract_address::ContractAddress" }, { name: "spender", type: "core::starknet::contract_address::ContractAddress" }], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { name: "symbol", type: "function", inputs: [], outputs: [{ type: "core::felt252" }], state_mutability: "view" },
  { name: "decimals", type: "function", inputs: [], outputs: [{ type: "core::integer::u8" }], state_mutability: "view" },
] as const;

const eqAddr = (a: string, b: string) => num.toBigInt(a) === num.toBigInt(b);
const fmt = (label: string, ok: boolean, actual?: string, expected?: string) => {
  const tag = ok ? "OK  " : "FAIL";
  if (actual !== undefined && !ok) return `[${tag}] ${label} actual=${actual} expected=${expected}`;
  return `[${tag}] ${label}${actual !== undefined ? ` = ${actual}` : ""}`;
};

async function main() {
  const network = NETWORKS.mainnet;
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });

  console.log("=== mainnet on-chain audit ===");
  console.log("Service wallet:", SERVICE_WALLET);
  console.log("USDC:          ", USDC);
  console.log("Vault:         ", VAULT);
  console.log("Tongo:         ", TONGO);
  console.log("Relayer:       ", RELAYER);
  console.log("AVNU forwarder:", AVNU_FWD);
  console.log();
  let issues = 0;
  const fail = () => { issues++; };

  // ---- Tongo ----
  console.log("--- Tongo ---");
  const tongo = new Contract({ abi: TONGO_ABI as never, address: TONGO, providerOrAccount: provider });
  const tongoVault = num.toHex(await tongo.get_vault());
  console.log(fmt("get_vault == VAULT", eqAddr(tongoVault, VAULT), tongoVault, VAULT));
  if (!eqAddr(tongoVault, VAULT)) fail();
  const tongoErc20 = num.toHex(await tongo.ERC20());
  console.log(fmt("ERC20 == USDC", eqAddr(tongoErc20, USDC), tongoErc20, USDC));
  if (!eqAddr(tongoErc20, USDC)) fail();
  const tongoRate = BigInt((await tongo.get_rate()).toString());
  console.log(fmt(`get_rate == 1000`, tongoRate === 1000n, tongoRate.toString(), "1000"));
  if (tongoRate !== 1000n) fail();
  const tongoBs = Number(await tongo.get_bit_size());
  console.log(fmt(`get_bit_size == 32`, tongoBs === 32, String(tongoBs), "32"));
  if (tongoBs !== 32) fail();
  const tongoOwner = num.toHex(await tongo.get_owner());
  console.log(fmt(`get_owner == service wallet`, eqAddr(tongoOwner, SERVICE_WALLET), tongoOwner, SERVICE_WALLET));
  if (!eqAddr(tongoOwner, SERVICE_WALLET)) fail();
  const tongoTag = num.toHex(await tongo.get_tag());
  console.log(`[INFO] tag(hex) = ${tongoTag}`);

  // ---- Vault ----
  console.log("\n--- Vault ---");
  const vault = new Contract({ abi: VAULT_ABI as never, address: VAULT, providerOrAccount: provider });
  const vaultErc20 = num.toHex(await vault.ERC20());
  console.log(fmt("ERC20 == USDC", eqAddr(vaultErc20, USDC), vaultErc20, USDC));
  if (!eqAddr(vaultErc20, USDC)) fail();
  const vaultRate = BigInt((await vault.get_rate()).toString());
  console.log(fmt("get_rate == 1000", vaultRate === 1000n, vaultRate.toString(), "1000"));
  if (vaultRate !== 1000n) fail();
  const vaultBs = Number(await vault.get_bit_size());
  console.log(fmt("get_bit_size == 32", vaultBs === 32, String(vaultBs), "32"));
  if (vaultBs !== 32) fail();
  const vaultClass = num.toHex(await vault.get_tongo_class_hash());
  console.log(`[INFO] tongo_class_hash = ${vaultClass}`);
  const isKnown = await vault.is_known_tongo(TONGO);
  console.log(fmt(`is_known_tongo(TONGO) == true`, !!isKnown, String(!!isKnown), "true"));
  if (!isKnown) fail();

  // ---- Relayer ----
  console.log("\n--- Relayer ---");
  const relayer = new Contract({ abi: RELAYER_ABI as never, address: RELAYER, providerOrAccount: provider });
  const relayOwner = num.toHex(await relayer.get_owner());
  console.log(fmt("get_owner == service wallet", eqAddr(relayOwner, SERVICE_WALLET), relayOwner, SERVICE_WALLET));
  if (!eqAddr(relayOwner, SERVICE_WALLET)) fail();
  const tgtWl = await relayer.is_target_whitelisted(TONGO);
  console.log(fmt("is_target_whitelisted(TONGO) == true", !!tgtWl, String(!!tgtWl), "true"));
  if (!tgtWl) fail();
  const astWl = await relayer.is_asset_whitelisted(USDC);
  console.log(fmt("is_asset_whitelisted(USDC) == true", !!astWl, String(!!astWl), "true"));
  if (!astWl) fail();
  const avnuFwdWl = await relayer.is_forwarder_whitelisted(AVNU_FWD);
  console.log(fmt("is_forwarder_whitelisted(AVNU_FWD) == true", !!avnuFwdWl, String(!!avnuFwdWl), "true"));
  if (!avnuFwdWl) fail();
  const selfFwdWl = await relayer.is_forwarder_whitelisted(SERVICE_WALLET);
  console.log(fmt("is_forwarder_whitelisted(SERVICE_WALLET) == true", !!selfFwdWl, String(!!selfFwdWl), "true (fallback)"));
  if (!selfFwdWl) fail();

  const targetCfg = await relayer.get_target_config(TONGO) as { erc20: bigint; rate: bigint };
  const cfgErc20 = num.toHex(targetCfg.erc20);
  const cfgRate = BigInt(targetCfg.rate.toString());
  console.log(fmt("target_config.erc20 == USDC", eqAddr(cfgErc20, USDC), cfgErc20, USDC));
  if (!eqAddr(cfgErc20, USDC)) fail();
  console.log(fmt("target_config.rate == 1000", cfgRate === 1000n, cfgRate.toString(), "1000"));
  if (cfgRate !== 1000n) fail();

  // Selector whitelist
  const tongoSel = await relayer.get_tongo_selectors() as bigint[];
  const tongoSelHex = tongoSel.map((s) => num.toHex(s));
  const expectTongoSel = ["withdraw", "ragequit", "transfer"].map((n) => snHash.getSelectorFromName(n));
  const tongoSelMatch =
    tongoSelHex.length === expectTongoSel.length &&
    expectTongoSel.every((s) => tongoSelHex.some((t) => eqAddr(t, s)));
  console.log(fmt("tongo_selectors == [withdraw,ragequit,transfer]", tongoSelMatch, tongoSelHex.join(","), expectTongoSel.join(",")));
  if (!tongoSelMatch) fail();
  const assetSel = await relayer.get_asset_selectors() as bigint[];
  const assetSelHex = assetSel.map((s) => num.toHex(s));
  const expectAssetSel = ["transfer"].map((n) => snHash.getSelectorFromName(n));
  const assetSelMatch = assetSelHex.length === 1 && eqAddr(assetSelHex[0], expectAssetSel[0]);
  console.log(fmt("asset_selectors == [transfer]", assetSelMatch, assetSelHex.join(","), expectAssetSel.join(",")));
  if (!assetSelMatch) fail();

  // ---- Liveness ----
  console.log("\n--- Liveness ---");
  const usdc = new Contract({ abi: ERC20_ABI as never, address: USDC, providerOrAccount: provider });
  const symF = await usdc.symbol();
  let symbolStr = "";
  try { symbolStr = num.toBigInt(symF).toString(16); symbolStr = Buffer.from(symbolStr, "hex").toString(); } catch {}
  console.log(`[INFO] USDC symbol = ${symbolStr}`);
  const decimals = Number(await usdc.decimals());
  console.log(`[INFO] USDC decimals = ${decimals}`);
  const swBal = BigInt((await usdc.balanceOf(SERVICE_WALLET)).toString());
  console.log(`[INFO] service wallet USDC balance = ${swBal} wei (${Number(swBal) / 10 ** decimals} USDC)`);
  const tongoBal = BigInt((await usdc.balanceOf(TONGO)).toString());
  console.log(`[INFO] Tongo USDC balance = ${tongoBal} wei`);
  const vaultBal = BigInt((await usdc.balanceOf(VAULT)).toString());
  console.log(`[INFO] Vault USDC balance = ${vaultBal} wei (this is where deposited USDC sits)`);
  const relayerBal = BigInt((await usdc.balanceOf(RELAYER)).toString());
  console.log(`[INFO] Relayer USDC balance = ${relayerBal} wei`);

  // Tongo->Vault allowance (set in Tongo constructor)
  const tongoVaultAllow = BigInt((await usdc.allowance(TONGO, VAULT)).toString());
  console.log(`[INFO] allowance(Tongo -> Vault) = ${tongoVaultAllow} (should be u256::MAX)`);
  const MAX = (1n << 256n) - 1n;
  console.log(fmt("Tongo->Vault allowance == MAX", tongoVaultAllow === MAX, String(tongoVaultAllow === MAX), "true"));
  if (tongoVaultAllow !== MAX) fail();

  // Class hash check
  try {
    const ch = await provider.getClassHashAt(SERVICE_WALLET);
    console.log(`[INFO] service wallet class hash = ${ch}`);
  } catch {
    console.log(`[WARN] service wallet not deployed`);
    fail();
  }

  console.log(`\n=== ${issues === 0 ? "AUDIT PASSED ✓" : `AUDIT FAILED with ${issues} issue(s) ✗`} ===`);
  process.exit(issues === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
