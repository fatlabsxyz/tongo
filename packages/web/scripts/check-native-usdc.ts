import "../server/env";
import { RpcProvider, Contract, num, hash as snHash } from "starknet";
const NATIVE_USDC = "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";
const USDCE = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS!;
const SW = process.env.SERVICE_WALLET_ADDRESS!;
(async () => {
  const provider = new RpcProvider({ nodeUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL!, specVersion: "0.10.0" });
  const abi = [{ name:"balanceOf", type:"function", inputs:[{name:"a",type:"core::starknet::contract_address::ContractAddress"}], outputs:[{type:"core::integer::u256"}], state_mutability:"view" }] as const;
  const native = new Contract({ abi: abi as never, address: NATIVE_USDC, providerOrAccount: provider });
  const usdce = new Contract({ abi: abi as never, address: USDCE, providerOrAccount: provider });
  const balN = await native.balanceOf(SW);
  const balE = await usdce.balanceOf(SW);
  console.log("service wallet balances:");
  console.log("  USDC native (0x033068...):", balN.toString(), "wei =", Number(balN)/1e6, "USDC");
  console.log("  USDC.e (0x053c91...):     ", balE.toString(), "wei =", Number(balE)/1e6, "USDC.e");
})();
