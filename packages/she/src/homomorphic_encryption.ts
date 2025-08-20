import { ProjectivePoint} from "@scure/starknet";
import { Affine } from "./types.js";
import { CURVE_ORDER, GENERATOR, SECONDARY_GENERATOR } from "./constants.js";


function zip<T, U>(a: T[], b: U[]): [T, U][] {
  if (a.length !== b.length) {
    throw new Error("Arrays must have the same length");
  }
  return a.map((x, i) => [x, b[i]!]);
}

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

  export interface Dependencies {
    generateRandom: () => bigint;
    challengeCommits: (seed: bigint, commits: ProjectivePoint[]) => bigint;
  }
  
  interface PoeProof {
    y: ProjectivePoint;
    A: ProjectivePoint;
    ss: bigint[];
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
  
  export function provePoeN(
    scalars: bigint[],
    bases: ProjectivePoint[],
    deps: Dependencies
  ): PoeProof {

    const pairs = zip(scalars, bases);
    const { generateRandom, challengeCommits } = deps;

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
    const c = challengeCommits(0n, [A]);
  
    // sᵢ = (kᵢ + xᵢ · c) mod CURVE_ORDER
    const ss = zip(ks, scalars).map(
      ([k, x]) => (k + x * c) % CURVE_ORDER
    );
  
    return { y, A, ss };
  }

  // -------------------------- PROOF OF BIT ----------------------------------------------------

  interface ProofOfBit {
    V: ProjectivePoint;
    A0: ProjectivePoint;
    A1: ProjectivePoint;
    c0: bigint;
    s0: bigint;
    s1: bigint;
  }
  
  function simPOE(
    y: ProjectivePoint,
    gen: ProjectivePoint,
    { generateRandom }: Dependencies
  ) {
    const s = generateRandom();
    const c = generateRandom();
    const A = gen.multiplyUnsafe(s).subtract(y.multiplyUnsafe(c));
    return { A, c, s };
  }

  function _proveBit0(random: bigint, deps: Dependencies): ProofOfBit {
    const { generateRandom, challengeCommits } = deps;
  
    const V = SECONDARY_GENERATOR.multiplyUnsafe(random);
    const V_1 = V.subtract(GENERATOR);
    const { A: A1, c: c1, s: s1 } = simPOE(V_1, SECONDARY_GENERATOR, deps);
  
    const k = generateRandom();
    const A0 = SECONDARY_GENERATOR.multiplyUnsafe(k);
  
    const c = challengeCommits(0n, [A0, A1]);
    const c0 = c ^ c1;
    const s0 = (k + c0 * random) % CURVE_ORDER;
  
    return { V, A0, A1, c0, s0, s1 };
  }
  
function _proveBit1(random: bigint, deps: Dependencies): ProofOfBit {
  const { generateRandom, challengeCommits } = deps;

  const V = GENERATOR.add(SECONDARY_GENERATOR.multiplyUnsafe(random));
  const V0 = V;
  const { A: A0, c: c0, s: s0 } = simPOE(V0, SECONDARY_GENERATOR, deps);

  const k = generateRandom();
  const A1 = SECONDARY_GENERATOR.multiplyUnsafe(k);

  const c = challengeCommits(0n, [A0, A1]);
  const c1 = c ^ c0;
  const s1 = (k + c1 * random) % CURVE_ORDER;

  return { V, A0, A1, c0, s0, s1 };
}
  
export function proveBit(bit: 0 | 1, random: bigint, deps: Dependencies): ProofOfBit {
  return bit === 0 ? _proveBit0(random, deps) : _proveBit1(random, deps);
}
  
  /// Proof of Bit: validate that a commited V = g**b h**r is the ciphertext of  either b=0 OR b=1.
  /// If b = 0 then V = h**r and a proof of exponet for r is enought. If b=1 then V/g = h**r could be
  /// also proven with a poe. This is combined in a OR statement and the protocol can valitates that
  /// one of the cases is valid without leak which one is valid.
export function oneOrZero(pi: ProofOfBit, deps: Dependencies) {
  const { challengeCommits } = deps;

  const c = challengeCommits(0n, [pi.A0, pi.A1]);
  const c1 = c ^ pi.c0;

  let res = poeN(pi.V, [SECONDARY_GENERATOR], pi.A0, pi.c0, [pi.s0]);
  if (!res) {
    throw new Error("Failed 0 in proof of bit");
  }

  const V1 = pi.V.subtract(GENERATOR);
  res = poeN(V1, [SECONDARY_GENERATOR], pi.A1, c1, [pi.s1]);
  if (!res) {
    throw new Error("Failed 1 in proof of bit");
  }
}
  // -------------------------- PROOF OF BIT ----------------------------------------------------

// --------------------------------------- RANGE ------------------------------------------------
export function proveRange(
  b: bigint,
  bits: number,
  deps: Dependencies
): { r: bigint; proof: ProofOfBit[] } {
  if (b >= 2 ** bits) {
    throw new Error("number not in range");
  }
  const b_bin: (0|1)[] = b
    .toString(2)
    .padStart(bits, "0")
    .split("")
    .map(Number)
    .map(x => x as (0|1))
    .reverse();
  const proof: ProofOfBit[] = [];
  let pow = 1n;
  let r = 0n;
  let i = 0;
  while (i < bits) {
    const r_inn = deps.generateRandom()
    const pi = proveBit(b_bin[i]!, r_inn, deps);
    proof.push(pi);
    r = (r + r_inn * pow) % CURVE_ORDER;
    pow = 2n * pow;
    i = i + 1;
  }
  return { r, proof };
}

/// Verify that a span of Vi = g**b_i h**r_i are encoding either b=1 or b=0 and that
/// those bi are indeed the binary decomposition b = sum_i b_i 2**i. With the b that
/// is encoded in V = g**b h**r. (Note that r = sim_i r_i 2**i)
/// TODO: This could (and probably should) be change to bulletproof.
export function verifyRange(proof: ProofOfBit[], bits: number, deps: Dependencies): ProjectivePoint {
  let pi = proof[0]!;
  oneOrZero(pi, deps);
  let V = pi.V;
  let pow = 2n;
  let i = 1;
  while (i < bits) {
    pi = proof[i]!;
    oneOrZero(pi, deps);
    V = V.add(pi.V.multiplyUnsafe(pow));
    i = i + 1;
    pow = pow * 2n;
  }
  return V;
}
// --------------------------------------- RANGE ------------------------------------------------