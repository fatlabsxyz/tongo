/**
 * Sanity check: given a Tongo private key, prints the affine pubkey (x, y) and
 * the base58 Tongo address. Used to confirm a user's exported key matches
 * the address shown in their UI before doing any on-chain action.
 *
 * Run: pnpm exec tsx scripts/derive-tongo-key.ts <0x...>
 */
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
import { ec, num } from "starknet";

const pkHex = process.argv[2];
if (!pkHex) {
  console.error("usage: pnpm exec tsx scripts/derive-tongo-key.ts <0x...>");
  process.exit(1);
}

const pk = BigInt(pkHex);
const pub = ec.starkCurve.ProjectivePoint.fromPrivateKey(num.toHex(pk).replace(/^0x/, "").padStart(64, "0"));
const affine = pub.toAffine();
const address = TongoAccount.tongoAddress(pk);

console.log("Private key:", num.toHex(pk));
console.log("Pubkey x:   ", "0x" + affine.x.toString(16));
console.log("Pubkey y:   ", "0x" + affine.y.toString(16));
console.log("Tongo addr: ", address);
