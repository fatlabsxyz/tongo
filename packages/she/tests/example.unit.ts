import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  encrypt,
  g,
  h,
} from "../src";
import { generate_random, CURVE_ORDER } from "../src";
import { prove_fund, verify_fund } from "../src";
import {
  prove_withdraw_all,
  verify_withdraw_all,
  cipher_balance,
} from "../src";
import { prove_withdraw, verify_withdraw } from "../src";
import { decipher_balance } from "../src";
import { prove_poe, verify_poe } from "../src";
import { prove_poe2, verify_poe2 } from "../src";
import { prove_transfer, verify_transfer } from "../src";
import { prove_expost , verify_expost} from "../src"
import { find_least_bits, decipher_balance_optimized} from "../src";
import { hash_map} from "../src/map";

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
      const r = generate_random();
      expect(r).toBeLessThan(CURVE_ORDER);
      i = i + 1;
    }
  });

  it("prove_fund vs verify_fund", () => {
    const x = 1234n;
    const nonce = 10n;
    const { inputs, proof } = prove_fund(x, nonce);
    verify_fund(inputs, proof);
  });

  it("prove_withdraw_all vs verify_withdraw_all", () => {
    const x = 1234n;
    const nonce = 10n;
    const amount = 10n;
    const to = 116200n;
    const random = 111111n;
    const y = g.multiplyUnsafe(x);
    const { L, R } = cipher_balance(y, amount, random);
    const { inputs, proof } = prove_withdraw_all(
      x,
      L,
      R,
      nonce,
      to,
      amount,
    );
    verify_withdraw_all(inputs, proof);
  });

  it("prove_withdrw vs verify_withdraw", () => {
    const x = 888n;
    const y = g.multiplyUnsafe(x);

    const nonce = 2n;
    const initial_balance = 100n;
    const amount = 10n;
    const to = 555n;
    const { L, R } = cipher_balance(y, initial_balance, 99n);
    const { inputs, proof } = prove_withdraw(
      x,
      initial_balance,
      amount,
      L,
      R,
      to,
      nonce,
    );
    verify_withdraw(inputs, proof);
  });

  it("prove_transfer vs verify_transfer", () => {
    const x = 4444n;
    const y = g.multiplyUnsafe(x);
    const x_bar = 7777n;
    const y_bar = g.multiplyUnsafe(x_bar);

    const nonce = 82n;
    const initial_balance = 100n;
    const amount = 10n;
    const random = 999n;
    const { L, R } = cipher_balance(y, initial_balance, random);

    const { inputs, proof } = prove_transfer(
      x,
      y_bar,
      initial_balance,
      amount,
      L,
      R,
      nonce,
    );
    verify_transfer(inputs, proof);
  });

  it("bechmark_decipher", () => {
    const x = 1234n;
    const amount = 12n;
    const random = 111111n;
    const y = g.multiplyUnsafe(x);
    const { L, R } = cipher_balance(y, amount, random);
    const b = decipher_balance(x, L, R);
    expect(b).toEqual(amount);
  });

  it("poe", () => {
    const x = 12n;
    const { y, A, s } = prove_poe(x, g);
    verify_poe(y, g, A, s);
  });

  it("poe2", () => {
    const x1 = 12n;
    const x2 = 12412n;
    const { y, A, s1, s2 } = prove_poe2(x1, x2, g, h);
    verify_poe2(y, g, h, A, s1, s2);
  });

  it("expost", () => {
    const x = 3809213n
    const x_bar = 3809213n
    const y = g.multiplyUnsafe(x);
    const y_bar = g.multiplyUnsafe(x_bar);
    const b = 65n
    const r = 2930213809218n
    const {L:TL, R:TR} = cipher_balance(y,b,r)
    
    const {inputs, proof} = prove_expost(x, y_bar, TL, TR)
    verify_expost(inputs,proof)
    const b_bar = decipher_balance(x_bar, inputs.L_bar, inputs.R)
    expect(b).toEqual(b_bar)
  });
});


it("bechmark_decipher_optimized", () => {
  const x = 1234n;
  const amount = 12n;
  const random = 111111n;
  const y = g.multiplyUnsafe(x);
  const { L, R } = cipher_balance(y, amount, random);
  const b = decipher_balance_optimized(x, L, R, hash_map);
  expect(b).toEqual(amount);
});