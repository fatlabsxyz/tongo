/**
 * Quick STRK balance check on the service wallet (mainnet).
 * Run: pnpm exec tsx scripts/check-strk-balance.ts
 */
import "../server/env";
import { RpcProvider, Contract } from "starknet";

const RPC = process.env.NEXT_PUBLIC_MAINNET_RPC_URL!;
const STRK = process.env.NEXT_PUBLIC_MAINNET_STRK_ADDRESS!;
const ADDR = process.env.SERVICE_WALLET_ADDRESS!;

const ERC20 = [{ name: "balanceOf", type: "function",
  inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
  outputs: [{ type: "core::integer::u256" }], state_mutability: "view" }] as const;

async function main() {
  const provider = new RpcProvider({ nodeUrl: RPC, specVersion: "0.10.0" });
  const c = new Contract({ abi: ERC20 as never, address: STRK, providerOrAccount: provider });
  const b = await c.balanceOf(ADDR);
  const wei = BigInt(b.toString());
  console.log(`STRK balance: ${wei} wei = ${(Number(wei) / 1e18).toFixed(4)} STRK`);
}
main().catch((e) => { console.error(e); process.exit(1); });
