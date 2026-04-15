import { compute_challenge, compute_s, generateRandom } from "@fatsolutions/she";
import { SameEncryptUnknownRandom } from "@fatsolutions/she/protocols";
import { GENERATOR as g } from "../constants.js";
import {
    CipherBalance,
    ProjectivePoint,
    GeneralPrefixData,
    compute_prefix,
    projectivePointToStarkPoint,
    starkPointToProjectivePoint,
} from "../types.js";
import { createCipherBalance } from "../../src/utils.js";
import { AuxAbiType, auxCodec } from "../abi/abi.types.js";

// cairo string 'audit'
export const AUDIT_CAIRO_STRING = 418581342580n;

/**
 * Public inputs of the verifier for the audit declaration
 * @property {PubKey} y - The Tongo account that is declaring its balance
 * @property {PubKey} auditorPubKey - The current auditor public key
 * @property {CipherBalance} storedBalance - The current CipherBalance stored for the account (y)
 * @property {CipherBalance} auditedBalance - The balance of y encrypted under the auditor public key
 * @property {GeneralPrefixData} prefix_data - General prefix data for the operation
 */
export type InputsAudit = AuxAbiType<"tongo::structs::operations::audit::InputsAudit">;

/**
 * Computes the prefix by hashing some public inputs.
 * @param {InputsAudit} inputs - The audit operation inputs
 * @returns {bigint} The computed prefix hash
 */
function prefixAudit(inputs: InputsAudit): bigint {
    const _serialized = auxCodec.encode("tongo::structs::operations::audit::InputsAudit", inputs);
    const seq: bigint[] = [AUDIT_CAIRO_STRING, ..._serialized.map(BigInt)];
    return compute_prefix(seq);
}

/**
 * Proof of audit declaration
 * @interface ProofOfAudit
 * @property {ProjectivePoint} Ax - The proof point Ax
 * @property {ProjectivePoint} AL0 - The proof point AL0
 * @property {ProjectivePoint} AL1 - The proof point AL1
 * @property {ProjectivePoint} AR1 - The proof point AR1
 * @property {bigint} sx - The proof scalar sx
 * @property {bigint} sr - The proof scalar sr
 * @property {bigint} sb - The proof scalar sb
 */
export interface ProofOfAudit {
    Ax: ProjectivePoint;
    AL0: ProjectivePoint;
    AL1: ProjectivePoint;
    AR1: ProjectivePoint;
    sx: bigint;
    sr: bigint;
    sb: bigint;
}

export function proveAudit(
    private_key: bigint,
    initial_balance: bigint,
    initial_cipherbalance: CipherBalance,
    auditorPubKey: ProjectivePoint,
    prefix_data: GeneralPrefixData,
): { inputs: InputsAudit; proof: ProofOfAudit } {
    const x = private_key;
    const y = g.multiply(x);
    const { L: L0, R: R0 } = initial_cipherbalance;

    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x));
    const temp = g.multiplyUnsafe(initial_balance);
    if (!g_b.equals(temp)) {
        throw new Error("storedBalance is not an encryption of balance");
    }
    //

    const r = generateRandom();
    const auditedBalance = createCipherBalance(auditorPubKey, initial_balance, r);
    const inputs: InputsAudit = {
        y: projectivePointToStarkPoint(y),
        storedBalance: {
            L: projectivePointToStarkPoint(initial_cipherbalance.L),
            R: projectivePointToStarkPoint(initial_cipherbalance.R),
        },
        auditorPubKey: projectivePointToStarkPoint(auditorPubKey),
        auditedBalance: {
            L: projectivePointToStarkPoint(auditedBalance.L),
            R: projectivePointToStarkPoint(auditedBalance.R),
        },
        prefix_data,
    };
    const prefix = prefixAudit(inputs);

    const kx = generateRandom();
    const kb = generateRandom();
    const kr = generateRandom();

    const Ax = g.multiplyUnsafe(kx);
    const AL0 = g.multiplyUnsafe(kb).add(R0.multiplyUnsafe(kx));

    const AR1 = g.multiplyUnsafe(kr);
    const AL1 = g.multiplyUnsafe(kb).add(auditorPubKey.multiplyUnsafe(kr));
    const c = compute_challenge(prefix, [Ax, AL0, AL1, AR1]);

    const sx = compute_s(kx, x, c);
    const sr = compute_s(kr, r, c);
    const sb = compute_s(kb, initial_balance, c);

    const proof: ProofOfAudit = { Ax, AL0, AL1, AR1, sx, sb, sr };
    return { inputs, proof };
}

/**
 * Verifies that the given ZK proof is a valid proof of the audit declaration. If the proof checks then the public
 * inputs check:
 *
 * - The caller knows the private key of the Tongo account.
 * - The provided encryption is a valid encryption for the auditor key
 * - The provided encryption is encrypting the same amount encrypted in the current balance of the Tongo account.
 *
 * @param {InputsAudit} inputs - The audit operation inputs
 * @param {ProofOfAudit} proof - The proof to verify
 * @returns {boolean} True if the proof is valid, false otherwise
 */
export function verifyAudit(inputs: InputsAudit, proof: ProofOfAudit): boolean {
    const c = compute_challenge(AUDIT_CAIRO_STRING, [proof.Ax, proof.AL0, proof.AL1, proof.AR1]);
    const L0 = starkPointToProjectivePoint(inputs.storedBalance.L);
    const R0 = starkPointToProjectivePoint(inputs.storedBalance.R);
    const L_audit = starkPointToProjectivePoint(inputs.auditedBalance.L);
    const R_audit = starkPointToProjectivePoint(inputs.auditedBalance.R);

    return SameEncryptUnknownRandom._verify(
        L0,
        R0,
        L_audit,
        R_audit,
        g,
        starkPointToProjectivePoint(inputs.y),
        starkPointToProjectivePoint(inputs.auditorPubKey),
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
