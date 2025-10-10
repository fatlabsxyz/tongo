import { compute_challenge } from "@fatsolutions/she";
import { poe } from "@fatsolutions/she/protocols";

import { GENERATOR as g } from "../constants";
import { createCipherBalance} from "../../src/utils";
import { ProjectivePoint, GeneralPrefixData, CipherBalance, compute_prefix } from "../types";



// cairo string 'fund'
export const FUND_CAIRO_STRING = 1718972004n;

/**
 * Public inputs of the verifier for the fund operation.
 * @interface InputsFund
 * @property {ProjectivePoint} y - The Tongo account to fund
 * @property {bigint} amount - The amount of tongo to fund
 * @property {bigint} nonce - The nonce of the Tongo account (from)
 * @property {GeneralPrefixData} prefix_data - General prefix data for the operation
 */
export interface InputsFund {
    y: ProjectivePoint;
    amount: bigint;
    nonce: bigint;
    prefix_data: GeneralPrefixData;
}

/**
 * Computes the prefix by hashing some public inputs.
 * @param {InputsFund} inputs - The fund operation inputs
 * @returns {bigint} The computed prefix hash
 */
function prefixFund(inputs: InputsFund): bigint {
    const { chain_id, tongo_address } = inputs.prefix_data;
    const seq: bigint[] = [
        chain_id,
        tongo_address,
        FUND_CAIRO_STRING,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.amount,
        inputs.nonce,
    ];
    return compute_prefix(seq);
}

/**
 * Proof of fund operation.
 * @interface ProofOfFund
 * @property {ProjectivePoint} Ax - The proof point Ax
 * @property {bigint} sx - The proof scalar sx
 */
export interface ProofOfFund {
    Ax: ProjectivePoint;
    sx: bigint;
}

export function proveFund(
    private_key: bigint,
    amount_to_fund: bigint,
    initial_balance: bigint,
    initial_cipherbalance: CipherBalance,
    nonce: bigint,
    prefix_data: GeneralPrefixData,
): {
    inputs: InputsFund;
    proof: ProofOfFund;
    newBalance: CipherBalance;
} {
    const x = private_key;
    const y = g.multiply(x);
    const { L: L0, R: R0 } = initial_cipherbalance;

    //this is to assert that storedbalance is an encryption of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x));
    const temp = g.multiplyUnsafe(initial_balance);
    if (!g_b.equals(temp)) { throw new Error("storedBalance is not an encryption of balance"); };

    const inputs: InputsFund = { y, nonce, amount:amount_to_fund, prefix_data };
    const prefix = prefixFund(inputs);

    const { proof: { s: sx, A: Ax } } = poe.prove(x, g, prefix);

    // compute the cipherbalance that `y` will have after the fund operation
    const cipher = createCipherBalance(y, amount_to_fund, FUND_CAIRO_STRING);  // we use FUND_CAIRO_STRING as a random number
    const newBalance: CipherBalance = { L: L0.add(cipher.L), R: R0.add(cipher.R) };

    return { inputs, proof: { sx, Ax }, newBalance };
}


/**
 * Verify the fund operation. In this case, users have to only show the knowledge
 * of the private key.
 * 
 * Complexity:
 * - EC_MUL: 2
 * - EC_ADD: 1
 * 
 * @param {InputsFund} inputs - The fund operation inputs
 * @param {ProofOfFund} proof - The proof to verify
 * @returns {boolean} True if the proof is valid, false otherwise
 */
export function verifyFund(inputs: InputsFund, proof: ProofOfFund) {
    const prefix = prefixFund(inputs);
    const c = compute_challenge(prefix, [proof.Ax]);

    const res = poe._verify(inputs.y, g, proof.Ax, c, proof.sx);
    if (res == false) {
        throw new Error("verifyFund failed");
    }
}
