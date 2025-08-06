use core::ec::{ EcPointTrait, NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X, GEN_Y};
use crate::verifier::utils::{generator_h};
use crate::structs::operations::{
    fund::{ InputsFund, ProofOfFund },
    withdraw::{ InputsWithdraw, ProofOfWithdraw },
    transfer::{ InputsTransfer, ProofOfTransfer },
    rollover::{ InputsRollOver, ProofOfRollOver },
    ragequit::{ InputsRagequit, ProofOfRagequit },
};
use crate::structs::common::{
    cipherbalance::CipherBalanceTrait,
};
use crate::structs::errors::{FUND, WITHDRAW, TRANSFER};
use crate::structs::traits::{Prefix, Challenge};

use crate::verifier::she::{
    poe,
    poe2,
    verify_range,
};


/// Verify knowledge of x such that y = g**x
pub fn verify_rollover(inputs: InputsRollOver, proof: ProofOfRollOver) {
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);

    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let res = poe(inputs.y.try_into().unwrap(), g, proof.Ax.try_into().unwrap(), c, proof.sx);
    //TODO: Handle the error code
    assert(res, FUND::F100);
}

//TODO: Doc
pub fn verify_fund(inputs: InputsFund, proof: ProofOfFund) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();


    let (L,R) = inputs.auxBalance.points_nz();
    let (L_audit, R_audit) = inputs.auditedBalance.points();
    let (L0, R0) = inputs.currentBalance.points();
    //TODO: handle this errorcode
    assert!(R_audit.try_into().unwrap().coordinates() == R.try_into().unwrap().coordinates(),"nope");
    
    let prefix = inputs.prefix();
//    let mut commits: Array<StarkPoint> = array![proof.Ax.into(), proof.Ar.into(), proof.Ab.into(),proof.A_auditor.into(), proof.AUX_A.into()];
    let c = proof.compute_challenge(prefix);
//    let c = challenge_commits2(prefix, ref commits);


    let res = poe(inputs.y.try_into().unwrap(), g, proof.Ax.try_into().unwrap(), c, proof.sx);
    assert(res, FUND::F100);

    let res = poe(R,g,proof.Ar.try_into().unwrap(),c, proof.sr);
    assert(res, 'Error 1');

    let res =  poe2(L,g,inputs.y.try_into().unwrap(),proof.Ab.try_into().unwrap(), c, proof.sb,proof.sr);
    assert(res, 'Error 2');


    let g_amount = g.into().mul(inputs.amount);
    let AUX_L_auditor:NonZeroEcPoint = (L_audit.into() - g_amount).try_into().unwrap();
    let res =  poe2(AUX_L_auditor, g, inputs.auditorPubKey.try_into().unwrap(), proof.A_auditor.try_into().unwrap(), c, proof.sb,proof.sr);
    assert(res, 'Error 3');


    let AUX_L:NonZeroEcPoint = (L0 - L.into()).try_into().unwrap();
    let AUX_R:NonZeroEcPoint = (R0 - R.into()).try_into().unwrap();
    let res =  poe(AUX_L, AUX_R,proof.AUX_A.try_into().unwrap(),c, proof.sx);
    //TODO: Handle Error
    assert(res, 'Error 4');


}


///TODO: Update
/// Proof of Withdraw All: validate the proof needed for withdraw all balance b. The cipher balance is
/// (L, R) = ( g**b_0 * y **r, g**r). Note that L/g**b = y**r = (g**r)**x. So we can check for the
/// correct balance proving that we know the exponent x of y' = g'**x with y'=L/g**b and g'= g**r =
/// R. The protocol runs as follow:
/// P:  k <-- R        sends    Ax = g**k, Acr = R**k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    sends    s
/// The verifier asserts:
/// - g**s == Ax * (y**c)
/// - R**s == Acr * (L/g**b)**c
pub fn verify_ragequit(inputs: InputsRagequit, proof: ProofOfRagequit) {
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);

    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let (L, R) = inputs.currentBalance.points_nz();
    let res = poe(inputs.y.try_into().unwrap(), g, proof.A_x.try_into().unwrap(), c, proof.s_x);
    assert(res, WITHDRAW::W100);


    let g_b = EcPointTrait::mul(g.into(), inputs.amount);
    let Y: NonZeroEcPoint = (L.into() - g_b).try_into().unwrap();

    let res = poe(Y, R, proof.A_cr.try_into().unwrap(), c, proof.s_x);
    assert(res, WITHDRAW::W101);
}


//TODO: Check this function 
pub fn verify_withdraw(inputs: InputsWithdraw, proof: ProofOfWithdraw) {
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    let (L0,R0) = inputs.currentBalance.points_nz();
    let (L_audit, R_audit) = inputs.auditedBalance.points_nz();

    //This is to assert knowledge of x such that y = g**x
    let res = poe(inputs.y.try_into().unwrap(), g, proof.A_x.try_into().unwrap(), c, proof.sx);
    assert(res, WITHDRAW::W100);

    //This is to assert knowledge of r such that R_audit = g**r
    let res = poe(R_audit, g, proof.A_r.try_into().unwrap(), c, proof.sr);
    assert(res, 'nope1');

    //This is to assert knowledge of amount_left and r (the same) such thad L_audit == g**amount_left y_audit**r
    let res = poe2(L_audit, g, inputs.auditorPubKey.try_into().unwrap(),proof.A_auditor.try_into().unwrap(),c,proof.sb,proof.sr);
    assert(res, 'nope2');

    //This to assert that amount_left+b is the amount actually stored in the balance of the account
    let g_b = g.into().mul(inputs.amount);
    let Y: NonZeroEcPoint = (L0.into() - g_b).try_into().unwrap();
    let res = poe2(
        Y, g, R0, proof.A.try_into().unwrap(), c, proof.sb, proof.sx
    );
    assert(res, WITHDRAW::W103);

    //This assert that V = g**amount h**r (with the same r as before, and amount>0)
    let V = verify_range(proof.range);
    //This is to assert that V == g**amount_left * h**r with the same amount_left as before (this proves that amount_left==amount > 0)
    let res = poe2(
        V,
        g,
        generator_h(),
        proof.A_v.try_into().unwrap(),
        c,
        proof.sb,
        proof.sr
    );
    assert(res, WITHDRAW::W102);
}

/// Transfer b from y = g**x to y_bar.  Public inputs: y, y_bar L = g**b y**r, L_bar = g**b
/// y_bar**r, R = g**r.
/// We need to prove:
/// 1) knowlede of x in y = g**x.
/// 2) knowlede of r in R = g**r.
/// 3) knowlede of b and r in L = g**b y**r with the same r that 2)
/// 4) knowlede of b and r in L_bar = g**b y_bar**r with the same r that 2) and same b that 3)
/// 4b) knowlede of b and r in L_audit = g**b y_audit**r with the same r that 2) and same b that 3)
/// 5) b is in range [0,2**n-1]. For this we commit V = g**b h**r and an array of n  V_i = g**bi
/// h**ri. r = sum 2**i r_i 5b) proof that bi are either 0 or 1.
/// 5c) knowledge of b and r in V = g**b y**r with the same r that 2) and b that 3)
/// 6) The proof neceary to show that the remaining balance is in range.
/// TODO: finish the doc
pub fn verify_transfer(inputs: InputsTransfer, proof: ProofOfTransfer) {
    let (CL, CR) = inputs.currentBalance.points();
    let (L,R) = inputs.transferBalanceSelf.points_nz();
    let (L_bar,R_bar) = inputs.transferBalance.points_nz();
    //TODO: errorcode maybe write this in the validate
    assert(R.coordinates() == R_bar.coordinates(), 'Nope');

    let (L_audit,R_audit) = inputs.auditedBalance.points_nz();
    //TODO: errorcode maybe write this in the validate
    assert(R.coordinates() == R_audit.coordinates(), 'Nope');

    //TODO: add POE for R_audit == g**r2
    let (L_audit_self,R_audit_self) = inputs.auditedBalanceSelf.points_nz();

    //TODO: add things to this
    let prefix = inputs.prefix();
    let c = proof.compute_challenge(prefix);

    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    // This is for asserting knowledge of x
    let res = poe(inputs.y.try_into().unwrap(), g, proof.A_x.try_into().unwrap(), c, proof.s_x);
    assert(res, TRANSFER::T100);

    // This is for asserting R = g**r
    let res = poe(R, g, proof.A_r.try_into().unwrap(), c, proof.s_r);
    assert(res, TRANSFER::T101);

    //This is for asserting L = g**b y**r
    let res = poe2(
        L,
        g,
        inputs.y.try_into().unwrap(),
        proof.A_b.try_into().unwrap(),
        c,
        proof.s_b,
        proof.s_r
    );
    assert(res, TRANSFER::T102);

    //This is for asserting L_bar = g**b y_bar**r
    let res = poe2(
        L_bar,
        g,
        inputs.y_bar.try_into().unwrap(),
        proof.A_bar.try_into().unwrap(),
        c,
        proof.s_b,
        proof.s_r
    );
    assert(res, TRANSFER::T103);

    //This is for asserting L_audit= g**b y_audit*r
    let res = poe2(
        L_audit,
        g,
        inputs.auditorPubKey.try_into().unwrap(),
        proof.A_audit.try_into().unwrap(),
        c,
        proof.s_b,
        proof.s_r
    );
    assert(res, TRANSFER::T104);


    // This is for asserting R = g**r
    let res = poe(R_audit_self, g, proof.A_r2.try_into().unwrap(), c, proof.s_r2);
    assert!(res, "Nope");

    //This is for asserting L_self_audit= g**b2 y_audit*r2
    let res = poe2(
        L_audit_self,
        g,
        inputs.auditorPubKey.try_into().unwrap(),
        proof.A_self_audit.try_into().unwrap(),
        c,
        proof.s_b2,
        proof.s_r2
    );
    //TODO: error code
    assert!(res, "Nope");

    // Now we need to show that V = g**b h**r with the same b and r.
    let V = verify_range(proof.range);
    let res = poe2(
        V,
        g,
        generator_h(),
        proof.A_v.try_into().unwrap(),
        c,
        proof.s_b,
        proof.s_r
    );
    assert(res, TRANSFER::T105);

    let Y: NonZeroEcPoint = (CL - L.into()).try_into().unwrap();

    let G: NonZeroEcPoint = (CR - R.into()).try_into().unwrap();
    let res = poe2(Y, g, G, proof.A_b2.try_into().unwrap(), c, proof.s_b2, proof.s_x);
    assert(res, TRANSFER::T106);

    // Now we need to show that V = g**b h**r2 with the same b2
    // This is for asserting that b2 is in range
    let V2 = verify_range(proof.range2);
    let res = poe2(
        V2,
        g,
        generator_h(),
        proof.A_v2.try_into().unwrap(),
        c,
        proof.s_b2,
        proof.s_r2
    );
    assert(res, TRANSFER::T107);
}


