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
  poeN
} from "../src/homomorphic_encryption";

it("poe", () => {
    const x = 12n;
    const y = GENERATOR.multiply(x);
    const k = generateRandom()
    const A = GENERATOR.multiplyUnsafe(k);
    const c = challengeCommits2(0n, [A]);
    const s = (k + x * c) % CURVE_ORDER;

    poeN(y, [GENERATOR], A, c, [s]);
    });

it("poe2", () => {
    const x1 = 12n;
    const x2 = 12412n;
    
    const k1 = generateRandom();
    const k2 = generateRandom();
    const A = GENERATOR.multiplyUnsafe(k1).add(SECONDARY_GENERATOR.multiplyUnsafe(k2));
    const c = challengeCommits2(0n, [A]);
    const s1 = (k1 + x1 * c) % CURVE_ORDER;
    const s2 = (k2 + x2 * c) % CURVE_ORDER;
    const y = GENERATOR.multiply(x1).add(SECONDARY_GENERATOR.multiply(x2));

    poeN(y, [GENERATOR, SECONDARY_GENERATOR], A, c, [s1, s2]);
    });
