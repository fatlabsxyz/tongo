import { compute_challenge } from "@fatsolutions/she";
import { poe } from "@fatsolutions/she/protocols";

import { GENERATOR as g } from "../constants";
import { CipherBalance, compute_prefix, createCipherBalance, GeneralPrefixData, ProjectivePoint } from "../types";

// cairo string 'fund'
export const FUND_CAIRO_STRING = 1718972004n;

/// Public inputs of the verifier for the fund operation.
///
/// - y: The Tongo account to fund.
/// - amount: The ammount of tongo to fund.
/// - nonce: The nonce of the Tongo account (from).
export interface InputsFund {
    y: ProjectivePoint;
    amount: bigint;
    nonce: bigint;
    prefix_data: GeneralPrefixData;
}

/// Computes the prefix by hashing some public inputs.
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

/// Proof of fund operation.
export interface ProofOfFund {
    Ax: ProjectivePoint;
    sx: bigint;
}

export function proveFund(
    x: bigint,
    amount: bigint,
    initialBalance: bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
    prefix_data: GeneralPrefixData,
): {
    inputs: InputsFund;
    proof: ProofOfFund;
    newBalance: CipherBalance;
} {
    const y = g.multiply(x);
    const { L: L0, R: R0 } = currentBalance;

    //this is to assert that storedbalance is an encryption of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x));
    const temp = g.multiplyUnsafe(initialBalance);
    if (!g_b.equals(temp)) { throw new Error("storedBalance is not an encryption of balance"); };

    const inputs: InputsFund = { y, nonce, amount, prefix_data };
    const prefix = prefixFund(inputs);

    const { proof: { s: sx, A: Ax } } = poe.prove(x, g, prefix);

    // compute the cipherbalance that `y` will have after the fund operation
    const cipher = createCipherBalance(y, amount, FUND_CAIRO_STRING);  // we use FUND_CAIRO_STRING as a random number
    const newBalance: CipherBalance = { L: L0.add(cipher.L), R: R0.add(cipher.R) };

    return { inputs, proof: { sx, Ax }, newBalance };
}


/// Verify the fund operation. In this case, users have to only show the knowledge
/// of the private key.
///
/// EC_MUL: 2
/// EC_ADD: 1
export function verifyFund(inputs: InputsFund, proof: ProofOfFund) {
    const prefix = prefixFund(inputs);
    const c = compute_challenge(prefix, [proof.Ax]);

    let res = poe._verify(inputs.y, g, proof.Ax, c, proof.sx);
    if (res == false) {
        throw new Error("verifyFund failed");
    }
}
