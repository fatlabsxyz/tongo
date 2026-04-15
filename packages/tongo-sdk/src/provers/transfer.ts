import { compute_challenge, compute_s, generateRandom } from "@fatsolutions/she";
import { SameEncrypt, ElGamal, SameEncryptUnknownRandom, poe } from "@fatsolutions/she/protocols";
import { range as SHE_range } from "@fatsolutions/she/protocols";

import { GENERATOR as g, SECONDARY_GENERATOR as h } from "../constants.js";
import { generateRangeProof, Range, verifyRangeProof } from "../provers/range.js";
import {
    CipherBalance,
    compute_prefix,
    GeneralPrefixData,
    ProjectivePoint,
    projectivePointToStarkPoint,
    starkPointToProjectivePoint,
} from "../types.js";
import { createCipherBalance } from "../utils.js";
import { AuxAbiType, auxCodec } from "../abi/abi.types.js";

// cairo string 'transfer'
export const TRANSFER_CAIRO_STRING = 8390876182755042674n;

export const FEE_CAIRO_STRING = 6710629n;

/**
 * Public inputs of the verifier for the transfer operation.
 * @property {PubKey} from - The Tongo account to take tongos from
 * @property {PubKey} to - The Tongo account to send tongos to
 * @property {bigint} nonce - The nonce of the Tongo account (from)
 * @property {CipherBalance} currentBalance - The current CipherBalance stored for the account (from)
 * @property {CipherBalance} transferBalance - The amount to transfer encrypted for the pubkey of `to`
 * @property {CipherBalance} transferBalanceSelf - The amount to transfer encrypted for the pubkey of `from`
 * @property {CipherBalance} auxiliarCipher - Auxiliary cipher for range proof
 * @property {CipherBalance} auxiliarCipher2 - Auxiliary cipher for second range proof
 * @property {number} bit_size - The bit size for range proofs
 * @property {GeneralPrefixData} prefix_data - General prefix data for the operation
 * @property {bigint[]} data - Serialized operation options
 */
export type InputsTransfer = AuxAbiType<"tongo::structs::operations::transfer::InputsTransfer">;

/**
 * Computes the prefix by hashing some public inputs.
 * @param {InputsTransfer} inputs - The inputs of the proof
 * @returns {bigint} The computed prefix hash
 */
function prefixTransfer(inputs: InputsTransfer): bigint {
    const _serialized = auxCodec.encode(
        "tongo::structs::operations::transfer::InputsTransfer",
        inputs,
    );
    const seq: bigint[] = [TRANSFER_CAIRO_STRING, ..._serialized.map(BigInt)];
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
    range: Range;
    range2: Range;
}

export function proveTransfer(
    private_key: bigint,
    to: ProjectivePoint,
    initial_balance: bigint,
    amount_to_transfer: bigint,
    initial_cipherbalance: CipherBalance,
    nonce: bigint,
    bit_size: number,
    prefix_data: GeneralPrefixData,
    serialized_data: bigint[],
): {
    inputs: InputsTransfer;
    proof: ProofOfTransfer;
    newBalance: CipherBalance;
} {
    const x = private_key;
    const y = g.multiply(x);

    const b = amount_to_transfer;
    const b0 = initial_balance;
    const b_left = b0 - b;

    // This precomputation is usefull to know add R_aux and V to the prefix computation
    const { randomness, total_random } = SHE_range.pregenerate_randomness(bit_size);
    const auxiliarCipher = createCipherBalance(h, amount_to_transfer, total_random);

    const transferBalanceSelf = createCipherBalance(y, b, total_random);
    const transferBalance = createCipherBalance(to, b, total_random);

    const { randomness: randomness2, total_random: total_random2 } =
        SHE_range.pregenerate_randomness(bit_size);
    const auxiliarCipher2 = createCipherBalance(h, b_left, total_random2);

    const cipherToStark = (cb: CipherBalance) => ({
        L: projectivePointToStarkPoint(cb.L),
        R: projectivePointToStarkPoint(cb.R),
    });

    const inputs: InputsTransfer = {
        from: projectivePointToStarkPoint(y),
        to: projectivePointToStarkPoint(to),
        nonce,
        currentBalance: cipherToStark(initial_cipherbalance),
        transferBalance: cipherToStark(transferBalance),
        transferBalanceSelf: cipherToStark(transferBalanceSelf),
        auxiliarCipher: cipherToStark(auxiliarCipher),
        auxiliarCipher2: cipherToStark(auxiliarCipher2),
        bit_size: BigInt(bit_size),
        prefix_data,
        data: serialized_data,
    };

    const prefix = prefixTransfer(inputs);

    const { L: L0, R: R0 } = initial_cipherbalance;

    const { r, range } = generateRangeProof(b, bit_size, randomness, prefix);
    if (r !== total_random) {
        throw new Error("random missmatch");
    }

    const { r: r2, range: range2 } = generateRangeProof(b_left, bit_size, randomness2, prefix);
    if (r2 !== total_random2) {
        throw new Error("random missmatch");
    }

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

    const commitments = [A_x, A_r, A_r2, A_b, A_b2, A_v, A_v2, A_bar];

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
        range,
        range2,
    };

    const newBalance: CipherBalance = {
        L: L0.subtract(transferBalanceSelf.L),
        R: R0.subtract(transferBalanceSelf.R),
    };
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
export function verifyTransfer(inputs: InputsTransfer, proof: ProofOfTransfer) {
    const bit_size = Number(inputs.bit_size);
    const prefix = prefixTransfer(inputs);

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

    const starkToP = starkPointToProjectivePoint;
    const CL = starkToP(inputs.currentBalance.L);
    const CR = starkToP(inputs.currentBalance.R);
    const L = starkToP(inputs.transferBalanceSelf.L);
    const R = starkToP(inputs.transferBalanceSelf.R);
    const L_bar = starkToP(inputs.transferBalance.L);
    const R_bar = starkToP(inputs.transferBalance.R);
    const V = starkToP(inputs.auxiliarCipher.L);
    const R_aux = starkToP(inputs.auxiliarCipher.R);
    const V2 = starkToP(inputs.auxiliarCipher2.L);
    const R_aux2 = starkToP(inputs.auxiliarCipher2.R);
    const from = starkToP(inputs.from);
    const to = starkToP(inputs.to);

    let res = poe._verify(from, g, proof.A_x, c, proof.s_x);
    if (res == false) {
        throw new Error("error in poe for y");
    }

    const sameEncryptInputs = {
        L1: L,
        R1: R,
        L2: L_bar,
        R2: R_bar,
        g,
        y1: from,
        y2: to,
    };

    const sameEncryptProof = {
        AL1: proof.A_b,
        AR1: proof.A_r,
        AL2: proof.A_bar,
        AR2: proof.A_r,
        c,
        sb: proof.s_b,
        sr1: proof.s_r,
        sr2: proof.s_r,
    };

    res = SameEncrypt.verify(sameEncryptInputs, sameEncryptProof);
    if (res == false) {
        throw new Error("error SameEncryp");
    }

    const V_proof = verifyRangeProof(proof.range, bit_size, prefix);
    if (V_proof == false) {
        throw new Error("erro in range for V");
    }
    if (!V.equals(V_proof)) {
        throw new Error("V missmatch");
    }

    const elGamalInputs = {
        L: V,
        R: R_aux,
        g1: g,
        g2: h,
    };

    const elGamalProof = {
        AL: proof.A_v,
        AR: proof.A_r,
        c,
        sb: proof.s_b,
        sr: proof.s_r,
    };
    res = ElGamal.verify(elGamalInputs, elGamalProof);
    if (res == false) {
        throw new Error("erro elGamalProof");
    }

    const L0 = CL.subtract(L);
    const R0 = CR.subtract(R);

    const V2_proof = verifyRangeProof(proof.range2, bit_size, prefix);
    if (V2_proof == false) {
        throw new Error("erro in range for V2");
    }
    if (!V2.equals(V2_proof)) {
        throw new Error("V2 missmatch");
    }

    const sameEncryptUnkownRandomInputs = {
        L1: L0,
        R1: R0,
        L2: V2,
        R2: R_aux2,
        g,
        y1: from,
        y2: h,
    };

    const sameEncryptUnkownRandomProof = {
        Ax: proof.A_x,
        AL1: proof.A_b2,
        AL2: proof.A_v2,
        AR2: proof.A_r2,
        c,
        sb: proof.s_b2,
        sx: proof.s_x,
        sr2: proof.s_r2,
    };

    return SameEncryptUnknownRandom.verify(
        sameEncryptUnkownRandomInputs,
        sameEncryptUnkownRandomProof,
    );
}

export function verifyTransferOrThrow(inputs: InputsTransfer, proof: ProofOfTransfer) {
    const verified = verifyTransfer(inputs, proof);
    if (!verified) {
        throw new Error("error in sameEncrypUnkownRandom");
    }
}
