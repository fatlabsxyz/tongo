use core::ec::{EcStateTrait, EcPointTrait, NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X, GEN_Y};
use crate::verifier::utils::{in_order, on_curve};
use crate::verifier::utils::{ generator_h, view_key};
use crate::verifier::utils::{feltXOR, challenge_commits};
use crate::verifier::utils::{compute_prefix, challenge_commits2};
use crate::verifier::structs::{InputsWithdraw, ProofOfBit, ProofOfWitdhrawAll, ProofOfBit2};
use crate::verifier::structs::{InputsTransfer, ProofOfTransfer};
use crate::verifier::structs::{ProofOfWithdraw};
use crate::verifier::structs::{InputsFund,ProofOfFund};
use crate::errors::{FUND, WITHDRAW, TRANSFER};


/// Proof of Exponent: validate a proof of knowledge of the exponent y = g ** x. The sigma protocols runs
/// V:  k <-- R        sends    A_x = g ** k
/// P:  c <-- R        sends    c
/// V:  s = k + c*x    sends    s
/// The verifier asserts  g**s == A_x * (y**c)
pub fn poe(y: [felt252;2], g: [felt252;2], A_x: [felt252;2], c:felt252, s:felt252 ) -> bool {
    assert!(on_curve(y), "failed");
    assert!(on_curve(g), "failed");
    assert!(on_curve(A_x), "failed");
    assert!(in_order(c), "failed");
    assert!(in_order(s), "failed");

    let g = EcPointTrait::new(*g.span()[0], *g.span()[1]).unwrap();
    let y = EcPointTrait::new_nz(*y.span()[0], *y.span()[1]).unwrap();
    let A_x = EcPointTrait::new_nz(*A_x.span()[0], *A_x.span()[1]).unwrap();
        
    let mut state = EcStateTrait::init();
        state.add(A_x);
        state.add_mul(c, y);
    let RHS = state.finalize_nz().unwrap();
    let LHS:NonZeroEcPoint = EcPointTrait::mul(g, s).try_into().unwrap();

    LHS.coordinates() == RHS.coordinates()
}


/// Proof of Exponent 2: validate a proof of knowledge of the exponent y = g**x h**r. The sigma protocols runs
/// V:  kx,kr <-- R        sends    A = g ** kx h**kr
/// P:  c <-- R            sends    c
/// V:  sx = k + c*x 
/// V:  sr = k + c*r       send sr, sx
/// The verifier asserts  g**sx h**sr == A * (y**c)
pub fn poe2(y: [felt252;2], g1: [felt252;2],g2:[felt252;2], A: [felt252;2], c:felt252, s1:felt252, s2:felt252 ) -> bool {
    let g1 = EcPointTrait::new_nz(*g1.span()[0], *g1.span()[1]).unwrap();
    let g2 = EcPointTrait::new_nz(*g2.span()[0], *g2.span()[1]).unwrap();
    let y = EcPointTrait::new_nz(*y.span()[0], *y.span()[1]).unwrap();
    let A = EcPointTrait::new_nz(*A.span()[0], *A.span()[1]).unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(s1,g1);
        state.add_mul(s2,g2);
    let LHS = state.finalize_nz().unwrap();
        
    let mut state = EcStateTrait::init();
        state.add(A);
        state.add_mul(c, y);
    let RHS = state.finalize_nz().unwrap();

    LHS.coordinates() == RHS.coordinates()
}

pub fn verify_fund(inputs: InputsFund, proof: ProofOfFund){
    let mut seq: Array<felt252> = array![
        'fund',
        inputs.y.x,
        inputs.y.y,
        inputs.nonce.into(),
    ];
    let prefix = compute_prefix(ref seq);
    let mut commits = array![proof.Ax];
    let c = challenge_commits2(prefix, ref commits);

    let res = poe([inputs.y.x, inputs.y.y], [GEN_X,GEN_Y],proof.Ax,c, proof.sx);
    assert(res, FUND::F100);
}


/// Proof of Withdraw: validate the proof needed for withdraw all balance b. The cipher balance is
/// (L, R) = ( g**b_0 * y **r, g**r). Note that L/g**b = y**r = (g**r)**x. So we can check for the correct
/// balance proving that we know the exponent x of y' = g'**x with y'=L/g**b and g'= g**r = R. 
pub fn verify_withdraw_all(inputs:InputsWithdraw, proof:ProofOfWitdhrawAll) {
    let mut seq: Array<felt252> = array![
        'withdraw_all',
        inputs.y.x,
        inputs.y.y,
        inputs.to.into(),
        inputs.nonce.into(),
    ];
    let prefix = compute_prefix(ref seq);
    let mut commits = array![proof.A_x,proof.A_cr];
    let c = challenge_commits2(prefix, ref commits);

    let res = poe([inputs.y.x, inputs.y.y], [GEN_X,GEN_Y], proof.A_x, c, proof.s_x);
    assert(res, WITHDRAW::W100);

    let L = EcPointTrait::new(*inputs.L.span()[0], *inputs.L.span()[1]).unwrap();

    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let g_b = EcPointTrait::mul(g,inputs.amount);
    let Y: NonZeroEcPoint = (L - g_b.try_into().unwrap()).try_into().unwrap();

    let res = poe([Y.x(), Y.y()], [*inputs.R.span()[0], *inputs.R.span()[1]], proof.A_cr,c ,proof.s_x);
    assert(res, WITHDRAW::W101);
}


pub fn verify_withdraw(inputs:InputsWithdraw, proof: ProofOfWithdraw) {
    let mut seq: Array<felt252> = array![
        'withdraw',
        inputs.y.x,
        inputs.y.y,
        inputs.to.into(),
        inputs.nonce.into(),
    ];
    let prefix = compute_prefix(ref seq);

    let mut commits = array![proof.A_x, proof.A, proof.A_v];
    let c = challenge_commits2(prefix,ref commits);

    let res = poe([inputs.y.x, inputs.y.y], [GEN_X, GEN_Y], proof.A_x, c, proof.sx);
    assert(res, WITHDRAW::W100);

    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let g_b  = EcPointTrait::mul(g,inputs.amount).try_into().unwrap();
    let L = EcPointTrait::new(*inputs.L.span()[0],*inputs.L.span()[1]).unwrap();
    let L: NonZeroEcPoint = (L - g_b).try_into().unwrap();
    let res =poe2(
        [L.x(),L.y()],
        [GEN_X, GEN_Y],
        [*inputs.R.span()[0], *inputs.R.span()[1]],
        [*proof.A.span()[0], *proof.A.span()[1]],
        c,
        proof.sb,
        proof.sx
    );
    assert(res, 'POE2');
    assert(res,WITHDRAW::W103);


    let V = verify_range(proof.range);
    let res = poe2(
        V,
        [GEN_X, GEN_Y],
        generator_h(),
        [*proof.A_v.span()[0],*proof.A_v.span()[1]],
        c,
        proof.sb,
        proof.sr
    );
    assert(res,WITHDRAW::W102);

}

/// Transfer b from y = g**x to y_bar.  Public inputs: y, y_bar L = g**b y**r, L_bar = g**b y_bar**r, R = g**r.
/// We need to prove:
/// 1) knowlede of x in y = g**x.
/// 2) knowlede of r in R = g**r.
/// 3) knowlede of b and r in L = g**b y**r with the same r that 2)
/// 4) knowlede of b and r in L_bar = g**b y_bar**r with the same r that 2) and same b that 3)
/// 4b) knowlede of b and r in L_audit = g**b y_audit**r with the same r that 2) and same b that 3)
/// 5) b is in range [0,2**n-1]. For this we commit V = g**b h**r and an array of n  V_i = g**bi h**ri. r = sum 2**i r_i
/// 5b) proof that bi are either 0 or 1.
/// 5c) knowledge of b and r in V = g**b y**r with the same r that 2) and b that 3)
/// 6) The proof neceary to show that the remaining balance is in range.
/// TODO: finish the doc
pub fn verify_transfer(inputs: InputsTransfer, proof: ProofOfTransfer) {
    let mut seq: Array<felt252> = array![
        'transfer',
        inputs.y.x,
        inputs.y.y,
        inputs.y_bar.x,
        inputs.y_bar.y,
        *inputs.L.span()[0],
        *inputs.L.span()[1],
        *inputs.R.span()[0],
        *inputs.R.span()[1],
        inputs.nonce.into(),
    ];
    let prefix = compute_prefix(ref seq);

    let mut commits = array![
        proof.A_x,
        proof.A_r,
        proof.A_b,
        proof.A_b2,
        proof.A_v,
        proof.A_v2,
        proof.A_bar,
        proof.A_audit,
    ];
    let c = challenge_commits2(prefix, ref commits);

    // This is for asserting knowledge of x
    let res = poe([inputs.y.x, inputs.y.y], [GEN_X,GEN_Y], proof.A_x, c, proof.s_x);
    assert(res, TRANSFER::T100);
    
    // This is for asserting R = g**r
    let res = poe(inputs.R, [GEN_X,GEN_Y], proof.A_r, c, proof.s_r );
    assert(res, TRANSFER::T101);
    
    //This is for asserting L = g**b y**r
    let res = poe2(inputs.L, [GEN_X,GEN_Y], [inputs.y.x, inputs.y.y], proof.A_b, c, proof.s_b,proof.s_r);
    assert(res, TRANSFER::T102);

    //This is for asserting L_bar = g**b y_bar**r
    let res = poe2(inputs.L_bar, [GEN_X,GEN_Y], [inputs.y_bar.x, inputs.y_bar.y], proof.A_bar, c, proof.s_b,proof.s_r);
    assert(res, TRANSFER::T103);

    //This is for asserting L_audit= g**b y_audit*r
    let res = poe2(inputs.L_audit, [GEN_X,GEN_Y], [view_key().x, view_key().y], proof.A_audit, c, proof.s_b,proof.s_r);
    assert(res, TRANSFER::T104);

    // Now we need to show that V = g**b h**r with the same b and r.
    let V =  verify_range(proof.range);
    let res = poe2(V, [GEN_X,GEN_Y], generator_h(), proof.A_v, c, proof.s_b,proof.s_r);
    assert(res, TRANSFER::T105);

    let CL = EcPointTrait::new(*inputs.CL.span()[0], *inputs.CL.span()[1]).unwrap();
    let L = EcPointTrait::new(*inputs.L.span()[0], *inputs.L.span()[1]).unwrap();
    let Y:NonZeroEcPoint = (CL - L).try_into().unwrap();

    let CR = EcPointTrait::new(*inputs.CR.span()[0], *inputs.CR.span()[1]).unwrap();
    let R = EcPointTrait::new(*inputs.R.span()[0], *inputs.R.span()[1]).unwrap();
    let G:NonZeroEcPoint = (CR - R).try_into().unwrap();
    let res = poe2([Y.x(), Y.y()], [GEN_X, GEN_Y], [G.x(), G.y()], proof.A_b2,c, proof.s_b2, proof.s_x );
    assert(res, TRANSFER::T106);


    // Now we need to show that V = g**b h**r2 with the same b2
    // This is for asserting that b2 is in range 
    let V2 = verify_range(proof.range2);
    let res = poe2(V2, [GEN_X,GEN_Y], generator_h(), proof.A_v2, c, proof.s_b2, proof.s_r2);
    assert(res, TRANSFER::T107);
}


/// Proof of Bit: validate that a commited V = g**b h**r is the ciphertext of  either b=0 OR b=1. 
/// If b = 0 then V = h**r and a proof of exponet for r is enought. If b=1 then V/g = h**r could be also 
/// proven with a poe. This is combined in a OR statement and the protocol can valitates that one of the cases is
/// valid without leak which one is valid.
pub fn oneORzero(pi: ProofOfBit) {
    let mut commits = array![pi.A0, pi.A1];
    let c = challenge_commits(ref commits);
    //TODO: update this challenge
    let c1 = feltXOR(c,pi.c0);
    
    poe(pi.V,generator_h(),pi.A0,pi.c0,pi.s0);

    let gen = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    //TODO: Precompute -gen
    let V_0 = EcPointTrait::new(*pi.V.span()[0], *pi.V.span()[1]).unwrap();
    let V1: NonZeroEcPoint = (V_0 - gen).try_into().unwrap();
    
    poe([V1.x(), V1.y()],generator_h(),pi.A1,c1,pi.s1);
}

/// Verify that a span of Vi = g**b_i h**r_i are encoding either b=1 or b=0 and that
/// those bi are indeed the binary decomposition b = sum_i b_i 2**i. With the b that
/// is encoded in V = g**b h**r. (Note that r = sim_i r_i 2**i)
/// TODO: This could (and probably should) be change to bulletproof.
pub fn verify_range(proof: Span<ProofOfBit>) -> [felt252;2] {
    let mut i:u32 = 0;
    let mut state = EcStateTrait::init();
    let mut pow: felt252 = 1;
    while i < 32 {
        let pi = *proof[i];
        oneORzero(pi) ;
        let vi = EcPointTrait::new_nz(*pi.V.span()[0], *pi.V.span()[1]).unwrap();
        state.add_mul(pow,vi);
        pow = 2*pow;
        i = i + 1; 
    };
    let V = state.finalize_nz().unwrap();
    return [V.x(), V.y()];
}

/// Alternative proof of commit a bit or one or zero. It seems it is not as efficient
/// as the proof we are ussing now but this can be check all at one. This could be log(n) 
/// instead linear in n as the other one.
/// TODO: test and decide (If we change to bulletproof this has no sense)
pub fn alternative_oneORzero(proof:ProofOfBit2) {
    let [h_x, h_y] = generator_h();
    
    let mut commits = array![proof.A, proof.B];
    let c = challenge_commits(ref commits);

    poe2(proof.V, [GEN_X,GEN_Y], generator_h(),proof.A,c ,proof.sb, proof.sr );

    let h = EcPointTrait::new(h_x,h_y).unwrap();
    let V = EcPointTrait::new(*proof.V.span()[0],*proof.V.span()[1]).unwrap();
    let B = EcPointTrait::new(*proof.B.span()[0],*proof.B.span()[1]).unwrap();
    let LHS = h.mul(proof.z);
    let RHS = V.mul(c) - V.mul(proof.sb) + B;
    assert!(LHS.try_into().unwrap().coordinates() == RHS.try_into().unwrap().coordinates(), "asd2");
}
