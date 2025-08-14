import {
  computeHashOnElements,
  pedersen,
  ProjectivePoint,
  utils,
} from "@scure/starknet";
import { poseidonHashMany } from "@scure/starknet";

import { writeFileSync } from 'fs';

import { Affine } from "./types.js";
import { CURVE_ORDER, GENERATOR, SECONDARY_GENERATOR } from "./constants.js";

import { poeN, proveRange, verifyRange, ProofOfBit } from "./homomorphic_encryption.js";
export function encrypt(sc: bigint): Affine {
  return GENERATOR.multiplyUnsafe(sc).toAffine();
}

/// Balances are encrypted with ElGammal, which consists in a tuple of curve points (L, R). Internally the points
/// are constructed with L = g**b y**r, R = g**r where g is the generator of the starknet curve, y is a pubkey, r is 
/// a random value and b is the balance to encrypt.
export interface CipherBalance {
  L: ProjectivePoint;
  R: ProjectivePoint;
}

/// Creates a new CipherBalance for the given amount and randomness under the given public key.
export function cipherBalance(
  y: ProjectivePoint,
  amount: bigint,
  random: bigint,
): CipherBalance {
  if (amount === 0n) {
    const L = y.multiplyUnsafe(random);
    const R = GENERATOR.multiplyUnsafe(random);
    return { L, R };
  }
  const L = GENERATOR.multiply(amount).add(y.multiplyUnsafe(random));
  const R = GENERATOR.multiplyUnsafe(random);
  return { L, R };
}

// ----------------------------------- POE -------------------------------------------------
/// Proof of Exponent: validate a proof of knowledge of the exponent y = g ** x. The sigma protocol
/// runs as follow: 
/// P:  k <-- R        sends    A = g ** k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    sends    s
/// The verifier asserts:
/// - g**s == A * (y**c)
///
/// EC_MUL: 2
/// EC_ADD: 1
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
  const k = generateRandom();
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
///
/// P:  k1,k2 <-- R        sends    A = g1**k1 g2**k2
/// V:  c <-- R            sends    c
/// P:  s1 = k1 + c*x1
/// P:  s2 = k2 + c*x2      send s1, s2
/// The verifier asserts:
/// - g1**s1 g2**s2 == A * (y**c)
///
/// EC_MUL: 3
/// EC_ADD: 2
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
  const k1 = generateRandom();
  const k2 = generateRandom();
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
/// Public inputs of the verifier for the rollover operation.
///
/// - y: The Tongo account to fund.
/// - nonce: The nonce of the Tongo account (from).
export interface InputsRollover {
  y: ProjectivePoint,
  nonce: bigint,
}

/// Proof of rollover operation.
export interface ProofOfRollover {
  Ax: ProjectivePoint;
  sx: bigint;
}

export function proveRollover(
  x: bigint,
  nonce: bigint,
): { inputs: InputsRollover; proof: ProofOfRollover; } {
  const rollover_selector = 8245928655720965490n;
  const y = GENERATOR.multiply(x);
  const inputs: InputsRollover = { y: y, nonce: nonce };

  const seq: bigint[] = [rollover_selector, y.toAffine().x, y.toAffine().y, nonce];
  const prefix = computePrefix(seq);

  const k = generateRandom();
  const Ax = GENERATOR.multiplyUnsafe(k);
  const c = challengeCommits2(prefix, [Ax]);
  const sx = (k + x * c) % CURVE_ORDER;

  const proof: ProofOfRollover = { Ax: Ax, sx: sx };
  return { inputs, proof };
}


/// Verify the rollover operation. In this case, users have to only show the knowledge
/// of the private key.
/// 
/// EC_MUL: 2
/// EC_ADD: 1
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
/// Public inputs of the verifier for the fund operation.
///
/// - y: The Tongo account to fund.
/// - amount: The ammount of tongo to fund.
/// - nonce: The nonce of the Tongo account (from).
/// - currentBalance: The current CipherBalance stored for the account. TODO: This is not needed anymore
export interface InputsFund {
    y: ProjectivePoint;
    amount:bigint;
    nonce: bigint;
    currentBalance: CipherBalance,
}

/// Computes the prefix by hashing some public inputs.
function prefixFund(inputs: InputsFund): bigint {
    /// There is no need to compute the hash of all elements.
    /// TODO: check this, read git issue
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
    ];
    return computePrefix(seq);
}

/// Proof of fund operation.
export interface ProofOfFund {
  Ax: ProjectivePoint;
  sx: bigint;
}

export function proveFund(
    x: bigint,
    amount:bigint,
    initialBalance:bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
):{
    inputs: InputsFund;
    proof: ProofOfFund;
    newBalance:CipherBalance;
}{
    const y = GENERATOR.multiply(x);
    const {L:L0, R:R0} = currentBalance;

    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x))
    const temp = GENERATOR.multiplyUnsafe(initialBalance)
    if (!g_b.equals(temp)) {throw new Error("storedBalance is not an encryption of balance")}; 

    const inputs: InputsFund = { y, nonce, amount, currentBalance};
    const prefix = prefixFund(inputs);

    const kx = generateRandom()
    const Ax = GENERATOR.multiplyUnsafe(kx);
    const c = challengeCommits2(prefix, [Ax]);

    const sx = (kx + x * c) % CURVE_ORDER;

    const proof: ProofOfFund = { Ax, sx };

    // compute the cipherbalance that y will have at the end of the fund 
    const cairo_string_fund = BigInt(0x66756e64);
    const cipher = cipherBalance(y, amount, cairo_string_fund);
    const newBalance: CipherBalance = {L: L0.add(cipher.L), R: R0.add(cipher.R)};

    return { inputs, proof, newBalance};
}


/// Verify the fund operation. In this case, users have to only show the knowledge
/// of the private key.
///
/// EC_MUL: 2
/// EC_ADD: 1
export function verifyFund(inputs: InputsFund, proof: ProofOfFund) {
    const prefix = prefixFund(inputs);
    const c = challengeCommits2(prefix, [proof.Ax]);

    let res = poe(inputs.y, GENERATOR, proof.Ax, c, proof.sx);
    if (res == false) {
        throw new Error("verifyFund failed");
    }
}
// -----------------------------  FUND -------------------------------------------------------

// -----------------------------  RAGEQUIT  -------------------------------------------------------
/// Public inputs of the verifier for the ragequit operation.
///
/// - y: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - to: The starknet contract address to send the funds to.
/// - amount: The ammount of tongo to ragequit (the total amount of tongos in the account).
/// - currentBalance: The current CipherBalance stored for the account. TODO: This is not needed anymore
export interface InputsRagequit {
  y: ProjectivePoint;
  nonce: bigint;
  to: bigint;
  amount: bigint;
  currentBalance: CipherBalance;
}

/// Computes the prefix by hashing some public inputs.
function prefixRagequit(inputs: InputsRagequit): bigint {
    /// There is no need to compute the hash of all elements.
    /// TODO: check this, read git issue
    const ragequit_selector = 8241982478457596276n;
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

/// Proof of ragequit operation.
/// TODO: remove _ in names?
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
): { inputs: InputsRagequit,  proof: ProofOfRagequit, newBalance:CipherBalance  } {

    const y = GENERATOR.multiply(x);
    const {L:L0, R:R0} = currentBalance;

    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x))
    const temp = GENERATOR.multiplyUnsafe(amount)
    if (!g_b.equals(temp)) {throw new Error("storedBalance is not an encryption of balance")}; 

    const G = R0.subtract(GENERATOR);

    const inputs: InputsRagequit = {
        y,
        nonce,
        to,
        amount,
        currentBalance,
    };
    const prefix = prefixRagequit(inputs);

    const k = generateRandom()
    const A_x = GENERATOR.multiplyUnsafe(k);
    const A_cr = G.multiplyUnsafe(k);

    const c = challengeCommits2(prefix, [A_x, A_cr]);
    const s_x = (k + x * c) % CURVE_ORDER;

    const proof: ProofOfRagequit = { A_x: A_x, A_cr: A_cr, s_x: s_x };

    const newBalance = cipherBalance(y, 0n, 1n);
    return { inputs, proof, newBalance};
}


/// Verifies the ragequit operation. First, ussers have to show knowledge of the private key. Then, users  have to provide 
/// a cleartext of the amount b stored in their balances. The contract will construct a cipher balance 
/// (L2, R2) = (g**b y, g) with randomness r=1. Users have to provide a zk proof that (L2,R2) is encrypting
/// the same amount that the stored cipher balance (L1,R1). This is done by noting that
/// L1/L2 = y**r1/y**r2 = (R1/R2)**x. We need to prove a poe for Y=G**x with Y=L1/L2 and G=R1/R2
///
/// P:  k <-- R        sends    A=G**k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    send     s
/// The verifier asserts:
/// - G**sr == A * (Y**c)
///
/// EC_MUL: 7
/// EC_ADD: 5
export function verifyRagequit(
  inputs: InputsRagequit,
  proof: ProofOfRagequit,
) {

  const prefix = prefixRagequit(inputs);
  const c = challengeCommits2(prefix, [proof.A_x, proof.A_cr]);

  let {L: L0, R:R0} = inputs.currentBalance;

  let res = poeN(inputs.y, [GENERATOR], proof.A_x, c, [proof.s_x]);
  if (res == false) {
    throw new Error("error in poe y");
  }

  const {L: L1, R: R1} = cipherBalance(inputs.y, inputs.amount, 1n); 

  const Y = L0.subtract(L1);
  const G = R0.subtract(R1);

  res = poe(Y, G, proof.A_cr, c, proof.s_x);
  if (res == false) {
    throw new Error("error in poe Y");
  }
}
// -----------------------------  RAGEQUIT  -------------------------------------------------------


// -----------------------------  WITHDRAW -------------------------------------------------------
/// Public inputs of the verifier for the withdarw operation.
///
/// - y: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - to: The starknet contract address to send the funds to.
/// - amount: The ammount of tongo to withdraw.
/// - currentBalance: The current CipherBalance stored for the account.
export interface InputsWithdraw {
    y: ProjectivePoint;
    nonce: bigint;
    to: bigint;
    amount: bigint;
    currentBalance: CipherBalance,
}

/// Computes the prefix by hashing some public inputs.
function prefixWithdraw(inputs: InputsWithdraw): bigint {
    /// There is no need to compute the hash of all elements.
    /// TODO: check this, read git issue
    const withdraw_selector = 8604536554778681719n;
    const seq: bigint[] = [
        withdraw_selector,
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

/// Proof of withdraw operation.
/// TODO: remove the _?
export interface ProofOfWithdraw {
    A_x: ProjectivePoint;
    A_r: ProjectivePoint;
    A: ProjectivePoint;
    A_v: ProjectivePoint;
    sx: bigint;
    sb: bigint;
    sr: bigint;
    R_aux:ProjectivePoint;
    range: ProofOfBit[];
}

export function proveWithdraw(
    x: bigint,
    initial_balance: bigint,
    amount: bigint,
    to: bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
):{
    inputs: InputsWithdraw;
    proof: ProofOfWithdraw
    newBalance: CipherBalance;
} {
    const y = GENERATOR.multiply(x);
    const {L:L0, R:R0} = currentBalance;
     
    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x))
    const temp = GENERATOR.multiplyUnsafe(initial_balance)
    if (!g_b.equals(temp)) {throw new Error("storedBalance is not an encryption of balance")}; 

    const left =  initial_balance - amount;

    const { r, proof: range } = proveRange(left,32);
    const R_aux = GENERATOR.multiply(r);

    const inputs: InputsWithdraw = {
        y,
        nonce,
        currentBalance,
        to,
        amount,
    };

    const prefix = prefixWithdraw(inputs);

    const kb = generateRandom()
    const kx = generateRandom()
    const kr = generateRandom()

    const A_x = GENERATOR.multiplyUnsafe(kx);
    const A_r = GENERATOR.multiplyUnsafe(kr);
    const A = GENERATOR.multiplyUnsafe(kb).add(R0.multiplyUnsafe(kx));
    const A_v = GENERATOR.multiplyUnsafe(kb).add(SECONDARY_GENERATOR.multiplyUnsafe(kr));

    const c = challengeCommits2(prefix, [A_x,A_r, A, A_v]);

    const sb = (kb + left * c) % CURVE_ORDER;
    const sx = (kx + x * c) % CURVE_ORDER;
    const sr = (kr + r * c) % CURVE_ORDER;

    const proof: ProofOfWithdraw = {
        A_x,
        A_r,
        A,
        A_v,
        sx,
        sb,
        sr,
        R_aux,
        range,
    };

    // compute the cipherbalance that y will have at the end of the withdraw 
    const cairo_string_withdraw = BigInt(8604536554778681719n);
    const cipher = cipherBalance(y, amount, cairo_string_withdraw);
    const newBalance: CipherBalance = {L: currentBalance.L.subtract(cipher.L), R: currentBalance.R.subtract(cipher.R)};

    return { inputs, proof, newBalance };
}

/// Verifies the withdraw operation. First, ussers have to show knowledge of the private key. Then, users  have to provide 
/// a cleartext of the amount b to withdraw. The contract will construct a cipher balance (L2, R2) = (g**b y**r2, g**r2)
/// with randomness r2='withdraw'. The contract will subtract (L2,R2) to the stored balance of the user. The user have
/// provide a zk proof that the final cipher balance is encrypting a positive (a value in (0, u**32)) amount b_left. To do
/// this when the RangeProof is verified, it returns a V = g**b_left h**r, with b_left positive. V is used as a L part of
/// a cipher blalance, users have to prove that the cipher balance (V, R_aux = g**r) is encrypting the same amount
/// that the final cipher balance.
///
/// EC_MUL: 12 + n*5 = 172 for u32 
/// EC_ADD: 8 + n*4  = 136 for u32
export function verifyWithdraw(
    inputs: InputsWithdraw,
    proof: ProofOfWithdraw,
) {
    const prefix = prefixWithdraw(inputs);
    const c = challengeCommits2(prefix, [proof.A_x,proof.A_r, proof.A, proof.A_v]);

    let res = poe(inputs.y, GENERATOR, proof.A_x, c, proof.sx);
    if (res == false) { throw new Error("error in poe y") }

    let {L:L0, R:R0} =inputs.currentBalance; 

    L0 = L0.subtract(GENERATOR.multiply(inputs.amount));

    res = poe2(L0, GENERATOR, R0, proof.A, c, proof.sb, proof.sx);
    if (res == false) { throw new Error("error in poe2 Y") }

    const V = verifyRange(proof.range, 32);
    res = poe2(V, GENERATOR, SECONDARY_GENERATOR, proof.A_v, c, proof.sb, proof.sr);
    if (res == false) { throw new Error("error in poe2 V") }
}
// -----------------------------  WITHDRAW -------------------------------------------------------

// -----------------------------  TRANSFER -------------------------------------------------------
/// Public inputs of the verifier for the transfer operation.
///
/// - y: The Tongo account to take tongos from.
/// - y_bar: The Tongo account to send tongos to.
/// - nonce: The nonce of the Tongo account (y).
/// - currentBalance: The current CipherBalance stored for the account (y)
/// - transferBalance: The amount to transfer encrypted for the pubkey of `y_bar`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `y`.
/// TODO: Change y/y_bar for from/to
export interface InputsTransfer {
    y: ProjectivePoint,
    y_bar: ProjectivePoint,
    nonce: bigint,
    currentBalance: CipherBalance,
    transferBalance: CipherBalance,
    transferBalanceSelf: CipherBalance,
}

/// Computes the prefix by hashing some public inputs.
function prefixTransfer(inputs: InputsTransfer): bigint {
    /// There is no need to compute the hash of all elements.
    /// TODO: check this, read git issue
    const transfer_selector = 8390876182755042674n;
    const seq = [
        transfer_selector,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.y_bar.toAffine().x,
        inputs.y_bar.toAffine().y,
        inputs.nonce,
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
    s_x: bigint;
    s_r: bigint;
    s_b: bigint;
    s_b2: bigint;
    s_r2: bigint;
    R_aux: ProjectivePoint,
    range: ProofOfBit[];
    R_aux2: ProjectivePoint,
    range2: ProofOfBit[];
}

export function proveTransfer(
    x: bigint,
    y_bar: ProjectivePoint,
    b0: bigint,
    b: bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
):{
    inputs: InputsTransfer;
    proof: ProofOfTransfer;
    newBalance: CipherBalance;
}{
    const y = GENERATOR.multiply(x);
    const {L:L0, R:R0} = currentBalance;

    const { r, proof: range } = proveRange(b, 32);
    const transferBalanceSelf = cipherBalance(y, b, r);
    const transferBalance = cipherBalance(y_bar, b, r);
    const R_aux = GENERATOR.multiply(r);

    const b_left = b0 - b;
    const { r: r2, proof: range2 } = proveRange( b_left, 32);
    const R_aux2 = GENERATOR.multiply(r2);

    const inputs: InputsTransfer = {
        y,
        y_bar,
        nonce,
        currentBalance, 
        transferBalance,
        transferBalanceSelf,
    };

    const prefix = prefixTransfer(inputs);

    const G = R0.subtract(transferBalanceSelf.R);

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
    const A_v = GENERATOR.multiplyUnsafe(kb).add(SECONDARY_GENERATOR.multiplyUnsafe(kr));
    const A_b2 = GENERATOR.multiplyUnsafe(kb2).add(G.multiplyUnsafe(kx));
    const A_v2 = GENERATOR.multiplyUnsafe(kb2).add(SECONDARY_GENERATOR.multiplyUnsafe(kr2));

    const c = challengeCommits2(prefix, [
        A_x,
        A_r,
        A_r2,
        A_b,
        A_b2,
        A_v,
        A_v2,
        A_bar,
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
        s_x,
        s_r,
        s_b,
        s_b2,
        s_r2,
        R_aux,
        range,
        R_aux2,
        range2,
    };
    
    const newBalance: CipherBalance = {L: L0.subtract(transferBalanceSelf.L), R: R0.subtract(transferBalanceSelf.R)};
    return { inputs, proof, newBalance };
}


/// Verifies the withdraw operation. First, ussers have to show knowledge of the private key. Then, users  have to provide 
/// two cipher balance, one (L,R) is a encryption of the transfer amount b under its public key, the other (L_bar, R_bar)
/// a encryption of the trasnfer amount b under the receiver public key. Users have to provide a ZK proof that both encryption
/// are indeed encrypting the same amount for the correct public keys. To show the transfer amount b is positive,
/// when the first RangeProof is verified, it returns a V1 = g**b h**r1, with b positive. V1 is used as a L part 
/// of a cipher blalance, users have to prove that the cipher balance (V1, R_aux1 = g**r1) is encrypting the same
/// amount that (L,R). The cipher balance after the operation would be (L0,R0) = (CL/L, CR/R) where (CL,CR) is the 
/// current balance. To show that (L0, R0) is encrypting an amount b_left positive, when the second RangeProof is
/// verified, it returns a V2 = g**b_left h**r2, with b_left positive. V2 is used as a L part 
/// of a cipher blalance, users have to prove that the cipher balance (V2, R_aux2 = g**r2) is encrypting the same
/// amount that (L0,R0)
///
/// EC_MUL: 27 + 2*n*5  = 347 for u32
/// EC_ADD: 18  + 2*n*4 = 274 for u32
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
    ]);

    const {L:CL, R:CR} = inputs.currentBalance;
    const {L, R} = inputs.transferBalanceSelf;
    const {L:L_bar, R:_R_bar} = inputs.transferBalance;


    let res = poe(inputs.y, GENERATOR, proof.A_x, c, proof.s_x);
    if (res == false) { throw new Error("error in poe for y") }

    res = poe(R, GENERATOR, proof.A_r, c, proof.s_r);
    if (res == false) { throw new Error("error in poe for R") }

    res = poe2(L, GENERATOR, inputs.y, proof.A_b, c, proof.s_b, proof.s_r);
    if (res == false) { throw new Error("error in poe2 for L"); }

    res = poe2(
        L_bar,
        GENERATOR,
        inputs.y_bar,
        proof.A_bar,
        c,
        proof.s_b,
        proof.s_r,
    );
    if (res == false) { throw new Error("error in poe2 for L_bar") }

    const V = verifyRange(proof.range, 32);
    res = poe2(V, GENERATOR, SECONDARY_GENERATOR, proof.A_v, c, proof.s_b, proof.s_r);
    if (res == false) { throw new Error("erro in poe2 for V") }

    const Y = CL.subtract(L);
    const G = CR.subtract(R);
    res = poe2(Y, GENERATOR, G, proof.A_b2, c, proof.s_b2, proof.s_x);
    if (res == false) { throw new Error("error in poe2 for Y") }

    const V2 = verifyRange(proof.range2, 32);
    res = poe2(V2, GENERATOR, SECONDARY_GENERATOR, proof.A_v2, c, proof.s_b2, proof.s_r2);
  if (res == false) { throw new Error("error in poe2 for V2") }
}
// -----------------------------  TRANSFER -------------------------------------------------------


// --------------------------------------- audit ------------------------------------------------
/// Public inputs of the verifier for the audit declaration
///
/// - y: The Tongo account that is declaring its balance.
/// - auditorPubKey: The current auditor public key.
/// - sotredBalance: The current CipherBalance stored for the account (y).
/// - auditedBalance: The balance of y encrypted under the auditor public key.
export interface InputsAudit {
    y: ProjectivePoint,
    storedBalance: CipherBalance,
    auditorPubKey: ProjectivePoint,
    auditedBalance: CipherBalance,
}

/// Proof of audit declaration
export interface ProofOfAudit {
    Ax: ProjectivePoint,
    AL0: ProjectivePoint,
    AL1: ProjectivePoint,
    AR1: ProjectivePoint,
    sx: bigint,
    sr: bigint,
    sb: bigint,
}

export function prove_audit(x: bigint, balance: bigint, storedBalance: CipherBalance, auditorPubKey: ProjectivePoint): {inputs:InputsAudit, proof: ProofOfAudit} {
    const y = GENERATOR.multiply(x);
    const { L: L0, R:R0} = storedBalance;

    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x))
    const temp = GENERATOR.multiplyUnsafe(balance)
    if (!g_b.equals(temp)) {throw new Error("storedBalance is not an encryption of balance")}; 
    //

    const r = generateRandom();
    const auditedBalance = cipherBalance(auditorPubKey, balance, r);
    const inputs: InputsAudit = {y, storedBalance, auditorPubKey, auditedBalance}
    //prefix 'audit'
    const prefix = BigInt(0x6175646974);

    const kx = generateRandom()
    const kb = generateRandom()
    const kr = generateRandom()

    const Ax = GENERATOR.multiplyUnsafe(kx);
    const AL0 = GENERATOR.multiplyUnsafe(kb).add(R0.multiplyUnsafe(kx));

    const AR1 = GENERATOR.multiplyUnsafe(kr);
    const AL1 = GENERATOR.multiplyUnsafe(kb).add(auditorPubKey.multiplyUnsafe(kr));
    const c = challengeCommits2(prefix,[Ax,AL0,AL1,AR1])

    const sx = (kx + x * c) % CURVE_ORDER;
    const sr = (kr + r * c) % CURVE_ORDER;
    const sb = (kb + balance * c) % CURVE_ORDER;

    const proof: ProofOfAudit = {Ax, AL0, AL1, AR1, sx, sb,sr};
    return {inputs, proof}
}


/// Verifies that the given ZK proof is a valid proof of the audit declaration. If the proof checks then the public 
/// inputs check
///
/// - The caller knows the private key of the Tongo account.
/// - The provided encryption is a valid encryption for the auditor key
/// - The provided encryption is encrypting the same amount encrypted in the current balance of the Tongo account.
export function verify_audit(inputs: InputsAudit, proof: ProofOfAudit) {
    const prefix = BigInt(0x6175646974);
    const c = challengeCommits2(prefix,[proof.Ax,proof.AL0,proof.AL1,proof.AR1])
    const {L: L0, R:R0} = inputs.storedBalance;
    const {L: L_audit, R:R_audit} = inputs.auditedBalance;

    let res = poe(inputs.y,GENERATOR,proof.Ax,c,proof.sx);
    if (res == false) { throw new Error("Failed 1 verify_audit"); }

    res = poe2(L0, GENERATOR, R0, proof.AL0, c, proof.sb,proof.sx);
    if (res == false) { throw new Error("Failed 2 verify_audit"); }

    res = poe(R_audit, GENERATOR, proof.AR1, c, proof.sr);
    if (res == false) { throw new Error("Failed 3 verify_audit"); }

    res = poe2(L_audit, GENERATOR, inputs.auditorPubKey, proof.AL1, c, proof.sb, proof.sr);
    if (res == false) { throw new Error("Failed 4 verify_audit"); }
}

// --------------------------------------- audit ------------------------------------------------

/// Remember: hashing an array [Xn] has to be compared in cairo with the hash of H(0,X,1)
export function PED(elements: bigint[]) {
  return computeHashOnElements(elements);
}

/// This hash does not prepend the 0 and does not finalized with length
export const PED2 = (data: bigint[], fn = pedersen) =>
  data.reduce((x, y) => BigInt(fn(x, y)));

/// This function coincides with cairo challengeCommits2
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
  return poseidonHashMany(seq);
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

/// Decipher the given cipher balance for with the given secret key.
/// This function has to bruteforce for b in g**b. It start at b = 0 and
/// ends in b= 2**32.
export function decipherBalance(
  x: bigint,
  L: ProjectivePoint,
  R: ProjectivePoint,
): bigint {

  const Rx = R.multiply(x);
  if (Rx.equals(L)) { return 0n; }

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
      return b;
    }
  }
  throw new Error('Decription of Cipherbalance has failed')
}

/// Asserts that the given CipherBalance is a correct encription for the public
/// key of the given private key x and the given balance.
export function assertBalance(
    x: bigint,
    balance: bigint,
    L: ProjectivePoint,
    R: ProjectivePoint,
): boolean {

  const Rx = R.multiply(x);
  const g_b = L.subtract(Rx);
  return g_b.equals(GENERATOR.multiplyUnsafe(balance));
}

export function decipherBalanceOptimized(
  x: bigint,
  L: ProjectivePoint,
  R: ProjectivePoint,
  precomputed: Map<string, string>
): bigint {
  const Rx = R.multiply(x);
  if (Rx.equals(L)) { return 0n; }

  const g_b = L.subtract(Rx);
  let b = findLeastBits(GENERATOR, g_b, precomputed);
  return b;
}

function toKey(x: bigint, y: bigint): string {
  return `${x.toString()}_${(y % 2n).toString()}`;
}

export function createHashMap(g: ProjectivePoint): Map<string, bigint> {
  const precomputed = new Map<string, bigint>();
  const b = 2n ** 16n;

  let gb = g.multiply(b);
  let current = gb;
  precomputed.set(toKey(0n, 0n), 0n);
  for (let i = 1n; i < b; i++) {
    const key = toKey(current.x, current.y);
    precomputed.set(key, i);

    current = current.add(gb);
  }

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
  let c_prec = precomputed.get(toKey(c.x, c.y));
  if (c_prec !== undefined) {
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

