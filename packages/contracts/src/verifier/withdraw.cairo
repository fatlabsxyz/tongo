use core::ec::EcPointTrait;
use core::ec::stark_curve::{GEN_X, GEN_Y};
use she::protocols::SameEncryptionUnknownRandom::{
    SameEncryptionUnknownRandomInputs, SameEncryptionUnknownRandomProof,
    verify as same_encrypt_unknown_random_verify,
};
use she::protocols::range::verify as range_verify;
use crate::structs::common::cipherbalance::{CipherBalanceTrait};
use crate::structs::operations::withdraw::{InputsWithdraw, ProofOfWithdraw};
use crate::structs::traits::{Challenge, Prefix};
use crate::verifier::range::ConvertRangeProofImpl;
use crate::verifier::utils::{generator_h};


/// Verifies the withdraw operation. First, ussers have to show knowledge of the private key. Then,
/// users  have to provide a cleartext of the amount b to withdraw. The contract will construct a
/// cipher balance (L2, R2) = (g**b y**r2, g**r2)
/// with randomness r2='withdraw'. The contract will subtract (L2,R2) to the stored balance of the
/// user. The user have provide a zk proof that the final cipher balance is encrypting a positive (a
/// value in (0, u**32)) amount b_left. To do this when the RangeProof is verified, it returns a V =
/// g**b_left h**r, with b_left positive. V is used as a L part of a cipher blalance, users have to
/// prove that the cipher balance (V, R_aux = g**r) is encrypting the same amount that the final
/// cipher balance.
///
/// EC_MUL: 12 + n*5 = 172 for u32
/// EC_ADD: 8 + n*4  = 136 for u32
pub fn verify_withdraw(inputs: InputsWithdraw, proof: ProofOfWithdraw) {
    let prefix = inputs.compute_prefix();
    let c = proof.compute_challenge(prefix);

    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    // This verification is made as part of same_encrypt_unknown_random_verify(inputs, proof). 
    // Is is redundant here.
    //
    //verifyOwnership(inputs.y, proof.A_x, c, proof.sx);

    let (L0, R0) = inputs.currentBalance.points_nz();
    let L0 = L0.into() - g.into().mul(inputs.amount.into());
    let (V, R_aux) = inputs.auxiliarCipher.points_nz();

    let (rangeInputs, rangeProof) = proof.range.to_she_proof(inputs.bit_size, prefix);
    let V_proof = range_verify(rangeInputs, rangeProof).expect('Failed Range  proof for V');
    assert!(V_proof.coordinates() == V.coordinates(), "V missmatch" );
      

    let inputs = SameEncryptionUnknownRandomInputs {
        L1: L0.try_into().unwrap(),
        R1: R0,
        L2: V_proof,
        R2: R_aux,
        g,
        y1: inputs.y.try_into().unwrap(),
        y2: generator_h(),
    };

    let proof = SameEncryptionUnknownRandomProof {
        Ax: proof.A_x.try_into().unwrap(),
        AL1: proof.A.try_into().unwrap(),
        AL2: proof.A_v.try_into().unwrap(),
        AR2: proof.A_r.try_into().unwrap(),
        c,
        sb: proof.sb,
        sx: proof.sx,
        sr2: proof.sr,
    };
    same_encrypt_unknown_random_verify(inputs, proof).expect('Failed ZK proof');
}
