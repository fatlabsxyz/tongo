import {
  computeHashOnElements,
  pedersen,
  ProjectivePoint,
  utils,
} from "@scure/starknet";
import { poseidonHashMany } from "@scure/starknet"

import { writeFileSync } from 'fs';

import { Affine } from "./types.js";
import { CURVE_ORDER, GENERATOR, SECONDARY_GENERATOR } from "./constants.js";

import {poeN, proveRange, verifyRange, ProofOfBit} from "./homomorphic_encryption.js"
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

// ----------------------------------- ROLLOVER -------------------------------------------------
export interface InputsRollover {
    y: ProjectivePoint,
    nonce: bigint,
}

export interface ProofOfRollover {
  Ax: ProjectivePoint;
  sx: bigint;
}

export function proveRollover(
  x: bigint,
  nonce: bigint,
): { inputs: InputsRollover; proof: ProofOfRollover } {
  const rollover_selector = 8245928655720965490n;
  const y = GENERATOR.multiply(x);
  const inputs: InputsRollover = { y: y, nonce: nonce };

  const seq: bigint[] = [rollover_selector, y.toAffine().x, y.toAffine().y, nonce];
  const prefix = computePrefix(seq);

  const k = generateRandom()
  const Ax = GENERATOR.multiplyUnsafe(k);
  const c = challengeCommits2(prefix, [Ax]);
  const sx = (k + x * c) % CURVE_ORDER;

  const proof: ProofOfRollover = { Ax: Ax, sx: sx };
  return { inputs, proof };
}


export function verifyRollover(inputs: InputsRollover, proof: ProofOfRollover) {
  const rollover_selector = 8245928655720965490n;
  const seq: bigint[] = [
    rollover_selector,
    inputs.y.toAffine().x,
    inputs.y.toAffine().y,
    inputs.nonce,
  ];
  const prefix = computePrefix(seq);
  const c = challengeCommits2(prefix, [proof.Ax]);
  const res = poeN(inputs.y, [GENERATOR], proof.Ax, c, [proof.sx]);
  if (res == false) {
    throw new Error("verifyRollover failed");
  }
}

// ----------------------------------- ROLLOVER -------------------------------------------------

// -----------------------------  FUND -------------------------------------------------------
export interface InputsFund {
    y: ProjectivePoint;
    amount:bigint;
    nonce: bigint;
    currentBalance: CipherBalance,
    auxBalance: CipherBalance,
    auditorPubKey: ProjectivePoint,
    auditedBalance: CipherBalance,
}

function prefixFund(inputs: InputsFund): bigint {
  const fund_selector = 1718972004n;
    const seq: bigint[] = [
        fund_selector,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.amount,
        inputs.nonce,
        inputs.currentBalance.L.toAffine().x,
        inputs.currentBalance.L.toAffine().y,
        inputs.currentBalance.R.toAffine().x,
        inputs.currentBalance.R.toAffine().y,
        inputs.auxBalance.L.toAffine().x,
        inputs.auxBalance.L.toAffine().y,
        inputs.auxBalance.R.toAffine().x,
        inputs.auxBalance.R.toAffine().y,
        inputs.auditedBalance.L.toAffine().x,
        inputs.auditedBalance.L.toAffine().y,
        inputs.auditedBalance.R.toAffine().x,
        inputs.auditedBalance.R.toAffine().y,
        inputs.auditorPubKey.toAffine().x,
        inputs.auditorPubKey.toAffine().y,
    ];
    return computePrefix(seq);
}

//TODO: Add challenge computation
export interface ProofOfFund {
  Ax: ProjectivePoint;
  Ar: ProjectivePoint;
  Ab: ProjectivePoint;
  A_auditor: ProjectivePoint;
  AUX_A: ProjectivePoint;
  sx: bigint;
  sr: bigint;
  sb: bigint;
}

export function proveFund(
    x: bigint,
    amount:bigint,
    initialBalance:bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
    auditorPubKey: ProjectivePoint,
): { inputs: InputsFund; proof: ProofOfFund } {
  const y = GENERATOR.multiply(x);
    const r = generateRandom();
    const auxBalance = cipherBalance(y, initialBalance,r);
    const R = auxBalance.R;

    const auditedBalance = cipherBalance(auditorPubKey, initialBalance + amount, r);
    const R0 = currentBalance.R;
    const inputs: InputsFund = { y, nonce, amount, currentBalance,auxBalance, auditorPubKey, auditedBalance };

    const prefix = prefixFund(inputs);

  const kx = generateRandom()
  const kb = generateRandom()
  const kr = generateRandom()

  const Ax = GENERATOR.multiplyUnsafe(kx);
  const Ar = GENERATOR.multiplyUnsafe(kr);
  const Ab = GENERATOR.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
  const A_auditor = GENERATOR.multiplyUnsafe(kb).add(auditorPubKey.multiplyUnsafe(kr));
  const AUX_R = R0.subtract(R)
  const AUX_A = AUX_R.multiplyUnsafe(kx);

  const c = challengeCommits2(prefix, [Ax, Ar, Ab, A_auditor,AUX_A]);
  const sx = (kx + x * c) % CURVE_ORDER;
  const sr = (kr + r * c) % CURVE_ORDER;
  const sb = (kb + initialBalance * c) % CURVE_ORDER;

  const proof: ProofOfFund = { Ax, Ar, Ab, A_auditor, AUX_A, sx, sb,sr  };
  return { inputs, proof };
}


export function verifyFund(inputs: InputsFund, proof: ProofOfFund) {
    const prefix = prefixFund(inputs);
    const c = challengeCommits2(prefix, [proof.Ax, proof.Ar, proof.Ab, proof.A_auditor,proof.AUX_A]);
    
    const {L,R} = inputs.auxBalance;
    const {L:L_audit, R:R_audit} = inputs.auditedBalance;
    const {L:L0, R:R0} = inputs.currentBalance;
    //TODO: assert R == R_audit
    if (!R.equals(R_audit))  { throw new Error("R is not R_audit") }

  let res = poeN(inputs.y, [GENERATOR], proof.Ax, c, [proof.sx]);
  if (res == false) {
    throw new Error("verifyFund failed");
  }


  res = poeN(R, [GENERATOR], proof.Ar, c, [proof.sr]);
  if (res == false) {
    throw new Error("verifyFund failed");
  }

  res = poeN(L, [GENERATOR, inputs.y], proof.Ab, c, [proof.sb, proof.sr]);
  if (res == false) {
    throw new Error("error in poe2 fund");
  }

    const AUX_L_auditor =  L_audit.subtract(GENERATOR.multiplyUnsafe(inputs.amount));
  res = poeN(AUX_L_auditor, [GENERATOR, inputs.auditorPubKey], proof.A_auditor, c, [proof.sb, proof.sr]);
  if (res == false) {
    throw new Error("error in poe2 fund");
  }

  const AUX_L = L0.subtract(L);
  const AUX_R = R0.subtract(R);

  res = poeN(AUX_L, [AUX_R], proof.AUX_A, c, [proof.sx]);
  if (res == false) {
    throw new Error("verifyFund failed");
  }

}
// -----------------------------  FUND -------------------------------------------------------

// -----------------------------  RAGEQUIT  -------------------------------------------------------
export interface InputsRagequit {
  y: ProjectivePoint;
  nonce: bigint;
  to: bigint;
  amount: bigint;
  currentBalance: CipherBalance;
}

function prefixRagequit(inputs: InputsRagequit): bigint {
    const ragequit_selector= 8241982478457596276n;
    const seq: bigint[] = [
        ragequit_selector,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.nonce,
        inputs.to,
        inputs.amount,
        inputs.currentBalance.L.toAffine().x,
        inputs.currentBalance.L.toAffine().y,
        inputs.currentBalance.R.toAffine().x,
        inputs.currentBalance.R.toAffine().y,
    ];
    return computePrefix(seq);
}

export interface ProofOfRagequit {
  A_x: ProjectivePoint;
  A_cr: ProjectivePoint;
  s_x: bigint;
}


export function proveRagequit(
  x: bigint,
  currentBalance: CipherBalance,
  nonce: bigint,
  to: bigint,
  amount: bigint,
): { inputs: InputsRagequit; proof: ProofOfRagequit } {
  const y = GENERATOR.multiply(x);
  const inputs: InputsRagequit = {
    y: y,
    nonce: nonce,
    to: to,
    amount: amount,
    currentBalance: currentBalance,
  };
  const prefix = prefixRagequit(inputs);

  const k = generateRandom()
  const A_x = GENERATOR.multiplyUnsafe(k);

  const R = currentBalance.R;
  const A_cr = R.multiplyUnsafe(k);

  const c = challengeCommits2(prefix, [A_x, A_cr]);
  const s_x = (k + x * c) % CURVE_ORDER;

  const proof: ProofOfRagequit = { A_x: A_x, A_cr: A_cr, s_x: s_x };
  return { inputs, proof };
}


/// Proof of Ragequit: validate the proof needed for withdraw all balance b. The cipher balance is
/// (L, R) = ( g**b_0 * y **r, g**r). Note that L/g**b = y**r = (g**r)**x. So we can check for the
/// correct balance proving that we know the exponent x of y' = g'**x with y'=L/g**b and g'= g**r =
/// R. The protocol runs as follow:
/// P:  k <-- R        sends    Ax = g**k, Acr = R**k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    sends    s
/// The verifier asserts:
/// - g**s == Ax * (y**c)
/// - R**s == Acr * (L/g**b)**c
export function verifyRagequit(
  inputs: InputsRagequit,
  proof: ProofOfRagequit,
) {

  const prefix = prefixRagequit(inputs);
  const c = challengeCommits2(prefix, [proof.A_x, proof.A_cr]);

  let {L, R} = inputs.currentBalance;

  let res = poeN(inputs.y, [GENERATOR], proof.A_x, c, [proof.s_x]);
  if (res == false) {
    throw new Error("error in poe y");
  }

  const g_b = GENERATOR.multiplyUnsafe(inputs.amount);
  const Y = L.subtract(g_b);

  res = poeN(Y, [R], proof.A_cr, c, [proof.s_x]);
  if (res == false) {
    throw new Error("error in poe Y");
  }
}
// -----------------------------  WITHDRAW_ALL -------------------------------------------------------

// -----------------------------  WITHDRAW -------------------------------------------------------

export interface InputsWithdraw {
    y: ProjectivePoint;
    nonce: bigint;
    to: bigint;
    amount: bigint;
    auditorPubKey: ProjectivePoint,
    currentBalance: CipherBalance,
    auditedBalance: CipherBalance,
}

function prefixWithdraw(inputs: InputsWithdraw): bigint {
    const withdraw_selector = 8604536554778681719n;
    const seq: bigint[] = [
        withdraw_selector,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.nonce,
        inputs.to,
        inputs.amount,
        inputs.auditorPubKey.toAffine().x,
        inputs.auditorPubKey.toAffine().y,
        inputs.currentBalance.L.toAffine().x,
        inputs.currentBalance.L.toAffine().y,
        inputs.currentBalance.R.toAffine().x,
        inputs.currentBalance.R.toAffine().y,
        inputs.auditedBalance.L.toAffine().x,
        inputs.auditedBalance.L.toAffine().y,
        inputs.auditedBalance.R.toAffine().x,
        inputs.auditedBalance.R.toAffine().y,
  ];
    return computePrefix(seq);
}

export interface ProofOfWithdraw {
  A_x: ProjectivePoint;
  A_r: ProjectivePoint;
  A: ProjectivePoint;
  A_v: ProjectivePoint;
  A_auditor: ProjectivePoint;
  sx: bigint;
  sb: bigint;
  sr: bigint;
  range: ProofOfBit[];
}

export function proveWithdraw(
  x: bigint,
  initial_balance: bigint,
  amount: bigint,
  to: bigint,
  currentBalance: CipherBalance,
  nonce: bigint,
  auditorPubKey: ProjectivePoint,
): { inputs: InputsWithdraw; proof: ProofOfWithdraw } {
    const y = GENERATOR.multiply(x);
    const R = currentBalance.R;;
    const left =  initial_balance - amount;

    const { r, proof: range } = proveRange(left,32);
    const auditedBalance = cipherBalance(auditorPubKey, left, r);

    const inputs: InputsWithdraw = {
        y,
        nonce,
        currentBalance,
        to: to,
        amount: amount,
        auditorPubKey,
        auditedBalance,
    };

  const prefix = prefixWithdraw(inputs);

  const kb = generateRandom()
  const kx = generateRandom()
  const kr = generateRandom()

  const A_x = GENERATOR.multiplyUnsafe(kx);
  const A_r = GENERATOR.multiplyUnsafe(kr);
  const A = GENERATOR.multiplyUnsafe(kb).add(R.multiplyUnsafe(kx));
  const A_v = GENERATOR.multiplyUnsafe(kb).add(SECONDARY_GENERATOR.multiplyUnsafe(kr));
  const A_auditor = GENERATOR.multiplyUnsafe(kb).add(auditorPubKey.multiplyUnsafe(kr));

  const c = challengeCommits2(prefix, [A_x,A_r, A, A_v, A_auditor]);

  const sb = (kb + left * c) % CURVE_ORDER;
  const sx = (kx + x * c) % CURVE_ORDER;
  const sr = (kr + r * c) % CURVE_ORDER;

  const proof: ProofOfWithdraw = {
    A_x,
    A_r,
    A,
    A_v,
    A_auditor,
    sx,
    sb,
    sr,
    range,
  };
  return { inputs, proof };
}

export function verifyWithdraw(
  inputs: InputsWithdraw,
  proof: ProofOfWithdraw,
) {

  const prefix = prefixWithdraw(inputs);
  const c = challengeCommits2(prefix, [proof.A_x,proof.A_r, proof.A, proof.A_v,proof.A_auditor]);

    const {L:L0, R:R0} =inputs.currentBalance; 
    const {L:L_audit, R:R_audit} =inputs.auditedBalance; 
  let res = poeN(inputs.y, [GENERATOR], proof.A_x, c, [proof.sx]);
  if (res == false) {
    throw new Error("error in poe y");
  }

  res = poeN(R_audit, [GENERATOR], proof.A_r, c, [proof.sr]);
  if (res == false) {
    throw new Error("error in poe y");
  }

  res = poeN(L_audit, [GENERATOR, inputs.auditorPubKey], proof.A_auditor, c, [proof.sb, proof.sr]);
  if (res == false) {
    throw new Error("error in poe2 Bal");
  }

  const g_b = GENERATOR.multiplyUnsafe(inputs.amount);
  const Y = L0.subtract(g_b);

  res = poeN(Y, [GENERATOR, R0], proof.A, c, [proof.sb, proof.sx]);
  if (res == false) {
    throw new Error("error in poe2 Y");
  }

  const V = verifyRange(proof.range, 32);

  res = poeN(V, [GENERATOR, SECONDARY_GENERATOR], proof.A_v, c, [proof.sb, proof.sr]);
  if (res == false) {
    throw new Error("error in poe2 V");
  }
}
// -----------------------------  WITHDRAW -------------------------------------------------------

// -----------------------------  TRANSFER -------------------------------------------------------

export interface InputsTransfer {
    y: ProjectivePoint,
    y_bar: ProjectivePoint,
    nonce: bigint,
    auditorPubKey: ProjectivePoint,
    currentBalance: CipherBalance,
    transferBalance: CipherBalance,
    transferBalanceSelf: CipherBalance,
    auditedBalance: CipherBalance,
    auditedBalanceSelf: CipherBalance,
}

function prefixTransfer(inputs: InputsTransfer): bigint {
  const transfer_selector = 8390876182755042674n;
    const seq = [
        transfer_selector,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.y_bar.toAffine().x,
        inputs.y_bar.toAffine().y,
        inputs.nonce,
        inputs.auditorPubKey.toAffine().x,
        inputs.auditorPubKey.toAffine().y,
        inputs.currentBalance.L.toAffine().x,
        inputs.currentBalance.L.toAffine().y,
        inputs.currentBalance.R.toAffine().x,
        inputs.currentBalance.R.toAffine().y,
        inputs.transferBalance.L.toAffine().x,
        inputs.transferBalance.L.toAffine().y,
        inputs.transferBalance.R.toAffine().x,
        inputs.transferBalance.R.toAffine().y,
        inputs.transferBalanceSelf.L.toAffine().x,
        inputs.transferBalanceSelf.L.toAffine().y,
        inputs.transferBalanceSelf.R.toAffine().x,
        inputs.transferBalanceSelf.R.toAffine().y,
        inputs.auditedBalance.L.toAffine().x,
        inputs.auditedBalance.L.toAffine().y,
        inputs.auditedBalance.R.toAffine().x,
        inputs.auditedBalance.R.toAffine().y,
        inputs.auditedBalanceSelf.L.toAffine().x,
        inputs.auditedBalanceSelf.L.toAffine().y,
        inputs.auditedBalanceSelf.R.toAffine().x,
        inputs.auditedBalanceSelf.R.toAffine().y,

  ];
    return computePrefix(seq);
}

export interface ProofOfTransfer {
  A_x: ProjectivePoint;
  A_r: ProjectivePoint;
  A_r2: ProjectivePoint;
  A_b: ProjectivePoint;
  A_b2: ProjectivePoint;
  A_v: ProjectivePoint;
  A_v2: ProjectivePoint;
  A_bar: ProjectivePoint;
  A_audit: ProjectivePoint;
  A_self_audit: ProjectivePoint;
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
  b0: bigint,
  b: bigint,
  auditorPubKey: ProjectivePoint,
  currentBalance: CipherBalance,
  nonce: bigint,
): { inputs: InputsTransfer; proof: ProofOfTransfer } {
  const y = GENERATOR.multiply(x);

  const { r, proof: range } = proveRange(b, 32);
  const transferBalanceSelf = cipherBalance(y, b, r);
  const transferBalance = cipherBalance(y_bar, b, r);
  const auditedBalance = cipherBalance(auditorPubKey,b,r);

    const b_left = b0 - b;
  const { r: r2, proof: range2 } = proveRange( b_left, 32);
  const auditedBalanceSelf = cipherBalance(auditorPubKey,b_left,r2);

  const inputs: InputsTransfer = {
    y,
    y_bar,
    nonce,
    auditorPubKey,
    currentBalance, 
    transferBalance,
    transferBalanceSelf,
    auditedBalance,
    auditedBalanceSelf,
  };

  const prefix = prefixTransfer(inputs);

  const G = currentBalance.R.subtract(transferBalanceSelf.R);

  const kx = generateRandom()
  const kb = generateRandom()
  const kr = generateRandom()
  const kb2 = generateRandom()
  const kr2 = generateRandom()

  const A_x = GENERATOR.multiplyUnsafe(kx);
  const A_r = GENERATOR.multiplyUnsafe(kr);
  const A_r2 = GENERATOR.multiplyUnsafe(kr2);
  const A_b = GENERATOR.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
  const A_bar = GENERATOR.multiplyUnsafe(kb).add(y_bar.multiplyUnsafe(kr));
  const A_audit = GENERATOR.multiplyUnsafe(kb).add(auditorPubKey.multiplyUnsafe(kr));
  const A_v = GENERATOR.multiplyUnsafe(kb).add(SECONDARY_GENERATOR.multiplyUnsafe(kr));
  const A_b2 = GENERATOR.multiplyUnsafe(kb2).add(G.multiplyUnsafe(kx));
  const A_v2 = GENERATOR.multiplyUnsafe(kb2).add(SECONDARY_GENERATOR.multiplyUnsafe(kr2));
  const A_self_audit = GENERATOR.multiplyUnsafe(kb2).add(auditorPubKey.multiplyUnsafe(kr2));

  const c = challengeCommits2(prefix, [
    A_x,
    A_r,
    A_r2,
    A_b,
    A_b2,
    A_v,
    A_v2,
    A_bar,
    A_audit,
    A_self_audit,
  ]);

  const s_x = (kx + x * c) % CURVE_ORDER;
  const s_b = (kb + b * c) % CURVE_ORDER;
  const s_r = (kr + r * c) % CURVE_ORDER;
  const s_b2 = (kb2 + b_left * c) % CURVE_ORDER;
  const s_r2 = (kr2 + r2 * c) % CURVE_ORDER;

  const proof: ProofOfTransfer = {
    A_x,
    A_r,
    A_r2,
    A_b,
    A_b2,
    A_v,
    A_v2,
    A_bar,
    A_audit,
    A_self_audit,
    s_x,
    s_r,
    s_b,
    s_b2,
    s_r2,
    range,
    range2,
  };

  return { inputs, proof };
}


/// Transfer b from y = g**x to y_bar.  Public inputs: y, y_bar L = g**b y**r, L_bar = g**b
/// y_bar**r, R = g**r.
/// We need to prove:
/// 1) knowledge of x in y = g**x.
/// 2) knowledge of r in R = g**r.
/// 3) knowledge of b and r in L = g**b y**r with the same r that 2)
/// 4) knowledge of b and r in L_bar = g**b y_bar**r with the same r that 2) and same b that 3)
/// 4b) knowlede of b and r in L_audit = g**b y_audit**r with the same r that 2) and same b that 3)
/// 5) b is in range [0,2**n-1]. For this we commit V = g**b h**r and an array of n  V_i = g**bi
/// h**ri. r = sum 2**i r_i 5b) proof that bi are either 0 or 1.
/// 5c) knowledge of b and r in V = g**b y**r with the same r that 2) and b that 3)
/// 6) The proof necessary to show that the remaining balance is in range.
/// TODO: finish the doc
export function verifyTransfer(
  inputs: InputsTransfer,
  proof: ProofOfTransfer,
) {
    const prefix = prefixTransfer(inputs);
  const c = challengeCommits2(prefix, [
    proof.A_x,
    proof.A_r,
    proof.A_r2,
    proof.A_b,
    proof.A_b2,
    proof.A_v,
    proof.A_v2,
    proof.A_bar,
    proof.A_audit,
    proof.A_self_audit,
  ]);

    const {L:CL, R:CR} = inputs.currentBalance;
    const {L, R} = inputs.transferBalanceSelf;
    const {L:L_bar, R:_R_bar} = inputs.transferBalance;
    const {L: L_audit, R: _R_audit} = inputs.auditedBalance;

    const {L: L_audit_self, R: R_audit_self} = inputs.auditedBalanceSelf;
    //TODO assert R == R_bar == R_audit

  let res = poeN(inputs.y, [GENERATOR], proof.A_x, c, [proof.s_x]);
  if (res == false) {
    throw new Error("error in poe for y");
  }

  res = poeN(R, [GENERATOR], proof.A_r, c, [proof.s_r]);
  if (res == false) {
    throw new Error("error in poe for R");
  }

  res = poeN(L, [GENERATOR, inputs.y], proof.A_b, c, [proof.s_b, proof.s_r]);
  if (res == false) {
    throw new Error("error in poe2 for L");
  }

  res = poeN(
    L_bar,
    [GENERATOR,
    inputs.y_bar],
    proof.A_bar,
    c,
    [proof.s_b,
    proof.s_r],
  );
  if (res == false) {
    throw new Error("error in poe2 for L_bar");
  }

  res = poeN(L_audit, [GENERATOR, inputs.auditorPubKey], proof.A_audit, c, [proof.s_b, proof.s_r]);
  if (res == false) {
    throw new Error("error in pore2 for L_audit");
  }

  res = poeN(R_audit_self, [GENERATOR], proof.A_r2, c, [proof.s_r2]);
  if (res == false) {
    throw new Error("error in poe for R_audit_self");
  }

  res = poeN(L_audit_self, [GENERATOR, inputs.auditorPubKey], proof.A_self_audit, c, [proof.s_b2, proof.s_r2]);
  if (res == false) {
    throw new Error("error in pore2 for L_audit_self");
  }

  const V = verifyRange(proof.range, 32);
  res = poeN(V, [GENERATOR, SECONDARY_GENERATOR], proof.A_v, c, [proof.s_b, proof.s_r]);
  if (res == false) {
    throw new Error("erro in poe2 for V");
  }

  const Y = CL.subtract(L);
  const G = CR.subtract(R);
  res = poeN(Y, [GENERATOR, G], proof.A_b2, c, [proof.s_b2, proof.s_x]);
  if (res == false) {
    throw new Error("error in poe2 for Y");
  }

  const V2 = verifyRange(proof.range2, 32);
  res = poeN(V2, [GENERATOR, SECONDARY_GENERATOR], proof.A_v2, c, [proof.s_b2, proof.s_r2]);
  if (res == false) {
    throw new Error("error in poe2 for V2");
  }
}
// -----------------------------  TRANSFER -------------------------------------------------------

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
    const y = GENERATOR.multiply(x)
    const b = decipherBalance(x, TL,TR)
    const r = generateRandom()
    const {L,R} = cipherBalance(y,b,r)
    const {L:L_bar,R: _R_bar} = cipherBalance(y_bar,b,r)
    const inputs: InputsExPost = {y, y_bar, L, L_bar, R, TL,TR}

    const kx = generateRandom()
    const kr = generateRandom()
    const kb = generateRandom()

    const Ax = GENERATOR.multiplyUnsafe(kx)
    const Ar = GENERATOR.multiplyUnsafe(kr)

    const A = GENERATOR.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
    const A_bar = GENERATOR.multiplyUnsafe(kb).add(y_bar.multiplyUnsafe(kr));

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
    poeN(inputs.y, [GENERATOR], proof.Ax, c, [proof.sx])
    poeN(inputs.R, [GENERATOR], proof.Ar, c, [proof.sr])
    const Y = inputs.TL.subtract(inputs.L);
    const G = inputs.TR.subtract(inputs.R);
    poeN(Y, [G], proof.At, c, [proof.sx])
    poeN(inputs.L, [GENERATOR ,inputs.y], proof.A, c, [proof.sb, proof.sr])
    poeN(inputs.L_bar, [GENERATOR, inputs.y_bar], proof.A, c, [proof.sb, proof.sr])
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

//This function coincides with cairo compure_prefix
export function computePrefix(seq: bigint[]) {
    return poseidonHashMany(seq)
//   return PED2([0n, ...seq]);
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
  let temp = GENERATOR;
  if (temp.equals(g_b)) {
    return 1n;
  }
  while (b < 2 ** 32) {
    b = b + 1n;
    temp = temp.add(GENERATOR);
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
  const candidate_g_b = GENERATOR.multiply(balance);
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
  let b = findLeastBits(GENERATOR, g_b, precomputed);
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
  let hashed = createHashMap(GENERATOR);
  let entries = Array.from(hashed.entries())
    .map(([k, v]) => {
      const keyStr = JSON.stringify(k);
      const valStr = typeof v === 'bigint' ? `"${v.toString()}"` : JSON.stringify(v);
      return `[${keyStr}, ${valStr}]`;
    })
    .join(',\n');
    let tsCode = `export const hash_map = new Map([\n${entries}\n]);\n`;
    writeFileSync("src/map.ts", tsCode, "utf8");
    console.log("TypeScript file generated at src/map.ts");
}

