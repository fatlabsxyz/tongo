/**
 * Deploys a Vault on Starknet Mainnet for USDC, then uses the Vault to deploy
 * a Tongo instance. The Tongo's `vault` storage will point to the Vault, so
 * outside_fund/withdraw/ragequit (which call `_vault().deposit/withdraw`)
 * will route through the real Vault.
 *
 * Tongo class hash was already declared during the standalone Tongo deploy
 * (0x72c8d230...).
 *
 * Run: pnpm exec tsx scripts/deploy-vault-mainnet.ts
 */
import "../server/env";
import fs from "fs";
import path from "path";
import { Account, RpcProvider, CallData, Contract, json, num, uint256, CairoOption, CairoOptionVariant } from "starknet";
import { getServiceWalletKey } from "../src/lib/service-wallet";
import { NETWORKS } from "../src/lib/networks";

const USDC = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS!;
const TONGO_CLASS_HASH = "0x72c8d230e602d92c2818acace1365e5f341dbc2b9096467ae1744a211f878c8";
const RATE = BigInt(process.env.TONGO_RATE || "1000");
const BIT_SIZE = Number(process.env.TONGO_BIT_SIZE || "32");
const TAG = process.env.TONGO_TAG || "tongo_v2_usdc";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const RELEASE_DIR = path.join(REPO_ROOT, "packages/contracts/target/release");

function loadJson(p: string) { return json.parse(fs.readFileSync(p, "utf8")); }

async function main() {
  const { pk, address } = getServiceWalletKey();
  const network = NETWORKS.mainnet;
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  const account = new Account({
    provider, address, signer: pk, cairoVersion: "1", transactionVersion: "0x3",
  });

  console.log("Account:         ", address);
  console.log("USDC:            ", USDC);
  console.log("Rate:            ", RATE.toString());
  console.log("Bit size:        ", BIT_SIZE);
  console.log("Tongo class hash:", TONGO_CLASS_HASH);
  console.log("Tag:             ", TAG);
  console.log();

  const vaultSierra = loadJson(path.join(RELEASE_DIR, "tongo_Vault.contract_class.json"));
  const vaultCasm = loadJson(path.join(RELEASE_DIR, "tongo_Vault.compiled_contract_class.json"));

  console.log("Declaring + deploying Vault…");
  const rate256 = uint256.bnToUint256(RATE);
  const ctorCalldata = CallData.compile({
    ERC20: USDC,
    rate: rate256,
    bit_size: BIT_SIZE,
    tongo_class: TONGO_CLASS_HASH,
  });
  const res = await account.declareAndDeploy({
    contract: vaultSierra,
    casm: vaultCasm,
    constructorCalldata: ctorCalldata,
  });
  const vaultAddress = res.deploy.contract_address;
  const vaultClassHash = res.declare.class_hash;
  console.log("  declared:", vaultClassHash);
  console.log("  deployed:", vaultAddress);
  console.log("  tx:      ", res.deploy.transaction_hash);

  await provider.waitForTransaction(res.deploy.transaction_hash, { retryInterval: 2000 });
  console.log("Vault confirmed.\n");

  // Now call Vault.deploy_tongo(owner, tag, auditorKey=None)
  const VAULT_ABI_MIN = [
    {
      name: "deploy_tongo", type: "function",
      inputs: [
        { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
        { name: "tag", type: "core::felt252" },
        { name: "auditorKey", type: "core::option::Option::<tongo::structs::common::pubkey::PubKey>" },
      ],
      outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
      state_mutability: "external",
    },
    {
      type: "struct", name: "tongo::structs::common::pubkey::PubKey",
      members: [{ name: "x", type: "core::felt252" }, { name: "y", type: "core::felt252" }],
    },
    {
      type: "enum", name: "core::option::Option::<tongo::structs::common::pubkey::PubKey>",
      variants: [
        { name: "Some", type: "tongo::structs::common::pubkey::PubKey" },
        { name: "None", type: "()" },
      ],
    },
  ] as const;
  const vault = new Contract({ abi: VAULT_ABI_MIN as never, address: vaultAddress, providerOrAccount: account });

  console.log("Deploying Tongo via Vault…");
  const auditorKeyNone = new CairoOption<{ x: string; y: string }>(CairoOptionVariant.None);
  const deployTongoTx = await vault.deploy_tongo(address, TAG, auditorKeyNone);
  console.log("  tx:", deployTongoTx.transaction_hash);
  const receipt = await provider.waitForTransaction(deployTongoTx.transaction_hash, { retryInterval: 2000 });

  // TongoDeployed event: key[0]=event selector, key[1]=tag (felt252 indexed),
  // data[0]=new tongo address (felt252).
  let tongoAddress: string | undefined;
  const events: unknown[] = (receipt as unknown as { events?: unknown[] }).events ?? [];
  const vaultBN = num.toBigInt(vaultAddress);
  for (const ev of events as Array<{ from_address: string; keys: string[]; data: string[] }>) {
    if (num.toBigInt(ev.from_address) !== vaultBN) continue;
    if (ev.data?.[0]) {
      tongoAddress = num.toHex(num.toBigInt(ev.data[0]));
      break;
    }
  }
  console.log("  new tongo:", tongoAddress);

  console.log("\nAll done ✓");
  console.log("Add to .env.local:");
  console.log(`  NEXT_PUBLIC_MAINNET_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`  NEXT_PUBLIC_MAINNET_TONGO_ADDRESS=${tongoAddress}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
