import { describe, expect, it } from "vitest";
import { generateH, VIEW } from "../src/constants"

import {
  cipherBalance,
  CURVE_ORDER,
  decipherBalance,
  encrypt,
  GENERATOR,
  SECONDARY_GENERATOR,
  proveExpost,
  proveFund,
  proveTransfer,
  proveWithdraw,
  proveRagequit,
  proveRollover,
  verifyExpost,
  verifyFund,
  verifyTransfer,
  verifyWithdraw,
  verifyRagequit,
  verifyRollover,
  assertBalance,
  computePrefix,
} from "../src";

import {
  poeN,
  Dependencies,
  provePoeN,
  proveBit,
  oneOrZero,
  proveRange,
  verifyRange,
  challengeCommits2,
  generateRandom
} from "../src/homomorphic_encryption";

// import { find_least_bits, decipherBalanceOptimized} from "../src";
// import { hash_map} from "../src/map";

describe("Example test suit", () => {
  it("encrypts the number 2**239", () => {
    const ciphertext = encrypt(2n ** 239n);
    expect(ciphertext).toEqual({
      x: 802067669445338147039837134275860456997099677631894729361742737790946772764n,
      y: 294649485537830512735642952583674639919984341293658336545460967464050719199n,
    });
  });

  it("Testing random generator", () => {
    let i = 0;
    while (i < 100) {
      const r = generateRandom();
      expect(r).toBeLessThan(CURVE_ORDER);
      i = i + 1;
    }
  });

  it("proveFund vs verifyFund", () => {
    const x = 1234n;
    const y = GENERATOR.multiplyUnsafe(x);
    const random = 199n;
    const amount = 100n;
    const initialBalance = 10n;
    const currentBalance = cipherBalance(y,initialBalance,random);
    const nonce = 10n;

    const { inputs, proof } = proveFund(x, amount,initialBalance, currentBalance,nonce, VIEW);
    verifyFund(inputs, proof);
  });

  it("prefix vs verifyFund", () => {
    const x = 12n;
    const y = GENERATOR.multiplyUnsafe(x);
    const random = 1n;
    const amount = 100n;
    const initialBalance = 0n;
    const currentBalance = cipherBalance(y,initialBalance,random);
    const auxBalance = currentBalance;
    const auditedBalance = currentBalance;
    const auditorPubKey = y;
    const nonce = 0n;

  const fund_selector = 1718972004n;
    const seq: bigint[] = [
        fund_selector,
        y.toAffine().x,
        y.toAffine().y,
        amount,
        nonce,
        currentBalance.L.toAffine().x,
        currentBalance.L.toAffine().y,
        currentBalance.R.toAffine().x,
        currentBalance.R.toAffine().y,
        auxBalance.L.toAffine().x,
        auxBalance.L.toAffine().y,
        auxBalance.R.toAffine().x,
        auxBalance.R.toAffine().y,
        auditedBalance.L.toAffine().x,
        auditedBalance.L.toAffine().y,
        auditedBalance.R.toAffine().x,
        auditedBalance.R.toAffine().y,
        auditorPubKey.toAffine().x,
        auditorPubKey.toAffine().y,
    ];
    const prefix = computePrefix(seq);
//     console.log("prefix: {}", prefix);
  });

  it("proveWithdrawAll vs verifyWithdrawAll", () => {
    const x = 1234n;
    const nonce = 10n;
    const amount = 10n;
    const to = 116200n;
    const random = 111111n;
    const y = GENERATOR.multiplyUnsafe(x);
    const currentBalance = cipherBalance(y, amount, random);
    const { inputs, proof } = proveRagequit(
      x,
      currentBalance,
      nonce,
      to,
      amount,
    );
    verifyRagequit(inputs, proof);
  });

  it("proveWithdraw vs verifyWithdraw", () => {
    const x = 888n;
    const y = GENERATOR.multiplyUnsafe(x);

    const nonce = 2n;
    const initial_balance = 100n;
    const amount = 10n;
    const to = 555n;
    const currentBalance = cipherBalance(y, initial_balance, 99n);
    const { inputs, proof } = proveWithdraw(
      x,
      initial_balance,
      amount,
      to,
      currentBalance,
      nonce,
      VIEW,
    );
    verifyWithdraw(inputs, proof);
  });

  it("proveRollover vs verifyRollover", () => {
    const x = 4444n;
    const nonce = 82n;

    const { inputs, proof } = proveRollover(
      x,
      nonce,
    );
    verifyRollover(inputs, proof);
  });

  it("proveTransfer vs verifyTransfer", () => {
    const x = 4444n;
    const y = GENERATOR.multiplyUnsafe(x);
    const x_bar = 7777n;
    const y_bar = GENERATOR.multiplyUnsafe(x_bar);

    const nonce = 82n;
    const initial_balance = 100n;
    const amount = 10n;
    const random = 999n;
    const currentBalance = cipherBalance(y, initial_balance, random);

    const { inputs, proof } = proveTransfer(
      x,
      y_bar,
      initial_balance,
      amount,
      VIEW,
      currentBalance,
      nonce,
    );
    verifyTransfer(inputs, proof);
  });

  it("assertBalance", () => {
    const x = 1234n;
    const amount = 12n;
    const fake_amount = 44n;
    const random = 111111n;
    const y = GENERATOR.multiplyUnsafe(x);
    const { L, R } = cipherBalance(y, amount, random);
    expect(assertBalance(x, fake_amount, L, R)).toEqual(false);
    expect(assertBalance(x, amount, L, R)).toEqual(true);
  });

  it("benchmarkDecipher", () => {
    const x = 1234n;
    const amount = 12n;
    const random = 111111n;
    const y = GENERATOR.multiplyUnsafe(x);
    const { L, R } = cipherBalance(y, amount, random);
    const b = decipherBalance(x, L, R);
    expect(b).toEqual(amount);
  });


  it("poe", () => {
    const x = 12n;
    const { y, A, ss } = provePoeN([x], [GENERATOR])
    const c = challengeCommits2(0n, [A]);
    poeN(y, [GENERATOR], A, c, ss);
    });


  it("poe2", () => {
    const x1 = 12n;
    const x2 = 12412n;
    const { y, A, ss } = provePoeN([x1, x2], [GENERATOR, SECONDARY_GENERATOR]);
    const c = challengeCommits2(0n, [A]);

    poeN(y, [GENERATOR, SECONDARY_GENERATOR], A, c, ss);
    });

  it("expost", () => {
    const x = 3809213n
    const x_bar = 3809213n
    const y = GENERATOR.multiplyUnsafe(x);
    const y_bar = GENERATOR.multiplyUnsafe(x_bar);
    const b = 65n
    const r = 2930213809218n
    const {L:TL, R:TR} = cipherBalance(y,b,r)
    
    const {inputs, proof} = proveExpost(x, y_bar, TL, TR)
    verifyExpost(inputs,proof)
    const b_bar = decipherBalance(x_bar, inputs.L_bar, inputs.R)
    expect(b).toEqual(b_bar)
  });
});

it("generateH", ()=> {
    let h_gen = generateH();
    expect(h_gen).toEqual(SECONDARY_GENERATOR)
});


// it("benchmarkDecipherOptimized", () => {
//   const x = 1234n;
//   const amount = 12n;
//   const random = 111111n;
//   const y = g.multiplyUnsafe(x);
//   const { L, R } = cipherBalance(y, amount, random);
//   const b = decipherBalanceOptimized(x, L, R, hash_map);
//   expect(b).toEqual(amount);
// })

const deps: Dependencies = {
  generateRandom: generateRandom,
  challengeCommits: challengeCommits2
};

it("proveBit", () => {
  const bit: 0 | 1 = 1;
  const random = 1234n;
  const proof = proveBit(bit, random);

  expect(() => oneOrZero(proof, deps)).not.toThrow();
});

it("proveRange", () => {
  const b = 13n;
  const bits = 4;
  const { r, proof } = proveRange(b, bits);
  const V = verifyRange(proof, bits);

  // --- expected commitment: V = g^b * h^r ---
  const expected = GENERATOR.multiplyUnsafe(b)
    .add(SECONDARY_GENERATOR.multiplyUnsafe(r));

  expect(V.equals(expected)).toBe(true);
});