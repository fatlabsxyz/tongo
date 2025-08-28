import { ProjectivePoint, utils, poseidonHashMany } from "@scure/starknet";
import { CURVE_ORDER, GENERATOR, SECONDARY_GENERATOR } from "./constants.js";


function zip<T, U>(a: T[], b: U[]): [T, U][] {
  if (a.length !== b.length) {
    throw new Error("Arrays must have the same length");
  }
  return a.map((x, i) => [x, b[i]!]);
}
export function generateRandom(): bigint {
  const random_bytes = utils.randomPrivateKey();
  return utils.normPrivateKeyToScalar(random_bytes);
}


// This function matches cairo challengeCommits2
export function challengeCommits2(prefix: bigint, commits: ProjectivePoint[]) {
  const data: bigint[] = [prefix];
  commits.forEach((commit, _index) => {
    const temp = commit.toAffine();
    data.push(temp.x);
    data.push(temp.y);
  });

  //   const base = PED2(data);
  const base = poseidonHashMany(data);
  let salt = 1n;
  let c = CURVE_ORDER + 1n;
  while (c >= CURVE_ORDER) {
    //     c = PED2([base, salt]);
    c = poseidonHashMany([base, salt]);
    salt = salt + 1n;
  }
  return c;
}

export interface Dependencies {
  generateRandom: () => bigint;
  challengeCommits: (prefix: bigint, commits: ProjectivePoint[]) => bigint;
}

export const defaultDeps: Dependencies = {
  generateRandom: generateRandom,
  challengeCommits: challengeCommits2,
};

export interface ElGamalEncryption {
  L: ProjectivePoint;
  R: ProjectivePoint;
}

export function elGamalEncryption(
  y: ProjectivePoint,
  message: bigint,
  random: bigint,
): ElGamalEncryption {
  if (message === 0n) {
    const L = y.multiplyUnsafe(random);
    const R = GENERATOR.multiplyUnsafe(random);
    return { L, R };
  }
  const L = GENERATOR.multiply(message).add(y.multiplyUnsafe(random));
  const R = GENERATOR.multiplyUnsafe(random);
  return { L, R };
}

interface ElGamalProof {
  AL: ProjectivePoint;
  AR: ProjectivePoint;
  c: bigint;
  sb: bigint;
  sr: bigint;
}

export function proveElGammal(
  message: bigint,
  random: bigint,
  y: ProjectivePoint,
  g1: ProjectivePoint,
  g2: ProjectivePoint,
  deps: Dependencies = defaultDeps
): ElGamalProof {
  const { generateRandom, challengeCommits } = deps;

  const L = g1.multiply(message).add(y.multiplyUnsafe(random));
  const R = g1.multiplyUnsafe(random);

  const k = generateRandom();

  const AR = R.multiplyUnsafe(0n).add(g1.multiplyUnsafe(k));
  const AL = L.multiplyUnsafe(0n).add(g1.multiplyUnsafe(k)).add(y.multiplyUnsafe(k));

  const c = challengeCommits(0n, [AL, AR]);

  const sr = (k + c * random) % CURVE_ORDER;
  const sb = (k + c * message) % CURVE_ORDER;

  return { AL, AR, c, sb, sr };
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

export function poe(
  y: ProjectivePoint,
  base: ProjectivePoint,
  A: ProjectivePoint,
  c: bigint,
  s: bigint,
) {
  return poeN(y, [base], A, c, [s])
}

export function provePoeN(
  scalars: bigint[],
  bases: ProjectivePoint[],
  deps: Dependencies = defaultDeps
): PoeProof {

  const { generateRandom, challengeCommits } = deps;

  // y = Σ (xᵢ · gᵢ)
  const y = zip(scalars, bases).reduce(
    (acc, [x, g]) => acc.add(g.multiply(x)),
    ProjectivePoint.ZERO
  );

  // generate randomizers kᵢ
  const ks = scalars.map(() => generateRandom());

  // A = Σ (kᵢ · gᵢ)
  const A = zip(ks, bases).reduce(
    (acc, [k, g]) => acc.add(g.multiply(k)),
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

export interface ProofOfBit {
  V: ProjectivePoint;
  A0: ProjectivePoint;
  A1: ProjectivePoint;
  c0: bigint;
  s0: bigint;
  s1: bigint;
}

function simulatePOE(
  y: ProjectivePoint,
  gen: ProjectivePoint,
  { generateRandom }: Dependencies = defaultDeps
) {
  const s = generateRandom();
  const c = generateRandom();
  const A = gen.multiplyUnsafe(s).subtract(y.multiplyUnsafe(c));
  return { A, c, s };
}

function _proveBit0(random: bigint, deps: Dependencies = defaultDeps): ProofOfBit {
  const { generateRandom, challengeCommits } = deps;

  const V = SECONDARY_GENERATOR.multiplyUnsafe(random);
  const V1 = V.subtract(GENERATOR);
  const { A: A1, c: c1, s: s1 } = simulatePOE(V1, SECONDARY_GENERATOR, deps);

  const k = generateRandom();
  const A0 = SECONDARY_GENERATOR.multiply(k);

  const c = challengeCommits(0n, [A0, A1]);
  const c0 = c ^ c1;
  const s0 = (k + c0 * random) % CURVE_ORDER;

  return { V, A0, A1, c0, s0, s1 };
}

function _proveBit1(random: bigint, deps: Dependencies = defaultDeps): ProofOfBit {
  const { generateRandom, challengeCommits } = deps;

  const V = GENERATOR.add(SECONDARY_GENERATOR.multiplyUnsafe(random));
  const V0 = V;
  const { A: A0, c: c0, s: s0 } = simulatePOE(V0, SECONDARY_GENERATOR, deps);

  const k = generateRandom();
  const A1 = SECONDARY_GENERATOR.multiply(k);

  const c = challengeCommits(0n, [A0, A1]);
  const c1 = c ^ c0;
  const s1 = (k + c1 * random) % CURVE_ORDER;

  return { V, A0, A1, c0, s0, s1 };
}

export function proveBit(bit: 0 | 1, random: bigint, deps: Dependencies = defaultDeps): ProofOfBit {
  return bit === 0 ? _proveBit0(random, deps) : _proveBit1(random, deps);
}

/// Proof of Bit: validate that a commited V = g**b h**r is the ciphertext of  either b=0 OR b=1.
/// If b = 0 then V = h**r and a proof of exponet for r is enought. If b=1 then V/g = h**r could be
/// also proven with a poe. This is combined in a OR statement and the protocol can valitates that
/// one of the cases is valid without leak which one is valid.
export function oneOrZero(pi: ProofOfBit, deps: Dependencies = defaultDeps) {
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
  deps: Dependencies = defaultDeps
): { r: bigint; proof: ProofOfBit[]; } {
  if (b >= 2 ** bits) {
    throw new Error("number not in range");
  }
  const b_bin: (0 | 1)[] = b
    .toString(2)
    .padStart(bits, "0")
    .split("")
    .map(Number)
    .map(x => x as (0 | 1))
    .reverse();
  const proof: ProofOfBit[] = [];
  let pow = 1n;
  let r = 0n;
  let i = 0;
  while (i < bits) {
    const r_inn = deps.generateRandom();
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
export function verifyRange(proof: ProofOfBit[], bits: number, deps: Dependencies = defaultDeps): ProjectivePoint {
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

// --------------------------------------- VERIFIER ------------------------------------------------
//Verifier

/// Proof that a cipherbalance is a well formed ElGammal encription of the form
/// (L, R) = (g1**b g2**r , g1**r). The sigma protocol consists in a poe and a poe2. Runs as follows:
///
/// P:  kb,kr <-- R        sends    AL = g1**kb g2**kr, AR=g1**kr
/// V:  c <-- R            sends    c
/// P:  sb = kb + c*b
/// P:  sr = kr + c*r      send s1, s1
/// The verifier asserts:
/// - g1**sr        == AR * (R**c)  (poe)
/// - g1**sb g2**sr == AL * (L**c)  (poe2)
/// 
/// EC_MUL: 5
/// EC_ADD: 3

export function verifyElGammal(
  L: ProjectivePoint,
  R: ProjectivePoint,
  g1: ProjectivePoint,
  g2: ProjectivePoint,
  AL: ProjectivePoint,
  AR: ProjectivePoint,
  c: bigint,
  sb: bigint,
  sr: bigint
): boolean {
  let res = poe(R, g1, AR, c, sr);
  if (res == false) {
    throw new Error("Failed poe for R");
  }

  res = poeN(L, [g1, g2], AL, c, [sb, sr])
  if (res == false) {
    throw new Error("Failed poe2 for L");
  }
  return true
}

/// Verifies that two valid ElGammal encryption (L1,R1) = (g**b y**r1, g**r1) and (L2, R2) = (g**b y**r2, g**r2) 
/// for the same publick key y=g**x encrypt the same balance. This is done by noting that
/// L1/L2 = y**r1/y**r2 = (R1/R2)**x. We need to prove a poe for Y=G**x with Y=L1/L2 and G=R1/R2
///
/// P:  k <-- R        sends    A=G**k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    send     s
/// The verifier asserts:
/// - G**sr == A * (Y**c)  (poe)
/// 
/// EC_MUL: 2
/// EC_ADD: 3
export function verifySameEncryptionSameKey(
  L1: ProjectivePoint,
  R1: ProjectivePoint,
  L2: ProjectivePoint,
  R2: ProjectivePoint,
  g: ProjectivePoint,
  A: ProjectivePoint,
  c: bigint,
  s: bigint
): boolean {
  if (R1.equals(R2)) {return L1.equals(L2)};
  let Y = L1.subtract(L2);
  let G = R1.subtract(R2);
  let res = poe(Y, G, A, c, s);
  if (res == false) {
    throw new Error("Q1");
  }
  return true
}

/// Verifies that two encription of an amount b for two different keys are valid and that they are indeed encrypting the same 
/// amount b. Note: We assume here that the two randoms r1 and r2 are known by the proover. If they are the same this could be a little more efficient.
/// (L1, R2) = (g**b y1**r1, g**r1),  (L2, R2) = (g**b y2**r2, g**r2). The protocol runs as follows
///
/// P:  kb,kr1,kr2 <-- R        sends    AL1=g**kb y1**kr1, AR1=g**kr1, AL2=g**kb y2**kr2, AR2=g**kr2
/// V:          c  <-- R        sends    c
/// P:  sb = kb  + c*b          send     sb
/// P:  sr1 = kr1 + c*r1        send     sr1
/// P:  sr2 = kr2 + c*r2        send     sr2
/// The verifier asserts:
///  - The correct encription of (L1,R1)
///  - The correct encription of (L2,R2)
/// 
/// EC_MUL: 10
/// EC_ADD: 6

export function verifySameEncryptionKnownRandom(
  L1: ProjectivePoint,
  R1: ProjectivePoint,
  L2: ProjectivePoint,
  R2: ProjectivePoint,
  g: ProjectivePoint,
  y1: ProjectivePoint,
  y2: ProjectivePoint,
  AL1: ProjectivePoint,
  AR1: ProjectivePoint,
  AL2: ProjectivePoint,
  AR2: ProjectivePoint,
  c: bigint,
  sb: bigint,
  sr1: bigint,
  sr2: bigint
) {
  if (R1.equals(R2)) {
    if (sr1 != sr2) {
      throw new Error("sr1 != sr2");
    }
    if (!AR1.equals(AR2)) {
      throw new Error("AR1 != AR2");
    }
  }
  try {
    if (!verifyElGammal(L1, R1, g, y1, AL1, AR1, c, sb, sr1)) {
      throw new Error("W1");
    }
  } catch (err) {
    throw new Error("W1", { cause: err });
  }
  
  try {
    if (!verifyElGammal(L2, R2, g, y2, AL2, AR2, c, sb, sr2)) {
      throw new Error("W2");
    }
  } catch (err) {
    throw new Error("W2", { cause: err });
  }
}

/// We want to show that the cipher balance that x can decryp but does not know the random (usual in cipherbalance stored),
/// encrypts the same ammount that a cipherbalance (L2,R2) given by x and encrypted to maybe another pubkey (ussualy to an auditor).
/// 
/// EC_MUL: 10
/// EC_ADD: 6

export function verifySameEncryptionUnknownRandom(
  L1: ProjectivePoint,
  R1: ProjectivePoint,
  L2: ProjectivePoint,
  R2: ProjectivePoint,
  g: ProjectivePoint,
  y1: ProjectivePoint,
  y2: ProjectivePoint,
  Ax: ProjectivePoint,
  AL1: ProjectivePoint,
  AL2: ProjectivePoint,
  AR2: ProjectivePoint,
  c: bigint,
  sb: bigint,
  sx: bigint,
  sr2: bigint
) {
  if (!poe(y1, g, Ax, c, sx)) {
    throw new Error("E1");
  }
  if (!poeN(L1, [g, R1], AL1, c, [sb, sx])) {
    throw new Error("E2");
  }
  try {
    if (!verifyElGammal(L2, R2, g, y2, AL2, AR2, c, sb, sr2)) {
      throw new Error("E3");
    }
  } catch (err) {
    throw new Error("E3 failed", { cause: err });
  }
}

// --------------------------------------- VERIFIER ------------------------------------------------

// --------------------------------------- PROVER ------------------------------------------------

export function proveSameEncryptionSameKey(
  L1: ProjectivePoint,
  R1: ProjectivePoint,
  L2: ProjectivePoint,
  R2: ProjectivePoint,
  x: bigint,
  deps: Dependencies = defaultDeps
) {
  const { generateRandom, challengeCommits } = deps;

  const Ydiff = L1.subtract(L2); // Not necessary for the prover
  const Gdiff = R1.subtract(R2);

  const k = generateRandom();
  const A = Gdiff.multiplyUnsafe(k);

  const c = challengeCommits(0n, [A]);

  const s = (k + c * x) % CURVE_ORDER;

  return { A, c, s };
}

export function proveSameEncryptionDiffKey(
  y1: ProjectivePoint,
  y2: ProjectivePoint,
  r1: bigint,
  r2: bigint,
  b: bigint,
  deps: Dependencies = defaultDeps
) {
  const { generateRandom, challengeCommits } = deps;
  
  const kb = generateRandom();
  const kr1 = generateRandom();
  const kr2 = generateRandom();

  const { L: AL1, R: AR1 } = elGamalEncryption(y1, kb, kr1);
  const { L: AL2, R: AR2 } = elGamalEncryption(y2, kb, kr2);

  const c = challengeCommits(0n, [AL1, AR1, AL2, AR2]);

  const sb = (kb + c * b) % CURVE_ORDER;
  const sr1 = (kr1 + c * r1) % CURVE_ORDER;
  const sr2 = (kr2 + c * r2) % CURVE_ORDER;

  return { AL1, AR1, AL2, AR2, c, sb, sr1, sr2 };
}

export function proveSameEncryptionDiffKeyUnknownRandom(
  y2: ProjectivePoint,
  R1: ProjectivePoint,
  x1: bigint,
  r2: bigint,
  b: bigint,
  deps: Dependencies = defaultDeps) {
  const { generateRandom, challengeCommits } = deps;

  const kx1 = generateRandom();
  const kb = generateRandom();
  const kr2 = generateRandom();

  const { L: AL1, R: _ } = elGamalEncryption(R1, kb, kx1);
  const { L: AL2, R: AR2 } = elGamalEncryption(y2, kb, kr2);
  const Ax = GENERATOR.multiply(kx1);
  const c = challengeCommits(0n, [Ax, AL1, R1, AL2, AR2]);

  const sx1 = (kx1 + c * x1) % CURVE_ORDER;
  const sb = (kb + c * b) % CURVE_ORDER;
  const sr2 = (kr2 + c * r2) % CURVE_ORDER;

  return { Ax, AL1, R1, AL2, AR2, c, sb, sx1, sr2 };
  }
// --------------------------------------- PROVER ------------------------------------------------