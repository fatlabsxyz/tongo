/**
 * End-to-end verification that the UI's "export keys" panel is consistent:
 *
 *   seedphrase  →  seedphraseToTongoPk  →  pk (hex)
 *   pk          →  pubKeyFromSecret      →  pubkey (x, y)
 *   pubkey      →  pubKeyAffineToBase58  →  tongo_address
 *
 * Pass --mnemonic "..." --pk 0x... --address tk... to assert all three match.
 *
 * Run:
 *   pnpm exec tsx scripts/verify-export.ts \
 *     --mnemonic "borrow element ..." \
 *     --pk 0x... \
 *     --address tisPf5...
 */
import { seedphraseToTongoPk } from "../src/lib/wallet";
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
import { ec, num } from "starknet";

function arg(name: string): string | undefined {
  const a = process.argv;
  const i = a.indexOf(name);
  return i >= 0 ? a[i + 1] : undefined;
}

function main() {
  const mnemonic = arg("--mnemonic");
  const pkExpected = arg("--pk");
  const addrExpected = arg("--address");
  if (!mnemonic || !pkExpected || !addrExpected) {
    console.error('usage: ... --mnemonic "..." --pk 0x... --address tk...');
    process.exit(1);
  }

  console.log("Mnemonic input:    ", mnemonic);
  const pkFromMnemonic = seedphraseToTongoPk(mnemonic);
  const pkHex = num.toHex(pkFromMnemonic);
  console.log("Pk from mnemonic:  ", pkHex);
  console.log("Pk expected (UI):  ", pkExpected);
  const pkExpectedBn = BigInt(pkExpected);
  const pkMatch = pkFromMnemonic === pkExpectedBn;
  console.log(`Pk match:          ${pkMatch ? "OK" : "FAIL"}`);

  const pkPaddedHex = num.toHex(pkExpectedBn).replace(/^0x/, "").padStart(64, "0");
  const pub = ec.starkCurve.ProjectivePoint.fromPrivateKey(pkPaddedHex).toAffine();
  console.log("Pubkey x:          ", "0x" + pub.x.toString(16));
  console.log("Pubkey y:          ", "0x" + pub.y.toString(16));

  const addrFromPk = TongoAccount.tongoAddress(pkExpectedBn);
  console.log("Tongo addr from pk:", addrFromPk);
  console.log("Tongo addr expected:", addrExpected);
  const addrMatch = addrFromPk === addrExpected;
  console.log(`Address match:     ${addrMatch ? "OK" : "FAIL"}`);

  const ok = pkMatch && addrMatch;
  console.log(`\n${ok ? "ALL CONSISTENT ✓" : "INCONSISTENT ✗"}`);
  process.exit(ok ? 0 : 1);
}

main();
