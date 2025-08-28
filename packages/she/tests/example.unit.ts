import { describe, expect, it } from "vitest";
import { generateH } from "../src/constants"
import { ProjectivePoint} from "@scure/starknet";

import {
  cipherBalance,
  CURVE_ORDER,
  decipherBalance,
  encrypt,
  GENERATOR,
  SECONDARY_GENERATOR,
  proveFund,
  proveTransfer,
  proveWithdraw,
  proveRagequit,
  proveRollover,
  verifyFund,
  verifyTransfer,
  verifyWithdraw,
  verifyRagequit,
  verifyRollover,
  assertBalance,
  prove_audit,
  verify_audit,
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
  generateRandom,
  verifyElGammal,
  elGamalEncryption,
  proveElGammal,
  verifySameEncryptionSameKey,
  verifySameEncryptionKnownRandom,
  proveSameEncryptionSameKey,
  proveSameEncryptionDiffKey,
  verifySameEncryptionUnknownRandom,
  proveSameEncryptionDiffKeyUnknownRandom
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

    const { inputs, proof } = proveFund(x, amount,initialBalance, currentBalance,nonce);
    verifyFund(inputs, proof);

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
});

it("generateH", ()=> {
    let h_gen = generateH();
    expect(h_gen).toEqual(SECONDARY_GENERATOR)
});


it("audit", ()=> {
    const x = 1928312n;
    const y = GENERATOR.multiply(x);

    const x_auditor = 239210n;
    const auditorPubKey = GENERATOR.multiply(x_auditor);
    const balance = 100n;
    const storedBalance = cipherBalance(y, balance, 92873821n);
    
    const {inputs, proof} = prove_audit(x, balance, storedBalance, auditorPubKey);
    verify_audit(inputs,proof);
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

  const expected = GENERATOR.multiplyUnsafe(b)
    .add(SECONDARY_GENERATOR.multiplyUnsafe(r));

  expect(V.equals(expected)).toBe(true);
});

it("verifyElGammal accepts a valid proof from the working prover", () => {
  const message = 123n;
  const random = 42n;
  const y = SECONDARY_GENERATOR;
  const g1 = GENERATOR;
  const g2 = SECONDARY_GENERATOR;

  const { L, R } = elGamalEncryption(y, message, random);

  const proof = proveElGammal(message, random, y, g1, g2);

  expect(() =>
    verifyElGammal(L, R, g1, g2, proof.AL, proof.AR, proof.c, proof.sb, proof.sr)
  ).not.toThrow();

  expect(
    verifyElGammal(L, R, g1, g2, proof.AL, proof.AR, proof.c, proof.sb, proof.sr)
  ).toBe(true);
});

it("verifyElGammal rejects an invalid proof", () => {
  const message = 123n;
  const random = 42n;
  const y = SECONDARY_GENERATOR;
  const g1 = GENERATOR;
  const g2 = SECONDARY_GENERATOR;

  const { L, R } = elGamalEncryption(y, message, random);

  const proof = proveElGammal(message, random, y, g1, g2);

  const invalidProof = { ...proof, sb: (proof.sb + 1n) % CURVE_ORDER };

  expect(() =>
    verifyElGammal(L, R, g1, g2, invalidProof.AL, invalidProof.AR, invalidProof.c, invalidProof.sb, invalidProof.sr)
  ).toThrow("Failed poe2 for L");
});

describe("verifySameEncryptionSameKey", () => {
  const g = GENERATOR;
  const x = 15n;
  const y = g.multiplyUnsafe(x);

  it("returns true when ciphertexts are identical (R1 === R2)", () => {
    const message = 123n;
    const random = 42n;

    const { L: L1, R: R1 } = elGamalEncryption(y, message, random);
    const { L: L2, R: R2 } = elGamalEncryption(y, message, random);

    expect(
      verifySameEncryptionSameKey(L1, R1, L2, R2, g, ProjectivePoint.ZERO, 0n, 0n)
    ).toBe(true);
  });

  it("returns false when ciphertexts differ but R1 === R2", () => {
    const message1 = 123n;
    const message2 = 456n;
    const random = 42n;

    const { L: L1, R: R1 } = elGamalEncryption(y, message1, random);
    const { L: L2, R: R2 } = elGamalEncryption(y, message2, random);

    expect(
      verifySameEncryptionSameKey(L1, R1, L2, R2, g, ProjectivePoint.ZERO, 0n, 0n)
    ).toBe(false);
  });

  it("passes with valid PoE when R1 !== R2 but messages are the same", () => {
    const message = 123n;
    const random1 = 42n;
    const random2 = 99n;

    const { L: L1, R: R1 } = elGamalEncryption(y, message, random1);
    const { L: L2, R: R2 } = elGamalEncryption(y, message, random2);

    const { A, c, s } = proveSameEncryptionSameKey(L1, R1, L2, R2, x);

    expect(
      verifySameEncryptionSameKey(L1, R1, L2, R2, g, A, c, s)
    ).toBe(true);
  });

  it("throws when PoE is invalid (tampered s) for R1 !== R2", () => {
    const message = 123n;
    const random1 = 42n;
    const random2 = 99n;

    const { L: L1, R: R1 } = elGamalEncryption(y, message, random1);
    const { L: L2, R: R2 } = elGamalEncryption(y, message, random2);

    // Generate valid PoE first
    const { A, c, s } = proveSameEncryptionSameKey(L1, R1, L2, R2, x);

    // Tamper s to invalidate the PoE
    const invalidS = (s + 1n) % CURVE_ORDER;

    expect(() =>
      verifySameEncryptionSameKey(L1, R1, L2, R2, g, A, c, invalidS)
    ).toThrow("Q1");
  });
});



describe("verifySameEncryptionKnownRandom", () => {
  const g = GENERATOR;
  const y1 = GENERATOR.multiplyUnsafe(5n);
  const y2 = GENERATOR.multiplyUnsafe(19n);
  const r1 = 42n;
  const r2 = 99n;
  const message = 123n;
  
  it("accepts valid proof when two ciphertexts encrypt the same message with different keys", () => {
    
    const { L: L1, R: R1 } = elGamalEncryption(y1, message, r1);
    const { L: L2, R: R2 } = elGamalEncryption(y2, message, r2);


    const { AL1, AR1, AL2, AR2, c, sb, sr1, sr2 } = proveSameEncryptionDiffKey(y1, y2, r1, r2, message);

    expect(() =>
      verifySameEncryptionKnownRandom(
        L1,
        R1,
        L2,
        R2,
        g,
        y1,
        y2,
        AL1,
        AR1,
        AL2,
        AR2,
        c,
        sb,
        sr1,
        sr2
      )
    ).not.toThrow();
  });

  it("accepts valid proof when two ciphertexts encrypt the same message with the same key", () => {
    const y2 = GENERATOR.multiplyUnsafe(5n);
    const { L: L1, R: R1 } = elGamalEncryption(y1, message, r1);
    const { L: L2, R: R2 } = elGamalEncryption(y2, message, r2);


    const { AL1, AR1, AL2, AR2, c, sb, sr1, sr2 } = proveSameEncryptionDiffKey(y1, y2, r1, r2, message);

    expect(() =>
      verifySameEncryptionKnownRandom(
        L1,
        R1,
        L2,
        R2,
        g,
        y1,
        y2,
        AL1,
        AR1,
        AL2,
        AR2,
        c,
        sb,
        sr1,
        sr2
      )
    ).not.toThrow();
  });

  it("throws if R1 === R2 but the message is different", () => {
    const message = 123n;
    const r = 42n;

    const { L: L1, R: R1 } = elGamalEncryption(y1, message, r1);
    const { L: L2, R: R2 } = elGamalEncryption(y2, message, r2);

    const { AL1, AR1, AL2, AR2, c, sb, sr1, sr2 } = proveSameEncryptionDiffKey(y1, y2, r1, r2, message);
    // tamper sr2
    expect(() =>
    verifySameEncryptionKnownRandom(
      L1,
      R1,
      L2,
      R1,
      g,
      y1,
      y2,
      AL1,
      AR1,
      AL2,
      AR2,
      c,
      sb,
      sr1,
      (sr2 + 1n) % CURVE_ORDER,
    )
    ).toThrow("sr1 != sr2");
  });

  
  it("throws if ElGamal verification fails (tampered proof)", () => {
    const message = 123n;
    const r1 = 42n;
    const r2 = 99n;

    const { L: L1, R: R1 } = elGamalEncryption(y1, message, r1);
    const { L: L2, R: R2 } = elGamalEncryption(y2, message, r2);

    const { AL1, AR1, AL2, AR2, c, sb, sr1, sr2 } = proveSameEncryptionDiffKey(y1, y2, r1, r2, message);

    // tamper s so that ElGamal check fails
    expect(() =>
    verifySameEncryptionKnownRandom(
      L1,
      R1,
      L2,
      R2,
      g,
      y1,
      y2,
      AL1,
      AR1,
      AL2,
      AR2,
      c,
      (sb + 1n) % CURVE_ORDER,
      sr1,
      sr2,
    )
    ).toThrow("W1");
  });
});


describe("verifySameEncryptionUnknownRandom", () => {
  const g = GENERATOR;
  const x1 = 5n
  const y1 = GENERATOR.multiplyUnsafe(x1);
  const y2 = GENERATOR.multiplyUnsafe(19n);
  const r1 = 42n;
  const r2 = 99n;
  const message = 123n;
  
  it("accepts valid proof when two ciphertexts encrypt the same message with different keys", () => {
    
    const { L: L1, R: R1 } = elGamalEncryption(y1, message, r1);
    const { L: L2, R: R2 } = elGamalEncryption(y2, message, r2);


    const { Ax, AL1, R1: _R1, AL2, AR2, c, sb, sx1, sr2 } = proveSameEncryptionDiffKeyUnknownRandom(y2, R1, x1, r2, message);

    expect(() =>
      verifySameEncryptionUnknownRandom(
        L1,
        _R1,
        L2,
        R2,
        g,
        y1,
        y2,
        Ax,
        AL1,
        AL2,
        AR2,
        c,
        sb,
        sx1,
        sr2
      )
    ).not.toThrow();
  });

  it("throws if ElGamal verification fails (tampered proof)", () => {
    
    const { L: L1, R: R1 } = elGamalEncryption(y1, message, r1);
    const { L: L2, R: R2 } = elGamalEncryption(y2, message, r2);


    const { Ax, AL1, R1: _R1, AL2, AR2, c, sb, sx1, sr2 } = proveSameEncryptionDiffKeyUnknownRandom(y2, R1, x1, r2, message);

    // tamper s so that ElGamal check fails
    expect(() =>
      verifySameEncryptionUnknownRandom(
        L1,
        _R1,
        L2,
        R2,
        g,
        y1,
        y2,
        Ax,
        AL1,
        AL2,
        AR2,
        c,
        (sb + 1n) % CURVE_ORDER,
        sx1,
        sr2
      )
    ).toThrow("E2");
  });
});