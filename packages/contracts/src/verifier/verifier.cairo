use core::ec::{EcStateTrait, EcPointTrait, NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X, GEN_Y,ORDER};
use crate::verifier::utils::{in_order, on_curve};
use crate::verifier::utils::{g_epoch};
use crate::verifier::utils::{feltXOR, challenge_commits};
use crate::verifier::structs::{Inputs,InputsWithdraw, Proof, ProofOfBit, ProofOfCipher, ProofOfWithdraw};
use crate::verifier::structs::{InputsTransfer, ProofOfTransfer};
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;


pub fn verify(inputs:Inputs, proof:Proof) {
    let mut commits = array![proof.A_x, proof.A_n];
    let c = challenge_commits(ref commits);
    poe(inputs.y, [GEN_X,GEN_Y], proof.A_x, c, proof.s_x);
//    let g_epoch:NonZeroEcPoint = g_epoch(inputs.epoch).try_into().unwrap();
    poe(proof.nonce, g_epoch(inputs.epoch), proof.A_n, c, proof.s_x);
}

pub fn verify_transfer(inputs: InputsTransfer, proof: ProofOfTransfer) {
    let mut commits = array![
        proof.A_x,
        proof.A_n,
        proof.A_r,
        proof.A_b,
        proof.A_b2,
        proof.A_v,
        proof.A_v2,
        proof.A_bar,
    ];
    let c = challenge_commits(ref commits);
    poe(inputs.y, [GEN_X,GEN_Y], proof.A_x, c, proof.s_x);
//    let g_epoch:NonZeroEcPoint = g_epoch(inputs.epoch).try_into().unwrap();
    poe(proof.nonce, g_epoch(inputs.epoch), proof.A_n, c, proof.s_x);

    // This is for asserting knowledge of x
    poe(inputs.y, [GEN_X,GEN_Y], proof.A_x, c, proof.s_x);
    
    // This is for asserting R = g**r
    poe(inputs.R, [GEN_X,GEN_Y], proof.A_r, c, proof.s_r );
    
    //This is for asserting L = g**b y**r
    poe2(inputs.L, [GEN_X,GEN_Y], inputs.y, proof.A_b, c, proof.s_b,proof.s_r);

    //This is for asserting L_bar = g**b y_bar**r
    poe2(inputs.L_bar, [GEN_X,GEN_Y], inputs.y_bar, proof.A_bar, c, proof.s_b,proof.s_r);

    // Now we need to show that V = g**b h**r with the same b and r.
    poe2(inputs.V, [GEN_X,GEN_Y], inputs.h, proof.A_v, c, proof.s_b,proof.s_r);
    por(inputs.V, proof.range);

    let CL = EcPointTrait::new(*inputs.CL.span()[0], *inputs.CL.span()[1]).unwrap();
    let L = EcPointTrait::new(*inputs.L.span()[0], *inputs.L.span()[1]).unwrap();
    let Y:NonZeroEcPoint = (CL - L).try_into().unwrap();

    let CR = EcPointTrait::new(*inputs.CR.span()[0], *inputs.CR.span()[1]).unwrap();
    let R = EcPointTrait::new(*inputs.R.span()[0], *inputs.R.span()[1]).unwrap();
    let G:NonZeroEcPoint = (CR - R).try_into().unwrap();
    poe2([Y.x(), Y.y()], [GEN_X, GEN_Y], [G.x(), G.y()], proof.A_b2,c, proof.s_b2, proof.s_x );


    // Now we need to show that V = g**b h**r2 with the same b2
    poe2(inputs.V2, [GEN_X,GEN_Y], inputs.h, proof.A_v2, c, proof.s_b2, proof.s_r2);

    // This is for asserting that b2 is in range 
    por(inputs.V2, proof.range2);
}

/// Proof of Withdraw: validate the proof needed for withdraw all balance b. The cipher balance is
/// (L, R) = ( g**b_0 * y **r, g**r). Note that L/g**b = y**r = (g**r)**x. So we can check for the correct
/// balance proving that we know the exponent x of y' = g'**x with y'=L/g**b and g'= g**r = R. We also need to
/// check that the exponent x is the same of the private key y = g ** x and that the nonce u = g_epoc ** x
pub fn verify_withdraw(inputs:InputsWithdraw, proof:ProofOfWithdraw) {
    let mut commits = array![proof.A_x, proof.A_n,proof.A_cr];
    let c = challenge_commits(ref commits);
    poe(inputs.y, [GEN_X,GEN_Y], proof.A_x, c, proof.s_x);
    poe(proof.nonce, g_epoch(inputs.epoch), proof.A_n, c, proof.s_x);

    let L = EcPointTrait::new(*inputs.L.span()[0], *inputs.L.span()[1]).unwrap();

    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let g_b = EcPointTrait::mul(g,inputs.amount);
    let h: NonZeroEcPoint = (L - g_b.try_into().unwrap()).try_into().unwrap();
    poe([h.x(), h.y()], [*inputs.R.span()[0], *inputs.R.span()[1]], proof.A_cr,c ,proof.s_x);
}

/// Proof of Exponent: validate a proof of knowledge of the exponent y = g ** x. The sigma protocols runs
/// V:  k <-- R        sends    A_x = g ** k
/// P:  c <-- R        sends    c
/// V:  s = k + c*x    sends    s
/// The verifier asserts  g**s == A_x * (y**c)
pub fn poe(y: [felt252;2], g: [felt252;2], A_x: [felt252;2], c:felt252, s:felt252 ) {
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
    assert!(LHS.coordinates() == RHS.coordinates(), "Failed the proof of exponent");
}

pub fn poe2(y: [felt252;2], g1: [felt252;2],g2:[felt252;2], A: [felt252;2], c:felt252, s1:felt252, s2:felt252 ) {
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
    assert!(LHS.coordinates() == RHS.coordinates(), "Failed the proof of exponent");
}

/// Prof of Ciphertext: validate the proof that the two ciphertext (L,R) = (g**b y**r, g**r ) and (L_bar, R) = (g**b y_bar**r , g**r)
/// are valids ciphertext for b under y and y_bar with the same r and the same b.
pub fn poc(y:[felt252;2], y_bar:[felt252;2], pi: ProofOfCipher) {

    let mut commits = array![pi.A_r];
    let c = challenge_commits(ref commits);
    poe(pi.R, [GEN_X,GEN_Y], pi.A_r, c, pi.s_r );
    
    let y_p = EcPointTrait::new(*y.span()[0], *y.span()[1]).unwrap();
    let y_barp = EcPointTrait::new(*y_bar.span()[0], *y_bar.span()[1]).unwrap();
    let h: NonZeroEcPoint = (y_p - y_barp).try_into().unwrap();

    let L_p = EcPointTrait::new(*pi.L.span()[0], *pi.L.span()[1]).unwrap();
    let L_barp = EcPointTrait::new(*pi.L_bar.span()[0], *pi.L_bar.span()[1]).unwrap();
    let h_r:NonZeroEcPoint = (L_p - L_barp).try_into().unwrap();
    
    poe([h_r.x(),h_r.y()], [h.x(), h.y()], pi.A_b, c, pi.s_r);
    //TODO: This has to be complemented with the proof of range
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
    
    poe(pi.V,pi.h,pi.A0,pi.c0,pi.s0);

    let gen = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    //TODO: Precompute -gen
    let V_0 = EcPointTrait::new(*pi.V.span()[0], *pi.V.span()[1]).unwrap();
    let V1: NonZeroEcPoint = (V_0 - gen).try_into().unwrap();
    
    poe([V1.x(), V1.y()],pi.h,pi.A1,c1,pi.s1);
}

///TODO: think if h = y leads to a posible attack.
/// rta: Yes. Given V = g**b h**r if h has a known log with respect to b then a proof can be forge to any value of b.
/// solution. h has to be another generator without known log with respecto to g. I think the standar way of select one
/// is the nothing-up-my-sleve algorithm. research. 
pub fn por(V:[felt252;2], proof: Span<ProofOfBit>) {
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
    let LHS = state.finalize_nz().unwrap();
    assert!([LHS.x(), LHS.y()] == V, "failed");
}

/// Transfer b from y = g**x to y_bar.  Public inputs: y, y_bar L = g**b y**r, L_bar = g**b y_bar**r, R = g**r.
/// We need to prove:
/// 1) knowlede of x in y = g**x.
/// 2) knowlede of r in R = g**r.
/// 3) knowlede of b and r in L = g**b y**r with the same r that 2)
/// 4) knowlede of b and r in L_bar = g**b y_bar**r with the same r that 2) and same b that 3)
/// 5) b is in range [0,2**n-1]. For this we commit V = g**b h**r and an array of n  V_i = g**bi h**ri. r = sum 2**i r_i
/// 5b) proof that bi are either 0 or 1.
/// 5c) knowledge of b and r in V = g**b y**r with the same r that 2) and b that 3)
/// 6) The proof neceary to show that the remaining balance is in range.
/// TODO: finish the doc
pub fn proofoftransfer(
        CL:[felt252;2],
        CR:[felt252;2],
        y:[felt252;2],
        y_bar:[felt252;2],
        h:[felt252;2],
        L:[felt252;2],
        L_bar:[felt252;2],
        R:[felt252;2],
        A_r:[felt252;2],
        A_x:[felt252;2],
        //A_b = g**kb y**kr
        A_b:[felt252;2],
        A_bar:[felt252;2],
        A_v:[felt252;2],
        A_b2:[felt252;2],
        A_v2:[felt252;2],
        s_r:felt252,
        s_x:felt252,
        s_b:felt252,
        s_b2:felt252,
        s_r2:felt252,
        V:[felt252;2],
        V2:[felt252;2],
        proof: Array<ProofOfBit>,
        proof2: Array<ProofOfBit>,
    ) {

    // TODO: h tiene que estar hardcodeado en el verifier.
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(*A_x.span()[0])
            .update(*A_x.span()[1])
            .update(*A_r.span()[0])
            .update(*A_r.span()[1])
            .update(*A_b.span()[0])
            .update(*A_b.span()[1])
            .update(*A_bar.span()[0])
            .update(*A_bar.span()[1])
            .update(*A_v.span()[0])
            .update(*A_v.span()[1])
            .update(*A_b2.span()[0])
            .update(*A_b2.span()[1])
            .update(*A_v2.span()[0])
            .update(*A_v2.span()[1])
            .update(salt)
        .finalize();
        salt = salt + 1;
    };

    // This is for asserting knowledge of x
    poe(y, [GEN_X,GEN_Y], A_x, c, s_x);
    
    // This is for asserting R = g**r
    poe(R, [GEN_X,GEN_Y], A_r, c, s_r );
    
    //This is for asserting L = g**b y**r
    poe2(L, [GEN_X,GEN_Y], y, A_b, c, s_b,s_r);

    //This is for asserting L_bar = g**b y_bar**r
    poe2(L_bar, [GEN_X,GEN_Y], y_bar, A_bar, c, s_b,s_r);

    // Now we need to show that V = g**b h**r with the same b and r.
    poe2(V, [GEN_X,GEN_Y], h, A_v, c, s_b,s_r);

    // This is for asserting that b is in range 
    por(V, proof.span());

    let CL = EcPointTrait::new(*CL.span()[0], *CL.span()[1]).unwrap();
    let L = EcPointTrait::new(*L.span()[0], *L.span()[1]).unwrap();
    let Y:NonZeroEcPoint = (CL - L).try_into().unwrap();

    let CR = EcPointTrait::new(*CR.span()[0], *CR.span()[1]).unwrap();
    let R = EcPointTrait::new(*R.span()[0], *R.span()[1]).unwrap();
    let G:NonZeroEcPoint = (CR - R).try_into().unwrap();
    poe2([Y.x(), Y.y()], [GEN_X, GEN_Y], [G.x(), G.y()], A_b2,c, s_b2, s_x );


    // Now we need to show that V = g**b h**r2 with the same b2
    poe2(V2, [GEN_X,GEN_Y], h, A_v2, c, s_b2,s_r2);

    // This is for asserting that b2 is in range 
    por(V2, proof2.span());
}
