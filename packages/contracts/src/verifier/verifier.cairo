use core::ec::{
    EcPointTrait,
    NonZeroEcPoint,
    stark_curve::{GEN_X, GEN_Y},
};
use crate::verifier::utils::{generator_h};
use crate::structs::operations::{
    fund::{ InputsFund, ProofOfFund },
    withdraw::{ InputsWithdraw, ProofOfWithdraw },
    transfer::{ InputsTransfer, ProofOfTransfer },
    rollover::{ InputsRollOver, ProofOfRollOver },
    ragequit::{ InputsRagequit, ProofOfRagequit },
};
use crate::structs::common::{
    cipherbalance::{CipherBalanceTrait},
    pubkey::PubKey,
    starkpoint::StarkPoint,
};
use crate::structs::traits::{Prefix, Challenge};

use crate::verifier::she;


/// Verifies the knowledge of the private key of the given public key.
/// Note: The proof is only a she::POE, we decided to wrap the functinon
/// for readabillity. The protocol runs as follow:
///
/// P:  kx <-- R        sends    Ax = g ** kx
/// V:  c <-- R         sends    c
/// P:  sk = kx + c*x   sends    sk
/// The verifier asserts:
/// - g**sx == Ax * (y**c)
///
/// EC_MUL: 2
/// EC_ADD: 1
fn verifyOwnership(y:PubKey, Ax:StarkPoint, c:felt252, sx:felt252) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let res = she::poe(y.try_into().unwrap(), g, Ax.try_into().unwrap(), c, sx);
    assert!(res, "NowOwner");
}

/// Verify the rollover operation. In this case, users have to only show the knowledge
/// of the private key.
/// 
/// EC_MUL: 2
/// EC_ADD: 1
pub fn verify_rollover(inputs: InputsRollOver, proof: ProofOfRollOver) {
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);
    verifyOwnership(inputs.y, proof.Ax, c, proof.sx);
}

/// Verify the fund operation. In this case, users have to only show the knowledge
/// of the private key.
///
/// EC_MUL: 2
/// EC_ADD: 1
pub fn verify_fund(inputs: InputsFund, proof: ProofOfFund) {
    //TODO: verify amount is u32
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);
    verifyOwnership(inputs.y, proof.Ax, c, proof.sx);
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
/// EC_MUL: 5
/// EC_ADD: 3
pub fn verify_ragequit(inputs: InputsRagequit, proof: ProofOfRagequit) {
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);

    verifyOwnership(inputs.y, proof.Ax, c, proof.sx);

    let (L1, R1) = inputs.currentBalance.points_nz();

    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let L:NonZeroEcPoint = (L1.into() - g.mul(inputs.amount)).try_into().unwrap();
    let res = she::poe(L, R1, proof.AR.try_into().unwrap(),c,proof.sx);
    assert(res, 'nope');
}


/// Verifies the withdraw operation. First, ussers have to show knowledge of the private key. Then, users  have to provide 
/// a cleartext of the amount b to withdraw. The contract will construct a cipher balance (L2, R2) = (g**b y**r2, g**r2)
/// with randomness r2='withdraw'. The contract will subtract (L2,R2) to the stored balance of the user. The user have
/// provide a zk proof that the final cipher balance is encrypting a positive (a value in (0, u**32)) amount b_left. To do
/// this when the RangeProof is verified, it returns a V = g**b_left h**r, with b_left positive. V is used as a L part of
/// a cipher blalance, users have to prove that the cipher balance (V, R_aux = g**r) is encrypting the same amount
/// that the final cipher balance.
///
/// EC_MUL: 12 + n*5 = 172 for u32 
/// EC_ADD: 8 + n*4  = 136 for u32
pub fn verify_withdraw(inputs: InputsWithdraw, proof: ProofOfWithdraw) {
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    verifyOwnership(inputs.y, proof.A_x, c, proof.sx);

    let (L0,R0) = inputs.currentBalance.points_nz();
    let L0 =  L0.into() - g.into().mul(inputs.amount);

    let V = she::verify_range(proof.range);
    she::verifySameEncryptionUnKnownRandom(
        L0.try_into().unwrap(),
        R0.try_into().unwrap(),
        V,
        proof.R_aux.try_into().unwrap(),
        g,
        inputs.y.try_into().unwrap(),
        generator_h(),
        proof.A_x.try_into().unwrap(),
        proof.A.try_into().unwrap(),
        proof.A_v.try_into().unwrap(),
        proof.A_r.try_into().unwrap(),
        c,
        proof.sb,
        proof.sx,
        proof.sr,
    );
}

/// Verifies the withdraw operation. First, ussers have to show knowledge of the private key. Then, users  have to provide 
/// two cipher balance, one (L,R) is a encryption of the transfer amount b under its public key, the other (L_bar, R_bar)
/// a encryption of the trasnfer amount b under the receiver public key. Users have to provide a ZK proof that both encryption
/// are indeed encrypting the same amount for the correct public keys. To show the transfer amount b is positive,
/// when the first RangeProof is verified, it returns a V1 = g**b h**r1, with b positive. V1 is used as a L part 
/// of a cipher blalance, users have to prove that the cipher balance (V1, R_aux1 = g**r1) is encrypting the same
/// amount that (L,R). The cipher balance after the operation would be (L0,R0) = (CL/L, CR/R) where (CL,CR) is the 
/// current balance. To show that (L0, R0) is encrypting an amount b_left positive, when the second RangeProof is
/// verified, it returns a V2 = g**b_left h**r2, with b_left positive. V2 is used as a L part 
/// of a cipher blalance, users have to prove that the cipher balance (V2, R_aux2 = g**r2) is encrypting the same
/// amount that (L0,R0)
///
/// EC_MUL: 27 + 2*n*5  = 347 for u32
/// EC_ADD: 18  + 2*n*4 = 274 for u32
pub fn verify_transfer(inputs: InputsTransfer, proof: ProofOfTransfer) {
    let (CL, CR) = inputs.currentBalance.points();
    let (L,R) = inputs.transferBalanceSelf.points_nz();
    let (L_bar,R_bar) = inputs.transferBalance.points_nz();

    //TODO: add things to this
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    verifyOwnership(inputs.y, proof.A_x, c, proof.s_x);

    she::verifySameEncryption(
        L,
        R,
        L_bar,
        R_bar,
        g,
        inputs.y.try_into().unwrap(),
        inputs.y_bar.try_into().unwrap(),
        proof.A_b.try_into().unwrap(),
        proof.A_r.try_into().unwrap(),
        proof.A_bar.try_into().unwrap(),
        proof.A_r.try_into().unwrap(),
        c,
        proof.s_b,
        proof.s_r,
        proof.s_r,
    );

    // Now we need to show that V = g**b h**r with the same b and r.
    let V = she::verify_range(proof.range);
    she::verifyElGammal(
        V,
        proof.R_aux.try_into().unwrap(),
        g,
        generator_h(),
        proof.A_v.try_into().unwrap(),
        proof.A_r.try_into().unwrap(),
        c,
        proof.s_b,
        proof.s_r,
    );


    let L0: NonZeroEcPoint = (CL - L.into()).try_into().unwrap();
    let R0: NonZeroEcPoint = (CR - R.into()).try_into().unwrap();

    let V2 = she::verify_range(proof.range2);
    she::verifySameEncryptionUnKnownRandom(
        L0,
        R0,
        V2,
        proof.R_aux2.try_into().unwrap(),
        g,
        inputs.y.try_into().unwrap(),
        generator_h(),
        proof.A_x.try_into().unwrap(),
        proof.A_b2.try_into().unwrap(),
        proof.A_v2.try_into().unwrap(),
        proof.A_r2.try_into().unwrap(),
        c,
        proof.s_b2,
        proof.s_x,
        proof.s_r2,
    );
}
