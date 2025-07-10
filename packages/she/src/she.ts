import {
  computeHashOnElements,
  pedersen,
  ProjectivePoint,
  utils,
} from "@scure/starknet";

import { writeFileSync } from 'fs';

import { Affine } from "./types.js";
import { CURVE_ORDER, g, h, view } from "./constants.js";


export function encrypt(sc: bigint): Affine {
  return g.multiplyUnsafe(sc).toAffine();
}

// ----------------------------------- POE -------------------------------------------------
/// Proof of Exponent: validate a proof of knowledge of the exponent y = g ** x. The sigma protocol
/// runs as follow: 
/// P:  k <-- R        sends    A = g ** k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    sends    s
/// The verifier asserts:
/// - g**s == A * (y**c)
export function poe(
  y: ProjectivePoint,
  g: ProjectivePoint,
  A: ProjectivePoint,
  c: bigint,
  s: bigint,
) {
  const LHS = g.multiplyUnsafe(s);
  const RHS = A.add(y.multiplyUnsafe(c));
  return LHS.equals(RHS);
}

export function provePoe(x: bigint, g: ProjectivePoint) {
  const y = g.multiply(x);
  const k = generateRandom()
  const A = g.multiplyUnsafe(k);
  const c = challengeCommits2(0n, [A]);
  const s = (k + x * c) % CURVE_ORDER;
  return { y, A, s };
}

export function verifyPoe(
  y: ProjectivePoint,
  g: ProjectivePoint,
  A: ProjectivePoint,
  s: bigint,
) {
  const c = challengeCommits2(0n, [A]);
  const res = poe(y, g, A, c, s);
  if (res == false) {
    throw new Error("nope");
  }
}
// ----------------------------------- POE -------------------------------------------------

// ----------------------------------- POE2 -------------------------------------------------
/// Proof of Exponent 2: validate a proof of knowledge of the exponent y = g1**x1 g2**x2. The sigma
/// protocol runs as follows:
/// P:  k1,k2 <-- R        sends    A = g1**k1 g2**k2
/// V:  c <-- R            sends    c
/// P:  s1 = k1 + c*x1
/// P:  s2 = k2 + c*x1      send s1, s1
/// The verifier asserts:
/// - g1**s1 g2**s2 == A * (y**c)
function poe2(
  y: ProjectivePoint,
  g1: ProjectivePoint,
  g2: ProjectivePoint,
  A: ProjectivePoint,
  c: bigint,
  s1: bigint,
  s2: bigint,
) {
  const LHS = g1.multiplyUnsafe(s1).add(g2.multiplyUnsafe(s2));
  const RHS = A.add(y.multiplyUnsafe(c));
  return LHS.equals(RHS);
}

export function provePoe2(
  x1: bigint,
  x2: bigint,
  g1: ProjectivePoint,
  g2: ProjectivePoint,
) {
  const y = g1.multiply(x1).add(g2.multiply(x2));
  const k1 = generateRandom()
  const k2 = generateRandom()
  const A = g1.multiplyUnsafe(k1).add(g2.multiplyUnsafe(k2));
  const c = challengeCommits2(0n, [A]);
  const s1 = (k1 + x1 * c) % CURVE_ORDER;
  const s2 = (k2 + x2 * c) % CURVE_ORDER;
  return { y, A, s1, s2 };
}

export function verifyPoe2(
  y: ProjectivePoint,
  g1: ProjectivePoint,
  g2: ProjectivePoint,
  A: ProjectivePoint,
  s1: bigint,
  s2: bigint,
) {
  const c = challengeCommits2(0n, [A]);
  const res = poe2(y, g1, g2, A, c, s1, s2);
  if (res == false) {
    throw new Error("nope");
  }
}
// ----------------------------------- POE2 -------------------------------------------------

export function cipherBalance(
  y: ProjectivePoint,
  amount: bigint,
  random: bigint,
) {
  const L = g.multiply(amount).add(y.multiplyUnsafe(random));
  const R = g.multiplyUnsafe(random);
  return { L, R };
}

// -----------------------------  FUND -------------------------------------------------------
export interface InputsFund {
  y: ProjectivePoint;
  nonce: bigint;
}

export interface ProofOfFund {
  Ax: ProjectivePoint;
  sx: bigint;
}

export function proveFund(
  x: bigint,
  nonce: bigint,
): { inputs: InputsFund; proof: ProofOfFund } {
  const fund_selector = 1718972004n;
  const y = g.multiply(x);
  const inputs: InputsFund = { y: y, nonce: nonce };

  const seq: bigint[] = [fund_selector, y.toAffine().x, y.toAffine().y, nonce];
  const prefix = computePrefix(seq);

  const k = generateRandom()
  const Ax = g.multiplyUnsafe(k);
  const c = challengeCommits2(prefix, [Ax]);
  const sx = (k + x * c) % CURVE_ORDER;

  const proof: ProofOfFund = { Ax: Ax, sx: sx };
  return { inputs, proof };
}

export function verifyFund(inputs: InputsFund, proof: ProofOfFund) {
  const fund_selector = 1718972004n;
  const seq: bigint[] = [
    fund_selector,
    inputs.y.toAffine().x,
    inputs.y.toAffine().y,
    inputs.nonce,
  ];
  const prefix = computePrefix(seq);
  const c = challengeCommits2(prefix, [proof.Ax]);
  const res = poe(inputs.y, g, proof.Ax, c, proof.sx);
  if (res == false) {
    throw new Error("verifyFund failed");
  }
}
// -----------------------------  FUND -------------------------------------------------------

// -----------------------------  WITHDRAW_ALL -------------------------------------------------------
export interface InputsWithdraw {
  y: ProjectivePoint;
  nonce: bigint;
  to: bigint;
  amount: bigint;
  L: ProjectivePoint;
  R: ProjectivePoint;
}

export interface ProofOfWithdrawAll {
  A_x: ProjectivePoint;
  A_cr: ProjectivePoint;
  s_x: bigint;
}


export function proveWithdrawAll(
  x: bigint,
  CL: ProjectivePoint,
  CR: ProjectivePoint,
  nonce: bigint,
  to: bigint,
  amount: bigint,
): { inputs: InputsWithdraw; proof: ProofOfWithdrawAll } {
  const withdraw_all_selector = 36956203100010950502698282092n;
  const y = g.multiply(x);
  const inputs: InputsWithdraw = {
    y: y,
    nonce: nonce,
    to: to,
    amount: amount,
    L: CL,
    R: CR,
  };
  //to: ContractAddress
  const seq: bigint[] = [
    withdraw_all_selector,
    y.toAffine().x,
    y.toAffine().y,
    to,
    nonce,
  ];
  const prefix = computePrefix(seq);

  const k = generateRandom()
  const R = CR;
  const A_x = g.multiplyUnsafe(k);
  const A_cr = R.multiplyUnsafe(k);

  const c = challengeCommits2(prefix, [A_x, A_cr]);
  const s_x = (k + x * c) % CURVE_ORDER;

  const proof: ProofOfWithdrawAll = { A_x: A_x, A_cr: A_cr, s_x: s_x };
  return { inputs, proof };
}


/// Proof of Withdraw All: validate the proof needed for withdraw all balance b. The cipher balance is
/// (L, R) = ( g**b_0 * y **r, g**r). Note that L/g**b = y**r = (g**r)**x. So we can check for the
/// correct balance proving that we know the exponent x of y' = g'**x with y'=L/g**b and g'= g**r =
/// R. The protocol runs as follow:
/// P:  k <-- R        sends    Ax = g**k, Acr = R**k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    sends    s
/// The verifier asserts:
/// - g**s == Ax * (y**c)
/// - R**s == Acr * (L/g**b)**c
export function verifyWithdrawAll(
  inputs: InputsWithdraw,
  proof: ProofOfWithdrawAll,
) {
  const withdraw_all_selector = 36956203100010950502698282092n;
  const seq: bigint[] = [
    withdraw_all_selector,
    inputs.y.toAffine().x,
    inputs.y.toAffine().y,
    inputs.to,
    inputs.nonce,
  ];
  const prefix = computePrefix(seq);
  const c = challengeCommits2(prefix, [proof.A_x, proof.A_cr]);

  let res = poe(inputs.y, g, proof.A_x, c, proof.s_x);
  if (res == false) {
    throw new Error("error in poe y");
  }

  const g_b = g.multiplyUnsafe(inputs.amount);
  const Y = inputs.L.subtract(g_b);

  res = poe(Y, inputs.R, proof.A_cr, c, proof.s_x);
  if (res == false) {
    throw new Error("error in poe Y");
  }
}
// -----------------------------  WITHDRAW_ALL -------------------------------------------------------

// -----------------------------  WITHDRAW -------------------------------------------------------
export interface ProofOfWithdraw {
  A_x: ProjectivePoint;
  A: ProjectivePoint;
  A_v: ProjectivePoint;
  sx: bigint;
  sb: bigint;
  sr: bigint;
  range: ProofOfBit[];
}

export function proveWithdraw(
  x: bigint,
  initial_balance: bigint,
  amount: bigint,
  CL: ProjectivePoint,
  CR: ProjectivePoint,
  to: bigint,
  nonce: bigint,
): { inputs: InputsWithdraw; proof: ProofOfWithdraw } {
  const withdraw_selector = 8604536554778681719n;
  const y = g.multiply(x);
  const inputs: InputsWithdraw = {
    y: y,
    nonce: nonce,
    L: CL,
    R: CR,
    to: to,
    amount: amount,
  };

  //to: ContractAddress
  const seq: bigint[] = [
    withdraw_selector,
    y.toAffine().x,
    y.toAffine().y,
    to,
    nonce,
  ];
  const prefix = computePrefix(seq);

  const left = initial_balance - amount;
  const { r, proof: range } = proveRange(left,32);

  const kb = generateRandom()
  const kx = generateRandom()
  const kr = generateRandom()

  const R = CR;
  const Ax = g.multiplyUnsafe(kx);
  const A = g.multiplyUnsafe(kb).add(R.multiplyUnsafe(kx));
  const Av = g.multiplyUnsafe(kb).add(h.multiplyUnsafe(kr));

  const c = challengeCommits2(prefix, [Ax, A, Av]);

  const sb = (kb + left * c) % CURVE_ORDER;
  const sx = (kx + x * c) % CURVE_ORDER;
  const sr = (kr + r * c) % CURVE_ORDER;

  const proof: ProofOfWithdraw = {
    A_x: Ax,
    A: A,
    A_v: Av,
    sx: sx,
    sb: sb,
    sr: sr,
    range: range,
  };
  return { inputs, proof };
}

export function verifyWithdraw(
  inputs: InputsWithdraw,
  proof: ProofOfWithdraw,
) {
  const withdraw_selector = 8604536554778681719n;
  const seq: bigint[] = [
    withdraw_selector,
    inputs.y.toAffine().x,
    inputs.y.toAffine().y,
    inputs.to,
    inputs.nonce,
  ];
  const prefix = computePrefix(seq);
  const c = challengeCommits2(prefix, [proof.A_x, proof.A, proof.A_v]);

  let res = poe(inputs.y, g, proof.A_x, c, proof.sx);
  if (res == false) {
    throw new Error("error in poe y");
  }

  const g_b = g.multiplyUnsafe(inputs.amount);
  const Y = inputs.L.subtract(g_b);

  res = poe2(Y, g, inputs.R, proof.A, c, proof.sb, proof.sx);
  if (res == false) {
    throw new Error("error in poe2 Y");
  }

  const V = verifyRange(proof.range, 32);

  res = poe2(V, g, h, proof.A_v, c, proof.sb, proof.sr);
  if (res == false) {
    throw new Error("error in poe2 V");
  }
}
// -----------------------------  WITHDRAW -------------------------------------------------------

// -----------------------------  TRANSFER -------------------------------------------------------

export interface InputsTransfer {
  y: ProjectivePoint;
  y_bar: ProjectivePoint;
  CL: ProjectivePoint;
  CR: ProjectivePoint;
  R: ProjectivePoint;
  L: ProjectivePoint;
  L_bar: ProjectivePoint;
  L_audit: ProjectivePoint;
  nonce: bigint;
}

export interface ProofOfTransfer {
  A_x: ProjectivePoint;
  A_r: ProjectivePoint;
  A_b: ProjectivePoint;
  A_b2: ProjectivePoint;
  A_v: ProjectivePoint;
  A_v2: ProjectivePoint;
  A_bar: ProjectivePoint;
  A_audit: ProjectivePoint;
  s_x: bigint;
  s_r: bigint;
  s_b: bigint;
  s_b2: bigint;
  s_r2: bigint;
  range: ProofOfBit[];
  range2: ProofOfBit[];
}

export function proveTransfer(
  x: bigint,
  y_bar: ProjectivePoint,
  initial_balance: bigint,
  amount: bigint,
  CL: ProjectivePoint,
  CR: ProjectivePoint,
  nonce: bigint,
): { inputs: InputsTransfer; proof: ProofOfTransfer } {
  const transfer_selector = 8390876182755042674n;
  const y = g.multiply(x);

  const { r, proof: range } = proveRange(amount, 32);
  const { L, R } = cipherBalance(y, amount, r);
  const L_bar = cipherBalance(y_bar, amount, r).L;
  const L_audit = cipherBalance(view, amount, r).L;

  const seq: bigint[] = [
    transfer_selector,
    y.toAffine().x,
    y.toAffine().y,
    y_bar.toAffine().x,
    y_bar.toAffine().y,
    L.toAffine().x,
    L.toAffine().y,
    R.toAffine().x,
    R.toAffine().y,
    nonce,
  ];
  const prefix = computePrefix(seq);

  const inputs: InputsTransfer = {
    y: y,
    y_bar: y_bar,
    CL: CL,
    CR: CR,
    nonce: nonce,
    L: L,
    R: R,
    L_bar: L_bar,
    L_audit: L_audit,
  };

  const b_left = initial_balance - amount;
  const { r: r2, proof: range2 } = proveRange( b_left, 32);
  const G = CR.subtract(R);

  const kx = generateRandom()
  const kb = generateRandom()
  const kr = generateRandom()
  const kb2 = generateRandom()
  const kr2 = generateRandom()

  const Ax = g.multiplyUnsafe(kx);
  const Ar = g.multiplyUnsafe(kr);
  const A_b = g.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
  const A_bar = g.multiplyUnsafe(kb).add(y_bar.multiplyUnsafe(kr));
  const A_audit = g.multiplyUnsafe(kb).add(view.multiplyUnsafe(kr));
  const A_v = g.multiplyUnsafe(kb).add(h.multiplyUnsafe(kr));
  const A_b2 = g.multiplyUnsafe(kb2).add(G.multiplyUnsafe(kx));
  const A_v2 = g.multiplyUnsafe(kb2).add(h.multiplyUnsafe(kr2));

  const c = challengeCommits2(prefix, [
    Ax,
    Ar,
    A_b,
    A_b2,
    A_v,
    A_v2,
    A_bar,
    A_audit,
  ]);

  const s_x = (kx + x * c) % CURVE_ORDER;
  const s_b = (kb + amount * c) % CURVE_ORDER;
  const s_r = (kr + r * c) % CURVE_ORDER;
  const s_b2 = (kb2 + b_left * c) % CURVE_ORDER;
  const s_r2 = (kr2 + r2 * c) % CURVE_ORDER;

  const proof: ProofOfTransfer = {
    A_x: Ax,
    A_r: Ar,
    A_b: A_b,
    A_b2: A_b2,
    A_v: A_v,
    A_v2: A_v2,
    A_bar: A_bar,
    A_audit: A_audit,
    s_x: s_x,
    s_r: s_r,
    s_b: s_b,
    s_b2: s_b2,
    s_r2: s_r2,
    range: range,
    range2: range2,
  };
  return { inputs, proof };
}


/// Transfer b from y = g**x to y_bar.  Public inputs: y, y_bar L = g**b y**r, L_bar = g**b
/// y_bar**r, R = g**r.
/// We need to prove:
/// 1) knowlede of x in y = g**x.
/// 2) knowlede of r in R = g**r.
/// 3) knowlede of b and r in L = g**b y**r with the same r that 2)
/// 4) knowlede of b and r in L_bar = g**b y_bar**r with the same r that 2) and same b that 3)
/// 4b) knowlede of b and r in L_audit = g**b y_audit**r with the same r that 2) and same b that 3)
/// 5) b is in range [0,2**n-1]. For this we commit V = g**b h**r and an array of n  V_i = g**bi
/// h**ri. r = sum 2**i r_i 5b) proof that bi are either 0 or 1.
/// 5c) knowledge of b and r in V = g**b y**r with the same r that 2) and b that 3)
/// 6) The proof neceary to show that the remaining balance is in range.
/// TODO: finish the doc
export function verifyTransfer(
  inputs: InputsTransfer,
  proof: ProofOfTransfer,
) {
  const transfer_selector = 8390876182755042674n;
  const seq: bigint[] = [
    transfer_selector,
    inputs.y.toAffine().x,
    inputs.y.toAffine().y,
    inputs.y_bar.toAffine().x,
    inputs.y_bar.toAffine().y,
    inputs.L.toAffine().x,
    inputs.L.toAffine().y,
    inputs.R.toAffine().x,
    inputs.R.toAffine().y,
    inputs.nonce,
  ];
  const prefix = computePrefix(seq);
  const c = challengeCommits2(prefix, [
    proof.A_x,
    proof.A_r,
    proof.A_b,
    proof.A_b2,
    proof.A_v,
    proof.A_v2,
    proof.A_bar,
    proof.A_audit,
  ]);

  let res = poe(inputs.y, g, proof.A_x, c, proof.s_x);
  if (res == false) {
    throw new Error("error in poe for y");
  }

  res = poe(inputs.R, g, proof.A_r, c, proof.s_r);
  if (res == false) {
    throw new Error("error in poe for R");
  }

  res = poe2(inputs.L, g, inputs.y, proof.A_b, c, proof.s_b, proof.s_r);
  if (res == false) {
    throw new Error("error in poe2 for L");
  }

  res = poe2(
    inputs.L_bar,
    g,
    inputs.y_bar,
    proof.A_bar,
    c,
    proof.s_b,
    proof.s_r,
  );
  if (res == false) {
    throw new Error("error in poe2 for L_bar");
  }

  res = poe2(inputs.L_audit, g, view, proof.A_audit, c, proof.s_b, proof.s_r);
  if (res == false) {
    throw new Error("error in pore2 for L_audit");
  }

  const V = verifyRange(proof.range, 32);
  res = poe2(V, g, h, proof.A_v, c, proof.s_b, proof.s_r);
  if (res == false) {
    throw new Error("erro in poe2 for V");
  }

  const Y = inputs.CL.subtract(inputs.L);
  const G = inputs.CR.subtract(inputs.R);
  res = poe2(Y, g, G, proof.A_b2, c, proof.s_b2, proof.s_x);
  if (res == false) {
    throw new Error("error in poe2 for Y");
  }

  const V2 = verifyRange(proof.range2, 32);
  res = poe2(V2, g, h, proof.A_v2, c, proof.s_b2, proof.s_r2);
  if (res == false) {
    throw new Error("error in poe2 for V2");
  }
}
// -----------------------------  TRANSFER -------------------------------------------------------

// -------------------------- PROOF OF BIT ----------------------------------------------------

interface ProofOfBit {
  V: ProjectivePoint;
  A0: ProjectivePoint;
  A1: ProjectivePoint;
  c0: bigint;
  s0: bigint;
  s1: bigint;
}

function simPOE(y: ProjectivePoint, gen: ProjectivePoint) {
  const s = generateRandom()
  const c = generateRandom()
  const A = gen.multiplyUnsafe(s).subtract(y.multiplyUnsafe(c));
  return { A, c, s };
}

function _proveBit0(random: bigint): ProofOfBit {
    const V = h.multiplyUnsafe(random);
    const V_1 = V.subtract(g);
    const { A: A1, c: c1, s: s1 } = simPOE(V_1, h);

    const k = generateRandom()
    const A0 = h.multiplyUnsafe(k);

    const c = challengeCommits2(0n, [A0, A1]);
    const c0 = c ^ c1; //bitwisexor
    const s0 = (k + c0 * random) % CURVE_ORDER;

    return { V, A0, A1, c0, s0, s1 };
}

function _proveBit1 (random: bigint): ProofOfBit {
    const V = g.add(h.multiplyUnsafe(random));
    const V0 = V;
    const { A: A0, c: c0, s: s0 } = simPOE(V0, h);

    const k = generateRandom()
    const A1 = h.multiplyUnsafe(k);
    const c = challengeCommits2(0n, [A0, A1]);
    const c1 = c ^ c0; //bitwisexor
    const s1 = (k + c1 * random) % CURVE_ORDER;

    return { V, A0, A1, c0, s0, s1 };
}


function proveBit(bit: 0 | 1, random: bigint): ProofOfBit {
  if (bit == 0) {
    return _proveBit0(random)
  } else {
    return _proveBit1(random)
  }
}


/// Proof of Bit: validate that a commited V = g**b h**r is the ciphertext of  either b=0 OR b=1.
/// If b = 0 then V = h**r and a proof of exponet for r is enought. If b=1 then V/g = h**r could be
/// also proven with a poe. This is combined in a OR statement and the protocol can valitates that
/// one of the cases is valid without leak which one is valid.
function oneOrZero(pi: ProofOfBit) {
  const c = challengeCommits2(0n, [pi.A0, pi.A1]);
  const c1 = c ^ pi.c0;
  let res = poe(pi.V, h, pi.A0, pi.c0, pi.s0);
  if (res == false) {
    throw new Error("Failed 0 in proof of bit");
  }
  const V1 = pi.V.subtract(g);
  res = poe(V1, h, pi.A1, c1, pi.s1);
  if (res == false) {
    throw new Error("Failed 1 in proof of bit");
  }
}
// -------------------------- PROOF OF BIT ----------------------------------------------------

// --------------------------------------- RANGE ------------------------------------------------
function proveRange(
  b: bigint,
  bits: number,
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
    const r_inn = generateRandom()
    const pi = proveBit(b_bin[i]!, r_inn);
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
function verifyRange(proof: ProofOfBit[], bits: number): ProjectivePoint {
  let pi = proof[0]!;
  oneOrZero(pi);
  let V = pi.V;
  let pow = 2n;
  let i = 1;
  while (i < bits) {
    pi = proof[i]!;
    oneOrZero(pi);
    V = V.add(pi.V.multiplyUnsafe(pow));
    i = i + 1;
    pow = pow * 2n;
  }
  return V;
}
// --------------------------------------- RANGE ------------------------------------------------

// --------------------------------------- AUDIT EX POST ------------------------------------------------
export interface ProofExPost {
    Ax: ProjectivePoint,
    Ar: ProjectivePoint,
    At: ProjectivePoint,
    A: ProjectivePoint,
    A_bar: ProjectivePoint,
    sx: bigint,
    sb: bigint,
    sr: bigint,
}
export interface InputsExPost {
    y: ProjectivePoint,
    y_bar: ProjectivePoint,
    L: ProjectivePoint,
    L_bar: ProjectivePoint
    R: ProjectivePoint,
    TL: ProjectivePoint,
    TR: ProjectivePoint,
}

export function proveExpost(
    x:bigint,
    y_bar:ProjectivePoint,
    TL:ProjectivePoint,
    TR:ProjectivePoint
): {inputs: InputsExPost, proof:ProofExPost} {
    const y = g.multiply(x)
    const b = decipherBalance(x, TL,TR)
    const r = generateRandom()
    const {L,R} = cipherBalance(y,b,r)
    const {L:L_bar,R: R_bar} = cipherBalance(y_bar,b,r)
    const inputs: InputsExPost = {y, y_bar, L, L_bar, R, TL,TR}

    const kx = generateRandom()
    const kr = generateRandom()
    const kb = generateRandom()

    const Ax = g.multiplyUnsafe(kx)
    const Ar = g.multiplyUnsafe(kr)

    const A = g.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
    const A_bar = g.multiplyUnsafe(kb).add(y_bar.multiplyUnsafe(kr));

    const G = TR.subtract(R);
    const At = G.multiplyUnsafe(kx)

    const c = challengeCommits2(0n,[Ax,Ar,At,A,A_bar])

    const sx = (kx + x * c) % CURVE_ORDER;
    const sr = (kr + x * c) % CURVE_ORDER;
    const sb = (kb + x * c) % CURVE_ORDER;

    const proof: ProofExPost = {Ax, Ar, At, A, A_bar, sx,sr,sb}
    return {inputs, proof}
}
export function verifyExpost(inputs:InputsExPost, proof: ProofExPost) {
    const c = challengeCommits2(0n,[proof.Ax,proof.Ar,proof.At,proof.A,proof.A_bar])
    poe(inputs.y, g, proof.Ax, c, proof.sx)
    poe(inputs.R, g, proof.Ar, c, proof.sr)
    const Y = inputs.TL.subtract(inputs.L);
    const G = inputs.TR.subtract(inputs.R);
    poe(Y, G, proof.At, c, proof.sx)
    poe2(inputs.L,g,inputs.y,proof.A, c, proof.sb,proof.sr)
    poe2(inputs.L_bar,g,inputs.y_bar,proof.A, c, proof.sb,proof.sr)
}

// --------------------------------------- AUDIT EX POST ------------------------------------------------

/// Remember: hashing an array [Xn] has to be compared in cairo with the hash of H(0,X,1)
export function PED(elements: bigint[]) {
  return computeHashOnElements(elements);
}

/// This hash does not prepend the 0 and does not finalized with length
export const PED2 = (data: bigint[], fn = pedersen) =>
  data.reduce((x, y) => BigInt(fn(x, y)));

// This function coincides with cairo challengeCommits2
export function challengeCommits2(prefix: bigint, commits: ProjectivePoint[]) {
  const data: bigint[] = [prefix];
  commits.forEach((commit, _index) => {
    const temp = commit.toAffine();
    data.push(temp.x);
    data.push(temp.y);
  });

  const base = PED2(data);
  let salt = 1n;
  let c = CURVE_ORDER + 1n;
  while (c >= CURVE_ORDER) {
    c = PED2([base, salt]);
    salt = salt + 1n;
  }
  return c;
}

//This function coincides with cairo compure_prefix
export function computePrefix(seq: bigint[]) {
  return PED2([0n, ...seq]);
}

export function generateRandom(): bigint {
  const random_bytes = utils.randomPrivateKey();
  return utils.normPrivateKeyToScalar(random_bytes);
}

export function generateCairoRandom(
  seed: bigint,
  multiplicity: bigint,
): bigint {
  let salt = 1n;
  let c = CURVE_ORDER + 1n;
  while (c >= CURVE_ORDER) {
    c = PED2([seed, multiplicity, salt]);
    salt = salt + 1n;
  }
  return c;
}

export function decipherBalance(
  x: bigint,
  L: ProjectivePoint,
  R: ProjectivePoint,
): bigint {
  if (R.x === 0n || L.x === 0n) { return 0n }

  const Rx = R.multiply(x);
  if (Rx.equals(L)) { return 0n }

  const g_b = L.subtract(Rx);
  let b = 1n;
  let temp = g;
  if (temp.equals(g_b)) {
    return 1n;
  }
  while (b < 2 ** 32) {
    b = b + 1n;
    temp = temp.add(g);
    if (temp.equals(g_b)) {
      break;
    }
  }
  return b;
}

export function assertBalance(
  x: bigint,
  balance: bigint,
  L: ProjectivePoint,
  R: ProjectivePoint,
): boolean {

  // TODO: should throw error
  if (R.x === 0n || L.x === 0n) { return false }

  const Rx = R.multiply(x);
  // TODO: should throw error
  if (Rx.equals(L)) { return false }

  const g_b = L.subtract(Rx);
  const candidate_g_b = g.multiply(balance);
  return g_b.equals(candidate_g_b);
}

export function decipherBalanceOptimized(
  x: bigint,
  L: ProjectivePoint,
  R: ProjectivePoint,
  precomputed: Map<string, string>
): bigint {  
  const Rx = R.multiply(x);
    if (Rx.equals(L)) {return 0n}

  const g_b = L.subtract(Rx);
  let b = findLeastBits(g, g_b, precomputed);
  return b
}

function toKey(x: bigint, y: bigint): string {
  return `${x.toString()}_${(y % 2n).toString()}`;
}

export function createHashMap(g: ProjectivePoint): Map<string, bigint> {
  const precomputed = new Map<string, bigint>();
  const b = 2n ** 16n;

  let gb = g.multiply(b);
  let current = gb;
  precomputed.set(toKey(0n, 0n), 0n)
  for (let i = 1n; i < b; i++) {
    const key = toKey(current.x, current.y);
    precomputed.set(key, i);

    current = current.add(gb);  }

  return precomputed;
}

export function findLeastBits(
  g: ProjectivePoint,
  c: ProjectivePoint,
  precomputed: Map<string, string>
): bigint {
  const lim: bigint = 2n ** 16n;

  const g_neg = g.negate();
  let delta = g_neg;
  let current = c.add(delta);
  let c_prec = precomputed.get(toKey(c.x, c.y))
  if (c_prec !== undefined)
    {
      return BigInt(c_prec) * (2n ** 16n);
    };
  for (let i = 1n; i < lim; i++) {
    const key = toKey(current.x, current.y);
    const msb = precomputed.get(key);
    if (msb !== undefined) {
      return i + BigInt(msb) * (2n ** 16n);
    }
    current = current.add(delta);    
  }

  return 0n;
}

export function createAndSaveHashMap(): void {
  let hashed = createHashMap(g);
  let entries = Array.from(hashed.entries())
    .map(([k, v]) => {
      const keyStr = JSON.stringify(k);
      const valStr = typeof v === 'bigint' ? `"${v.toString()}"` : JSON.stringify(v);
      return `[${keyStr}, ${valStr}]`;
    })
    .join(',\n');
    let tsCode = `export const hash_map = new Map([\n${entries}\n]);\n`;
    writeFileSync("src/map.ts", tsCode, "utf8");
    console.log("✅ TypeScript file generated at src/map.ts");
}

