use core::ec::EcPointTrait;
use core::ec::stark_curve::{GEN_X, GEN_Y};
use she::protocols::SameEncryptionUnknownRandom::{
    SameEncryptionUnknownRandomInputs, SameEncryptionUnknownRandomProof,
    verify as same_encrypt_unknown_random_verify,
};
use crate::structs::common::cipherbalance::CipherBalanceTrait;
use crate::structs::operations::audit::{InputsAudit, ProofOfAudit};
use crate::structs::traits::{Challenge, Prefix};


/// Verifies that the given ZK proof is a valid proof of the audit declaration. If the proof checks
/// then the public inputs check
///
/// - The caller knows the private key of the Tongo account.
/// - The provided encryption is a valid encryption for the auditor key
/// - The provided encryption is encrypting the same amount encrypted in the current balance of the
/// Tongo account.
pub fn verify_audit(inputs: InputsAudit, proof: ProofOfAudit) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let (L0, R0) = inputs.storedBalance.points_nz();
    let (L_audit, R_audit) = inputs.auditedBalance.points_nz();
    let prefix = inputs.compute_prefix();
    let c = proof.compute_challenge(prefix);

    let same_encrypt_inputs = SameEncryptionUnknownRandomInputs {
        L1: L0,
        R1: R0,
        L2: L_audit,
        R2: R_audit,
        g,
        y1: inputs.y.try_into().unwrap(),
        y2: inputs.auditorPubKey.try_into().unwrap(),
    };

    let same_encrypt_proof = SameEncryptionUnknownRandomProof {
        Ax: proof.Ax.try_into().unwrap(),
        AL1: proof.AL0.try_into().unwrap(),
        AL2: proof.AL1.try_into().unwrap(),
        AR2: proof.AR1.try_into().unwrap(),
        c,
        sb: proof.sb,
        sx: proof.sx,
        sr2: proof.sr,
    };

    same_encrypt_unknown_random_verify(same_encrypt_inputs, same_encrypt_proof)
        .expect('Failed Proof of Audit');
}
