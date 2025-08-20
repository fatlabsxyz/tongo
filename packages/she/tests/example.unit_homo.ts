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
  oneOrZero
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
      // --- secret inputs ---
      const bit: 0 | 1 = 1;
      const random = 1234n;
    
      // --- prover ---
      const proof = proveBit(bit, random, deps);
    
      // --- verifier ---
      expect(() => oneOrZero(proof, deps)).not.toThrow();
    });