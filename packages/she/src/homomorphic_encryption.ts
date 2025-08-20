import { ProjectivePoint, utils, poseidonHashMany } from "@scure/starknet";
import { Affine } from "./types.js";
import { CURVE_ORDER, GENERATOR, SECONDARY_GENERATOR } from "./constants.js";
import { challengeCommits2, generateRandom } from "./she.js";

export function encrypt(sc: bigint): Affine {
    return GENERATOR.multiplyUnsafe(sc).toAffine();
  }

  export interface CipherBalance {
    L: ProjectivePoint;
    R: ProjectivePoint;
}

export function cipherBalance(
    y: ProjectivePoint,
    amount: bigint,
    random: bigint,
  ): CipherBalance  {
    if (amount === 0n) {
      const L = y.multiplyUnsafe(random);
      const R = GENERATOR.multiplyUnsafe(random) ;
      return {L,R}
    }
    const L = GENERATOR.multiply(amount).add(y.multiplyUnsafe(random));
    const R = GENERATOR.multiplyUnsafe(random);
    return {L, R}
  }

  export function poeN(
    y: ProjectivePoint,
    bases: ProjectivePoint[],
    A: ProjectivePoint,
    c: bigint,
    ss: bigint[],
  ) {
    if (bases.length !== ss.length) {
      throw new Error("Bases and responses must have the same length");
    }
  
    const LHS = bases.reduce(
        (acc, g, i) => acc.add(g.multiplyUnsafe(ss[i]!)),
        ProjectivePoint.ZERO
      );
  
    const RHS = A.add(y.multiplyUnsafe(c));
  
    return LHS.equals(RHS);
  }

  function zip<T, U>(a: T[], b: U[]): [T, U][] {
    if (a.length !== b.length) {
      throw new Error("Arrays must have the same length");
    }
    return a.map((x, i) => [x, b[i]!]); // safe due to length check
  }
  
  export function provePoeN(
    scalars: bigint[],
    bases: ProjectivePoint[],
  ) {
    const pairs = zip(scalars, bases);
  
    // y = Σ (xᵢ · gᵢ)
    const y = pairs.reduce(
      (acc, [x, g]) => acc.add(g.multiply(x)),
      ProjectivePoint.ZERO
    );
  
    // generate randomizers kᵢ
    const ks = scalars.map(() => generateRandom());
  
    // A = Σ (kᵢ · gᵢ)
    const A = zip(ks, bases).reduce(
      (acc, [k, g]) => acc.add(g.multiplyUnsafe(k)),
      ProjectivePoint.ZERO
    );
  
    // Fiat–Shamir challenge
    const c = challengeCommits2(0n, [A]);
  
    // sᵢ = (kᵢ + xᵢ · c) mod CURVE_ORDER
    const ss = zip(ks, scalars).map(
      ([k, x]) => (k + x * c) % CURVE_ORDER
    );
  
    return { y, A, ss };
  }

