import "../server/env";
import { RpcProvider, Contract, num, hash as snHash } from "starknet";
const RPC = process.env.NEXT_PUBLIC_MAINNET_RPC_URL!;
const USDC = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS!;
const SW = process.env.SERVICE_WALLET_ADDRESS!;
(async () => {
  const provider = new RpcProvider({ nodeUrl: RPC, specVersion: "0.10.0" });
  const usdc = new Contract({ abi: [
    { name: "balanceOf", type: "function", inputs: [{ name:"a", type:"core::starknet::contract_address::ContractAddress" }], outputs:[{ type:"core::integer::u256" }], state_mutability:"view" },
  ] as never, address: USDC, providerOrAccount: provider });
  const bal = await usdc.balanceOf(SW);
  console.log("service wallet USDC balance:", bal.toString(), "wei");
  const head = await provider.getBlockNumber();
  console.log("head block:", head);
  const ev = await provider.getEvents({
    from_block: { block_number: head - 100 },
    to_block: { block_number: head },
    address: USDC,
    keys: [[snHash.getSelectorFromName("Transfer")]],
    chunk_size: 50,
  });
  const swBN = num.toBigInt(SW);
  let hit = 0;
  for (const e of ev.events) {
    let toAddr: string | null = null;
    let amount = 0n;
    if (e.keys.length >= 3) {
      toAddr = num.toHex(num.toBigInt(e.keys[2]!));
      amount = BigInt(e.data[0]!) + (BigInt(e.data[1] ?? "0x0") << 128n);
    } else if (e.data.length >= 4) {
      toAddr = num.toHex(num.toBigInt(e.data[1]!));
      amount = BigInt(e.data[2]!) + (BigInt(e.data[3] ?? "0x0") << 128n);
    }
    if (toAddr && num.toBigInt(toAddr) === swBN) {
      hit++;
      console.log(`  INCOMING block=${e.block_number} amount=${amount} wei tx=${e.transaction_hash}`);
    }
  }
  console.log(`scanned ${ev.events.length} Transfer events; ${hit} incoming to service wallet`);
})();
