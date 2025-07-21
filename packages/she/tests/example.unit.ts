import { describe, expect, it } from "vitest";
import { generateH } from "../src/constants"

import {
  cipherBalance,
  CURVE_ORDER,
  decipherBalance,
  encrypt,
  GENERATOR,
  generateRandom,
  SECONDARY_GENERATOR,
  proveExpost,
  proveFund,
  provePoe,
  provePoe2,
  proveTransfer,
  proveWithdraw,
  proveWithdrawAll,
  verifyExpost,
  verifyFund,
  verifyPoe,
  verifyPoe2,
  verifyTransfer,
  verifyWithdraw,
  verifyWithdrawAll,
  assertBalance
} from "../src";

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
    const nonce = 10n;
    const { inputs, proof } = proveFund(x, nonce);
    verifyFund(inputs, proof);
  });

  it("proveWithdrawAll vs verifyWithdrawAll", () => {
    const x = 1234n;
    const nonce = 10n;
    const amount = 10n;
    const to = 116200n;
    const random = 111111n;
    const y = GENERATOR.multiplyUnsafe(x);
    const { L, R } = cipherBalance(y, amount, random);
    const { inputs, proof } = proveWithdrawAll(
      x,
      L,
      R,
      nonce,
      to,
      amount,
    );
    verifyWithdrawAll(inputs, proof);
  });

  it("proveWithdraw vs verifyWithdraw", () => {
    const x = 888n;
    const y = GENERATOR.multiplyUnsafe(x);

    const nonce = 2n;
    const initial_balance = 100n;
    const amount = 10n;
    const to = 555n;
    const { L, R } = cipherBalance(y, initial_balance, 99n);
    const { inputs, proof } = proveWithdraw(
      x,
      initial_balance,
      amount,
      L,
      R,
      to,
      nonce,
    );
    verifyWithdraw(inputs, proof);
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
    const { L, R } = cipherBalance(y, initial_balance, random);

    const { inputs, proof } = proveTransfer(
      x,
      y_bar,
      initial_balance,
      amount,
      L,
      R,
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
    const { y, A, s } = provePoe(x, GENERATOR);
    verifyPoe(y, GENERATOR, A, s);
  });

  it("poe2", () => {
    const x1 = 12n;
    const x2 = 12412n;
    const { y, A, s1, s2 } = provePoe2(x1, x2, GENERATOR, SECONDARY_GENERATOR);
    verifyPoe2(y, GENERATOR, SECONDARY_GENERATOR, A, s1, s2);
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