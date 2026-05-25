/**
 * One-shot rescue: credits the USDC currently sitting in the service wallet to
 * a given Tongo pubkey via outside_fund. Use when a deposit landed but the
 * watcher missed it (e.g. before redeploy, or older than 50 blocks).
 *
 * Pass --request <id> to credit the most-recent pending request from the DB,
 * or --pk-x 0x... --pk-y 0x... to credit a specific Tongo pubkey directly.
 *
 * Run:
 *   pnpm exec tsx scripts/rescue-credit.ts --request <id>
 *   pnpm exec tsx scripts/rescue-credit.ts --pk-x 0x... --pk-y 0x...
 */
import "../server/env";
import { Account, RpcProvider, Contract, CallData, uint256, type Call } from "starknet";
import { getServiceWalletKey } from "../src/lib/service-wallet";
import { NETWORKS } from "../src/lib/networks";
import { getFundRequest, updateFundRequest } from "../server/db";

const USDC = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS!;
const TONGO = process.env.NEXT_PUBLIC_MAINNET_TONGO_ADDRESS!;

const TONGO_ABI = [
  { name: "get_rate", type: "function", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
] as const;
const ERC20_ABI = [
  { name: "balanceOf", type: "function",
    inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
] as const;

function parseArgs(): { requestId?: string; pkX?: string; pkY?: string } {
  const out: { requestId?: string; pkX?: string; pkY?: string } = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--request" && a[i + 1]) { out.requestId = a[++i]; }
    else if (a[i] === "--pk-x" && a[i + 1]) { out.pkX = a[++i]; }
    else if (a[i] === "--pk-y" && a[i + 1]) { out.pkY = a[++i]; }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const network = NETWORKS.mainnet;
  const { pk, address } = getServiceWalletKey();
  const provider = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
  const account = new Account({ provider, address, signer: pk, cairoVersion: "1", transactionVersion: "0x3" });

  let pkX: string, pkY: string;
  let dbRequest: Awaited<ReturnType<typeof getFundRequest>> = null;
  if (args.requestId) {
    dbRequest = await getFundRequest(args.requestId);
    if (!dbRequest) throw new Error(`request ${args.requestId} not found`);
    pkX = dbRequest.tongoPubKey.x;
    pkY = dbRequest.tongoPubKey.y;
    console.log(`Crediting request ${dbRequest.id} → ${dbRequest.tongoAddress}`);
  } else if (args.pkX && args.pkY) {
    pkX = args.pkX; pkY = args.pkY;
    console.log(`Crediting raw pubkey ${pkX} / ${pkY}`);
  } else {
    throw new Error("usage: --request <id>  OR  --pk-x 0x... --pk-y 0x...");
  }

  const usdc = new Contract({ abi: ERC20_ABI as never, address: USDC, providerOrAccount: provider });
  const bal = BigInt((await usdc.balanceOf(address)).toString());
  console.log(`Service wallet USDC balance: ${bal} wei = ${Number(bal) / 1e6} USDC`);
  if (bal === 0n) throw new Error("service wallet has no USDC");

  const tongo = new Contract({ abi: TONGO_ABI as never, address: TONGO, providerOrAccount: provider });
  const rate = BigInt((await tongo.get_rate()).toString());
  const tongoAmount = bal / rate;
  if (tongoAmount === 0n) throw new Error(`balance ${bal} too small for rate ${rate}`);
  const approveAmount = tongoAmount * rate;
  console.log(`Rate: ${rate}, will fund ${tongoAmount} Tongos (consumes ${approveAmount} wei).`);

  if (dbRequest) {
    await updateFundRequest(dbRequest.id, { status: "funding", detectedDepositTxHash: "(rescue:manual)" });
  }

  const approve: Call = {
    contractAddress: USDC, entrypoint: "approve",
    calldata: CallData.compile({ spender: TONGO, amount: uint256.bnToUint256(approveAmount) }),
  };
  const outsideFund: Call = {
    contractAddress: TONGO, entrypoint: "outside_fund",
    calldata: CallData.compile([{ to: { x: pkX, y: pkY }, amount: tongoAmount }]),
  };
  const { transaction_hash } = await account.execute([approve, outsideFund]);
  console.log(`outside_fund tx: ${transaction_hash}`);
  await provider.waitForTransaction(transaction_hash, { retryInterval: 2000 });
  console.log("Confirmed ✓");

  if (dbRequest) {
    await updateFundRequest(dbRequest.id, {
      status: "completed",
      fundTxHash: transaction_hash,
      fundedAmountStrk: bal.toString(),
      fundedAmountTongo: tongoAmount.toString(),
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
