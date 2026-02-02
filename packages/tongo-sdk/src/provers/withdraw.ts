import { compute_challenge, compute_s, generateRandom } from "@fatsolutions/she";
import { SameEncryptUnknownRandom } from "@fatsolutions/she/protocols";
import { range as SHE_range} from "@fatsolutions/she/protocols"

import { GENERATOR as g, SECONDARY_GENERATOR as h } from "../constants";
import { generateRangeProof, Range, verifyRangeProof } from "../provers/range";
import { CipherBalance, compute_prefix, GeneralPrefixData, ProjectivePoint, RelayData } from "../types";
import { createCipherBalance} from "../../src/utils";

// cairo string 'withdraw'
export const WITHDRAW_CAIRO_STRING = 8604536554778681719n;
const FEE_CAIRO_STRING = 6710629n;

/**
 * Public inputs of the verifier for the withdraw operation.
 * @interface InputsWithdraw
 * @property {ProjectivePoint} y - The Tongo account to withdraw from
 * @property {bigint} nonce - The nonce of the Tongo account
 * @property {bigint} to - The starknet contract address to send the funds to
 * @property {bigint} amount - The amount of tongo to withdraw
 * @property {CipherBalance} currentBalance - The current CipherBalance stored for the account
 * @property {number} bit_size - The bit size for range proofs
 * @property {GeneralPrefixData} prefix_data - General prefix data for the operation
 * @property {RelayData} relay_data - relay data for the operation
 */
export interface InputsWithdraw {
    y: ProjectivePoint;
    nonce: bigint;
    to: bigint;
    amount: bigint;
    currentBalance: CipherBalance,
    auxiliarCipher: CipherBalance,
    bit_size: number,
    prefix_data: GeneralPrefixData,
    relay_data: RelayData,
}

/**
 * Computes the prefix by hashing some public inputs.
 * @param {InputsWithdraw} inputs - The inputs from the proof
 * @returns {bigint} The computed prefix hash
 */
function prefixWithdraw(
    inputs: InputsWithdraw
): bigint {
    const { chain_id, tongo_address, sender_address } = inputs.prefix_data;
    const {L: L0, R:R0} = inputs.currentBalance;
    const {L: V, R:R_aux} = inputs.auxiliarCipher;

    const seq: bigint[] = [
        chain_id,
        tongo_address,
        sender_address,
        inputs.relay_data.fee_to_sender,
        WITHDRAW_CAIRO_STRING,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.nonce,
        inputs.amount,
        inputs.to,
        L0.toAffine().x,
        L0.toAffine().y,
        R0.toAffine().x,
        R0.toAffine().y,
        V.toAffine().x,
        V.toAffine().y,
        R_aux.toAffine().x,
        R_aux.toAffine().y,
    ];
    return compute_prefix(seq);
}

/**
 * Proof of withdraw operation.
 * @interface ProofOfWithdraw
 * @property {ProjectivePoint} A_x - The proof point A_x
 * @property {ProjectivePoint} A_r - The proof point A_r
 * @property {ProjectivePoint} A - The proof point A
 * @property {ProjectivePoint} A_v - The proof point A_v
 * @property {bigint} sx - The proof scalar sx
 * @property {bigint} sb - The proof scalar sb
 * @property {bigint} sr - The proof scalar sr
 * @property {Range} range - The range proof
 * @todo Remove the _ from property names?
 */
export interface ProofOfWithdraw {
    A_x: ProjectivePoint;
    A_r: ProjectivePoint;
    A: ProjectivePoint;
    A_v: ProjectivePoint;
    sx: bigint;
    sb: bigint;
    sr: bigint;
    range: Range;
}

export function proveWithdraw(
    private_key: bigint,
    initial_balance: bigint,
    amount: bigint,
    to: bigint,
    initial_cipherbalance: CipherBalance,
    nonce: bigint,
    bit_size: number,
    prefix_data: GeneralPrefixData,
    fee_to_sender: bigint,
): {
    inputs: InputsWithdraw;
    proof: ProofOfWithdraw;
    newBalance: CipherBalance;
} {
    const x = private_key;
    const y = g.multiply(x);
    let { L: L0, R: R0 } = initial_cipherbalance;

    //this is to assert that storedbalance is an encryption of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x));
    const temp = g.multiplyUnsafe(initial_balance);
    if (!g_b.equals(temp)) { throw new Error("storedBalance is not an encryption of balance"); };

    const left = initial_balance - amount - fee_to_sender;

    // This precomputation is usefull to know add R_aux and V to the prefix computation
    const  {randomness, total_random} = SHE_range.pregenerate_randomness(bit_size);
    const auxiliarCipher = createCipherBalance(h,left, total_random);

    const relay_data: RelayData =  {fee_to_sender};

    const inputs: InputsWithdraw = {
        y,
        nonce,
        currentBalance: initial_cipherbalance,
        to,
        amount,
        bit_size,
        auxiliarCipher,
        prefix_data,
        relay_data,
    };

    const prefix = prefixWithdraw(inputs);

    let currentBalance = initial_cipherbalance;
    if (fee_to_sender != 0n) {
        let {L: L_fee, R: R_fee}  = createCipherBalance(y,fee_to_sender, FEE_CAIRO_STRING);
        let {L, R} = currentBalance;
        currentBalance = {L: L.subtract(L_fee), R: R.subtract(R_fee)};
    }

    R0 = currentBalance.R;
    L0 = currentBalance.L;

    const { r, range } = generateRangeProof(left, bit_size,randomness, prefix);
    if (r !== total_random) {throw new Error("random mismatch")};

    const kb = generateRandom();
    const kx = generateRandom();
    const kr = generateRandom();

    const A_x = g.multiplyUnsafe(kx);
    const A_r = g.multiplyUnsafe(kr);
    const A = g.multiplyUnsafe(kb).add(R0.multiplyUnsafe(kx));
    const A_v = g.multiplyUnsafe(kb).add(h.multiplyUnsafe(kr));

    const c = compute_challenge(prefix, [A_x, A_r, A,A_v]);

    const sb = compute_s(kb, left, c);
    const sx = compute_s(kx, x, c);
    const sr = compute_s(kr, r, c);

    const proof: ProofOfWithdraw = {
        A_x,
        A_r,
        A,
        A_v,
        sx,
        sb,
        sr,
        range,
    };

    // compute the cipherbalance that y will have at the end of the withdraw
    const cipher = createCipherBalance(y, amount, WITHDRAW_CAIRO_STRING);
    const newBalance: CipherBalance = { L: currentBalance.L.subtract(cipher.L), R: currentBalance.R.subtract(cipher.R) };

    return { inputs, proof, newBalance };
}


/**
 * Verifies the withdraw operation. First, users have to show knowledge of the private key. Then, users have to provide 
 * a cleartext of the amount b to withdraw. The contract will construct a cipher balance (L2, R2) = (g**b y**r2, g**r2)
 * with randomness r2='withdraw'. The contract will subtract (L2,R2) to the stored balance of the user. The user have
 * to provide a zk proof that the final cipher balance is encrypting a positive (a value in (0, u**32)) amount b_left. To do
 * this when the RangeProof is verified, it returns a V = g**b_left h**r, with b_left positive. V is used as an L part of
 * a cipher balance, users have to prove that the cipher balance (V, R_aux = g**r) is encrypting the same amount
 * that the final cipher balance.
 *
 * Complexity:
 * - EC_MUL: 12 + n*5 = 172 for u32 
 * - EC_ADD: 8 + n*4  = 136 for u32
 *
 * @param {InputsWithdraw} inputs - The withdraw operation inputs
 * @param {ProofOfWithdraw} proof - The proof to verify
 * @returns {boolean} True if the proof is valid, false otherwise
 */
export function verifyWithdraw(
    inputs: InputsWithdraw,
    proof: ProofOfWithdraw,
) {
    const bit_size = inputs.bit_size;
    const prefix = prefixWithdraw(inputs);

    
    const c = compute_challenge(prefix, [proof.A_x, proof.A_r, proof.A, proof.A_v]);

    let { L: L0, R: R0 } = inputs.currentBalance;
    if (inputs.relay_data.fee_to_sender != 0n) {
        const {L: L_fee, R: R_fee}  = createCipherBalance(inputs.y,inputs.relay_data.fee_to_sender, FEE_CAIRO_STRING);
        L0 = L0.subtract(L_fee); 
        R0 = R0.subtract(R_fee);
    }
    L0 = L0.subtract(g.multiply(inputs.amount));

    let { L: V, R: R_aux} = inputs.auxiliarCipher;
    const V_proof = verifyRangeProof(proof.range, bit_size, prefix);
    if (V_proof == false) { throw new Error("erro in range for V"); }
    if (!V.equals(V_proof)) {throw new Error( "V missmatch" )};
    
    let sameEncryptInputs = {
      L1: L0,
      R1: R0,
      L2: V,
      R2: R_aux,
      g,
      y1: inputs.y,
      y2: h,
    };

    let sameEncrpyProof= {
        Ax: proof.A_x,
        AL1: proof.A,
        AL2: proof.A_v,
        AR2: proof.A_r,
        c,
        sb: proof.sb,
        sx: proof.sx,
        sr2: proof.sr,
    };

    let res = SameEncryptUnknownRandom.verify(sameEncryptInputs, sameEncrpyProof);
    if (res == false) { throw new Error("error in SameEncrpyUnkownRandom"); }
}
