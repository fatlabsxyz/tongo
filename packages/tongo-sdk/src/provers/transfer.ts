import { compute_challenge, compute_s, generateRandom } from "@fatsolutions/she";
import { poe, poe2 } from "@fatsolutions/she/protocols";

import { GENERATOR as g, SECONDARY_GENERATOR as h } from "../constants";
import { generateRangeProof, Range, verifyRangeProof } from "../provers/range";
import { CipherBalance, compute_prefix, createCipherBalance, GeneralPrefixData, ProjectivePoint } from "../types";

// cairo string 'transfer'
export const TRANSFER_CAIRO_STRING = 8390876182755042674n;

/**
 * Public inputs of the verifier for the transfer operation.
 * @interface InputsTransfer
 * @property {ProjectivePoint} from - The Tongo account to take tongos from
 * @property {ProjectivePoint} to - The Tongo account to send tongos to
 * @property {bigint} nonce - The nonce of the Tongo account (from)
 * @property {CipherBalance} currentBalance - The current CipherBalance stored for the account (from)
 * @property {CipherBalance} transferBalance - The amount to transfer encrypted for the pubkey of `to`
 * @property {CipherBalance} transferBalanceSelf - The amount to transfer encrypted for the pubkey of `from`
 * @property {number} bit_size - The bit size for range proofs
 * @property {GeneralPrefixData} prefix_data - General prefix data for the operation
 */
export interface InputsTransfer {
    from: ProjectivePoint,
    to: ProjectivePoint,
    nonce: bigint,
    currentBalance: CipherBalance,
    transferBalance: CipherBalance,
    transferBalanceSelf: CipherBalance,
    bit_size: number,
    prefix_data: GeneralPrefixData,
}

/**
 * Computes the prefix by hashing some public inputs.
 * @param {GeneralPrefixData} general_prefix_data - General prefix data
 * @param {ProjectivePoint} from - The source account
 * @param {ProjectivePoint} to - The destination account
 * @param {bigint} nonce - The account nonce
 * @param {CipherBalance} currentBalance - Current cipher balance
 * @param {CipherBalance} transferBalance - Transfer cipher balance
 * @param {CipherBalance} transferBalanceSelf - Transfer cipher balance for self
 * @returns {bigint} The computed prefix hash
 */
function prefixTransfer(
    general_prefix_data: GeneralPrefixData,
    from: ProjectivePoint,
    to: ProjectivePoint,
    nonce: bigint,
): bigint {
    const { chain_id, tongo_address } = general_prefix_data;
    const seq: bigint[] = [
        chain_id,
        tongo_address,
        TRANSFER_CAIRO_STRING,
        from.toAffine().x,
        from.toAffine().y,
        to.toAffine().x,
        to.toAffine().y,
        nonce,
    ];
    return compute_prefix(seq);
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
    range: Range,
    R_aux2: ProjectivePoint,
    range2: Range;
}

export function proveTransfer(
    x: bigint,
    to: ProjectivePoint,
    b0: bigint,
    b: bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
    bit_size: number,
    prefix_data: GeneralPrefixData,
): {
    inputs: InputsTransfer;
    proof: ProofOfTransfer;
    newBalance: CipherBalance;
} {
    const y = g.multiply(x);
    const { L: L0, R: R0 } = currentBalance;

    const prefix = prefixTransfer(prefix_data, y, to, nonce);

    const { r, range } = generateRangeProof(b, bit_size, prefix);
    const transferBalanceSelf = createCipherBalance(y, b, r);
    const transferBalance = createCipherBalance(to, b, r);
    const R_aux = g.multiply(r);

    const b_left = b0 - b;
    const { r: r2, range: range2 } = generateRangeProof(b_left, bit_size, prefix);
    const R_aux2 = g.multiply(r2);

    const inputs: InputsTransfer = {
        from: y,
        to,
        nonce,
        currentBalance,
        transferBalance,
        transferBalanceSelf,
        bit_size,
        prefix_data,
    };

    const G = R0.subtract(transferBalanceSelf.R);

    const kx = generateRandom();
    const kb = generateRandom();
    const kr = generateRandom();
    const kb2 = generateRandom();
    const kr2 = generateRandom();

    const A_x = g.multiplyUnsafe(kx);
    const A_r = g.multiplyUnsafe(kr);
    const A_r2 = g.multiplyUnsafe(kr2);
    const A_b = g.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
    const A_bar = g.multiplyUnsafe(kb).add(to.multiplyUnsafe(kr));
    const A_v = g.multiplyUnsafe(kb).add(h.multiplyUnsafe(kr));
    const A_b2 = g.multiplyUnsafe(kb2).add(G.multiplyUnsafe(kx));
    const A_v2 = g.multiplyUnsafe(kb2).add(h.multiplyUnsafe(kr2));

    const commitments = [
        A_x,
        A_r,
        A_r2,
        A_b,
        A_b2,
        A_v,
        A_v2,
        A_bar,
    ];

    const c = compute_challenge(prefix, commitments);

    const s_x = compute_s(kx, x, c);
    const s_b = compute_s(kb, b, c);
    const s_r = compute_s(kr, r, c);
    const s_b2 = compute_s(kb2, b_left, c);
    const s_r2 = compute_s(kr2, r2, c);

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

    const newBalance: CipherBalance = { L: L0.subtract(transferBalanceSelf.L), R: R0.subtract(transferBalanceSelf.R) };
    return { inputs, proof, newBalance };
}


/**
 * Verifies the transfer operation. First, users have to show knowledge of the private key. Then, users have to provide 
 * two cipher balances, one (L,R) is an encryption of the transfer amount b under its public key, the other (L_bar, R_bar)
 * an encryption of the transfer amount b under the receiver public key. Users have to provide a ZK proof that both encryptions
 * are indeed encrypting the same amount for the correct public keys. To show the transfer amount b is positive,
 * when the first RangeProof is verified, it returns a V1 = g**b h**r1, with b positive. V1 is used as an L part 
 * of a cipher balance, users have to prove that the cipher balance (V1, R_aux1 = g**r1) is encrypting the same
 * amount that (L,R). The cipher balance after the operation would be (L0,R0) = (CL/L, CR/R) where (CL,CR) is the 
 * current balance. To show that (L0, R0) is encrypting an amount b_left positive, when the second RangeProof is
 * verified, it returns a V2 = g**b_left h**r2, with b_left positive. V2 is used as an L part 
 * of a cipher balance, users have to prove that the cipher balance (V2, R_aux2 = g**r2) is encrypting the same
 * amount that (L0,R0)
 *
 * Complexity:
 * - EC_MUL: 27 + 2*n*5  = 347 for u32
 * - EC_ADD: 18  + 2*n*4 = 274 for u32
 * 
 * @param {InputsTransfer} inputs - The transfer operation inputs
 * @param {ProofOfTransfer} proof - The proof to verify
 * @returns {boolean} True if the proof is valid, false otherwise
 */
export function verifyTransfer(
    inputs: InputsTransfer,
    proof: ProofOfTransfer,
) {
    const bit_size = inputs.bit_size;
    const prefix = prefixTransfer(
        inputs.prefix_data,
        inputs.to,
        inputs.from,
        inputs.nonce
    );

    const c = compute_challenge(prefix, [
        proof.A_x,
        proof.A_r,
        proof.A_r2,
        proof.A_b,
        proof.A_b2,
        proof.A_v,
        proof.A_v2,
        proof.A_bar,
    ]);

    const { L: CL, R: CR } = inputs.currentBalance;
    const { L, R } = inputs.transferBalanceSelf;
    const { L: L_bar, R: _R_bar } = inputs.transferBalance;


    let res = poe._verify(inputs.from, g, proof.A_x, c, proof.s_x);
    if (res == false) { throw new Error("error in poe for y"); }

    res = poe._verify(R, g, proof.A_r, c, proof.s_r);
    if (res == false) { throw new Error("error in poe for R"); }

    res = poe2._verify(L, g, inputs.from, proof.A_b, c, proof.s_b, proof.s_r);
    if (res == false) { throw new Error("error in poe2 for L"); }

    res = poe2._verify(
        L_bar,
        g,
        inputs.to,
        proof.A_bar,
        c,
        proof.s_b,
        proof.s_r,
    );
    if (res == false) { throw new Error("error in poe2 for L_bar"); }


    const V = verifyRangeProof(proof.range, bit_size, prefix);
    if (V == false) { throw new Error("erro in range for V"); }

    res = poe2._verify(V, g, h, proof.A_v, c, proof.s_b, proof.s_r);
    if (res == false) { throw new Error("erro in poe2 for V"); }

    const Y = CL.subtract(L);
    const G = CR.subtract(R);
    res = poe2._verify(Y, g, G, proof.A_b2, c, proof.s_b2, proof.s_x);
    if (res == false) { throw new Error("error in poe2 for Y"); }

    const V2 = verifyRangeProof(proof.range2, bit_size, prefix);
    if (V2 == false) { throw new Error("erro in range for V"); }

    res = poe2._verify(V2, g, h, proof.A_v2, c, proof.s_b2, proof.s_r2);
    if (res == false) { throw new Error("error in poe2 for V2"); }
}
