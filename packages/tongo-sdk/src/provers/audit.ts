import { CipherBalance, createCipherBalance, GENERATOR as g, ProjectivePoint } from "../types";
import { compute_challenge, compute_s, generateRandom } from "@fatsolutions/she";
import { SameEncryptUnknownRandom } from "@fatsolutions/she/protocols";

// cairo string 'audit'
export const AUDIT_CAIRO_STRING = 418581342580n;

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

export function proveAudit(x: bigint, balance: bigint, storedBalance: CipherBalance, auditorPubKey: ProjectivePoint): { inputs: InputsAudit, proof: ProofOfAudit; } {
    const y = g.multiply(x);
    const { L: L0, R: R0 } = storedBalance;

    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x));
    const temp = g.multiplyUnsafe(balance);
    if (!g_b.equals(temp)) { throw new Error("storedBalance is not an encryption of balance"); };
    //

    const r = generateRandom();
    const auditedBalance = createCipherBalance(auditorPubKey, balance, r);
    const inputs: InputsAudit = { y, storedBalance, auditorPubKey, auditedBalance };

    const kx = generateRandom();
    const kb = generateRandom();
    const kr = generateRandom();

    const Ax = g.multiplyUnsafe(kx);
    const AL0 = g.multiplyUnsafe(kb).add(R0.multiplyUnsafe(kx));

    const AR1 = g.multiplyUnsafe(kr);
    const AL1 = g.multiplyUnsafe(kb).add(auditorPubKey.multiplyUnsafe(kr));
    const c = compute_challenge(AUDIT_CAIRO_STRING, [Ax, AL0, AL1, AR1]);

    const sx = compute_s(kx, x, c);
    const sr = compute_s(kr, r, c);
    const sb = compute_s(kb, balance, c);

    const proof: ProofOfAudit = { Ax, AL0, AL1, AR1, sx, sb, sr };
    return { inputs, proof };
}


/// Verifies that the given ZK proof is a valid proof of the audit declaration. If the proof checks then the public 
/// inputs check
///
/// - The caller knows the private key of the Tongo account.
/// - The provided encryption is a valid encryption for the auditor key
/// - The provided encryption is encrypting the same amount encrypted in the current balance of the Tongo account.
export function verifyAudit(inputs: InputsAudit, proof: ProofOfAudit): boolean {
    const c = compute_challenge(AUDIT_CAIRO_STRING, [proof.Ax, proof.AL0, proof.AL1, proof.AR1]);
    const { L: L0, R: R0 } = inputs.storedBalance;
    const { L: L_audit, R: R_audit } = inputs.auditedBalance;

    return SameEncryptUnknownRandom._verify(
        L0,
        R0,
        L_audit,
        R_audit,
        g,
        inputs.y,
        inputs.auditorPubKey,
        proof.Ax,
        proof.AL0,
        proof.AL1,
        proof.AR1,
        c,
        proof.sb,
        proof.sx,
        proof.sr,
    );
}
