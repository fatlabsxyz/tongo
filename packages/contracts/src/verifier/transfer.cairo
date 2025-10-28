use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};
use she::protocols::ElGamal::{ElGamalInputs, ElGamalProof, verify as elgamal_verify};
use she::protocols::SameEncryption::{
    SameEncryptionInputs, SameEncryptionProof, verify as same_encrypt_verify,
};
use she::protocols::SameEncryptionUnknownRandom::{
    SameEncryptionUnknownRandomInputs, SameEncryptionUnknownRandomProof,
    verify as same_encrypt_unknown_random_verify,
};
use she::protocols::range::verify as range_verify;
use crate::structs::common::cipherbalance::CipherBalanceTrait;
use crate::structs::operations::transfer::{InputsTransfer, ProofOfTransfer};
use crate::structs::traits::{Challenge, Prefix};
use crate::verifier::range::ConvertRangeProofImpl;
use crate::verifier::utils::{generator_h, verifyOwnership};


/// Verifies the withdraw operation. First, ussers have to show knowledge of the private key. Then,
/// users  have to provide two cipher balance, one (L,R) is a encryption of the transfer amount b
/// under its public key, the other (L_bar, R_bar)
/// a encryption of the trasnfer amount b under the receiver public key. Users have to provide a ZK
/// proof that both encryption are indeed encrypting the same amount for the correct public keys. To
/// show the transfer amount b is positive, when the first RangeProof is verified, it returns a V1 =
/// g**b h**r1, with b positive. V1 is used as a L part of a cipher blalance, users have to prove
/// that the cipher balance (V1, R_aux1 = g**r1) is encrypting the same amount that (L,R). The
/// cipher balance after the operation would be (L0,R0) = (CL/L, CR/R) where (CL,CR) is the current
/// balance. To show that (L0, R0) is encrypting an amount b_left positive, when the second
/// RangeProof is verified, it returns a V2 = g**b_left h**r2, with b_left positive. V2 is used as a
/// L part of a cipher blalance, users have to prove that the cipher balance (V2, R_aux2 = g**r2) is
/// encrypting the same amount that (L0,R0)
///
/// EC_MUL: 27 + 2*n*5  = 347 for u32
/// EC_ADD: 18  + 2*n*4 = 274 for u32
pub fn verify_transfer(inputs: InputsTransfer, proof: ProofOfTransfer) {
    let (CL, CR) = inputs.currentBalance.points();
    let (L, R) = inputs.transferBalanceSelf.points_nz();
    let (L_bar, R_bar) = inputs.transferBalance.points_nz();
    let (V, R_aux) = inputs.auxiliarCipher.points_nz();
    let (V2, R_aux2) = inputs.auxiliarCipher2.points_nz();

    let prefix = inputs.compute_prefix();
    let c = proof.compute_challenge(prefix);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    verifyOwnership(inputs.from, proof.A_x, c, proof.s_x);

    let same_encrypt_inputs = SameEncryptionInputs {
        L1: L,
        R1: R,
        L2: L_bar,
        R2: R_bar,
        g,
        y1: inputs.from.try_into().unwrap(),
        y2: inputs.to.try_into().unwrap(),
    };

    let same_encrypt_proof = SameEncryptionProof {
        AL1: proof.A_b.try_into().unwrap(),
        AR1: proof.A_r.try_into().unwrap(),
        AL2: proof.A_bar.try_into().unwrap(),
        AR2: proof.A_r.try_into().unwrap(),
        c,
        sb: proof.s_b,
        sr1: proof.s_r,
        sr2: proof.s_r,
    };

    same_encrypt_verify(same_encrypt_inputs, same_encrypt_proof).expect('Failed ZK proof');

    // Now we need to show that V = g**b h**r with the same b and r.
    let (rangeInputs, rangeProof) = proof.range.to_she_proof(inputs.bit_size, prefix);
    let V_proof = range_verify(rangeInputs, rangeProof).expect('Failed ZK proof for V');
    assert!(V_proof.coordinates() == V.coordinates(), "V missmatch" );

    let elgamal_inputs = ElGamalInputs {
        L: V_proof, R: R_aux, g1: g, g2: generator_h(),
    };

    let elgamal_proof = ElGamalProof {
        AL: proof.A_v.try_into().unwrap(),
        AR: proof.A_r.try_into().unwrap(),
        c,
        sb: proof.s_b,
        sr: proof.s_r,
    };
    elgamal_verify(elgamal_inputs, elgamal_proof).expect('Failed ZK proof');

    let L0: NonZeroEcPoint = (CL - L.into()).try_into().unwrap();
    let R0: NonZeroEcPoint = (CR - R.into()).try_into().unwrap();

    let (rangeInputs, rangeProof) = proof.range2.to_she_proof(inputs.bit_size, prefix);
    let V2_proof = range_verify(rangeInputs, rangeProof).expect('Failed ZK proof for V2');
    assert!(V2_proof.coordinates() == V2.coordinates(), "V2 missmatch" );

    let same_encrypt_inputs = SameEncryptionUnknownRandomInputs {
        L1: L0,
        R1: R0,
        L2: V2_proof,
        R2: R_aux2,
        g,
        y1: inputs.from.try_into().unwrap(),
        y2: generator_h(),
    };

    let same_encrypt_proof = SameEncryptionUnknownRandomProof {
        Ax: proof.A_x.try_into().unwrap(),
        AL1: proof.A_b2.try_into().unwrap(),
        AL2: proof.A_v2.try_into().unwrap(),
        AR2: proof.A_r2.try_into().unwrap(),
        c,
        sb: proof.s_b2,
        sx: proof.s_x,
        sr2: proof.s_r2,
    };

    same_encrypt_unknown_random_verify(same_encrypt_inputs, same_encrypt_proof)
        .expect('Failed ZK proof');
}
