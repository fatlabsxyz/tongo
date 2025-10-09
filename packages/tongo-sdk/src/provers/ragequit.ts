import { poe } from "@fatsolutions/she/protocols";

import { CipherBalance, compute_prefix, createCipherBalance, GeneralPrefixData, ProjectivePoint } from "../types";
import { GENERATOR as g } from "../constants";

import { compute_challenge, compute_s, generateRandom } from "@fatsolutions/she";

// cairo string 'ragequit'
export const RAGEQUIT_CAIRO_STRING = 8241982478457596276n;

/// Public inputs of the verifier for the ragequit operation.
///
/// - y: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - to: The starknet contract address to send the funds to.
/// - amount: The ammount of tongo to ragequit (the total amount of tongos in the account).
/// - currentBalance: The current CipherBalance stored for the account.
export interface InputsRagequit {
    y: ProjectivePoint;
    nonce: bigint;
    to: bigint;
    amount: bigint;
    currentBalance: CipherBalance;
    prefix_data: GeneralPrefixData,
}

/// Computes the prefix by hashing some public inputs.
function prefixRagequit(inputs: InputsRagequit): bigint {
    const { chain_id, tongo_address } = inputs.prefix_data;
    const seq: bigint[] = [
        chain_id,
        tongo_address,
        RAGEQUIT_CAIRO_STRING,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.nonce,
        inputs.amount,
        inputs.to,
    ];
    return compute_prefix(seq);
}

/// Proof of ragequit operation.
export interface ProofOfRagequit {
    Ax: ProjectivePoint;
    AR: ProjectivePoint;
    sx: bigint;
}


export function proveRagequit(
    x: bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
    to: bigint,
    amount: bigint,
    prefix_data: GeneralPrefixData,
): { inputs: InputsRagequit, proof: ProofOfRagequit, newBalance: CipherBalance; } {

    const y = g.multiply(x);
    const { L: L0, R: R0 } = currentBalance;

    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x));
    const temp = g.multiplyUnsafe(amount);
    if (!g_b.equals(temp)) { throw new Error("storedBalance is not an encryption of balance"); };

    const inputs: InputsRagequit = {
        y,
        nonce,
        to,
        amount,
        currentBalance,
        prefix_data,
    };
    const prefix = prefixRagequit(inputs);

    const kx = generateRandom();

    const Ax = g.multiply(kx);
    const AR = R0.multiplyUnsafe(kx);

    const c = compute_challenge(prefix, [Ax, AR]);
    const sx = compute_s(kx, x, c);

    const proof: ProofOfRagequit = { Ax, AR, sx };

    const newBalance = createCipherBalance(y, 0n, 1n);
    return { inputs, proof, newBalance };
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
    const c = compute_challenge(prefix, [proof.Ax, proof.AR]);

    let res = poe._verify(inputs.y, g, proof.Ax, c, proof.sx);
    if (res == false) {
        throw new Error("error in poe y");
    }

    const { L: L1, R: R1 } = inputs.currentBalance;

    const L = L1.subtract(g.multiply(inputs.amount));

    res = poe._verify(L, R1, proof.AR, c, proof.sx);
    if (res == false) {
        throw new Error("error in poe R");
    }
}
