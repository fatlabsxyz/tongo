import { describe, expect, it } from "vitest";
import { generateH, VIEW } from "../src/constants"


import {
    cipherBalance,
    CURVE_ORDER,
    decipherBalance,
    encrypt,
    GENERATOR,
    generateRandom,
    SECONDARY_GENERATOR,
    challengeCommits2
  } from "../src";

import {
  poeN,
  Dependencies,
  provePoeN,
  proveBit,
  oneOrZero,
  proveRange,
  verifyRange
} from "../src/homomorphic_encryption";


const deps: Dependencies = {
  generateRandom: generateRandom,
  challengeCommits: challengeCommits2
};

it("poe", () => {
    const x = 12n;
    const { y, A, ss } = provePoeN([x], [GENERATOR], deps)
    const c = challengeCommits2(0n, [A]);
    poeN(y, [GENERATOR], A, c, ss);
    });

it("poe2", () => {
    const x1 = 12n;
    const x2 = 12412n;
    const { y, A, ss } = provePoeN([x1, x2], [GENERATOR, SECONDARY_GENERATOR], deps);
    const c = challengeCommits2(0n, [A]);

    poeN(y, [GENERATOR, SECONDARY_GENERATOR], A, c, ss);
    });

it("proveBit", () => {
  const bit: 0 | 1 = 1;
  const random = 1234n;
  const proof = proveBit(bit, random, deps);

  expect(() => oneOrZero(proof, deps)).not.toThrow();
});

it("proveRange", () => {
  const b = 13n;
  const bits = 4;
  const { r, proof } = proveRange(b, bits, deps);
  const V = verifyRange(proof, bits, deps);

  // --- expected commitment: V = g^b * h^r ---
  const expected = GENERATOR.multiplyUnsafe(b)
    .add(SECONDARY_GENERATOR.multiplyUnsafe(r));

  expect(V.equals(expected)).toBe(true);
});