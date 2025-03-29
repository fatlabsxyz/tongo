use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcStateTrait, EcPointTrait, NonZeroEcPoint};
use tongo::verifier::verifier::{poe,poc, verify_range,oneORzero};
use tongo::verifier::utils::{challenge_commits};
use tongo::verifier::structs::{ProofOfCipher};

use crate::verifier::utils::{prover_poe};
use tongo::prover::utils::{compute_s, generate_random, simPOE};
use tongo::prover::prover::{prove_bit, prove_range};



#[test]
fn test_poe(){
    //setup
    let x: felt252 = 123456789;
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    
    //generatin the proof (A_x,c,s)
    let seed = 38120931;
    let k = generate_random(seed, 1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    let mut commit = array![[A_x.x(),A_x.y()]];
    let c = challenge_commits(ref commit);
    let s = compute_s(c, x, k);
    //Verify
    poe([y.x(), y.y()], [g.x(),g.y()], [A_x.x(), A_x.y()], c, s);
    
    let (A_x,c, s ) = prover_poe([GEN_X, GEN_Y],x, seed);
    poe([y.x(), y.y()], [g.x(),g.y()], A_x, c, s);
}

#[test]
fn test_simulatePOE() {
    //setup
    let x: felt252 = 123456789;
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();

    let (A_x, c, s) = simPOE([y.x(), y.y()], [g.x(), g.y()],37192873);
    poe([y.x(), y.y()], [g.x(),g.y()], A_x, c, s);
}



/// In this test the prover commits to V_0, V_1 and only knows the exponent of V_0. He wants to convice
/// the verifier that he knows one of the two. He knows V_0, so he follows the standar procedure to prove
/// the exponent. He does not know the exponent of V_1, so he will simulates the proof. In order for the 
/// verifier to not know in which case (0 or 1) the correct protocol was followed, the chose of the challenge
/// has to be modified. At the end the verifier will assert for two poe the two will pass but he cannot know which one
/// was simulated.
#[test]
fn test_OR0() {
    let seed = 371928371;
    let r = generate_random(seed,1);
    
    let pi = prove_bit(0,r);
    oneORzero(pi);
}

#[test]
fn test_OR1() {
    let seed = 47198274198273;
    let r = generate_random(seed,2);
    
    let pi = prove_bit(1,r);
    oneORzero(pi);
}


#[test]
fn test_poc() { 
    let seed = 73198273;
    let x = generate_random(seed,1);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x_bar).try_into().unwrap();
    let r = generate_random(seed,3);
    let R = EcPointTrait::mul(g.try_into().unwrap(), r).try_into().unwrap();
    let r2 = r;
    let b = 20;
    let mut state = EcStateTrait::init();
        state.add_mul(b,g);
        state.add_mul(r2,y);
    let L = state.finalize_nz().unwrap();

    let b_bar = 20;
    let mut state = EcStateTrait::init();
        state.add_mul(b_bar,g);
        state.add_mul(r2,y_bar);
    let L_bar = state.finalize_nz().unwrap();
    
    let k_r = generate_random(seed,4);
    let A_r = EcPointTrait::mul(g.try_into().unwrap(), k_r).try_into().unwrap();
    let mut commit = array![[A_r.x(),A_r.y()]];
    let c = challenge_commits(ref commit);
    let s_r = compute_s(c, r, k_r);
    
    let h = y.try_into().unwrap() - y_bar.try_into().unwrap();
    let A_b = EcPointTrait::mul(h, k_r).try_into().unwrap();
    
    let pi: ProofOfCipher = ProofOfCipher {
        L:[L.x(),L.y()],
        L_bar:[L_bar.x(),L_bar.y()],
        R:[R.x(),R.y()],
        A_r:[A_r.x(), A_r.y()],
        A_b:[A_b.x(), A_b.y()],
        s_r,
        s_b:1000,
    };
    poc([y.x(),y.y()], [y_bar.x(), y_bar.y()], pi);
}


#[test]
fn test_range() {
    let seed = 128309213893;
    let b = 18; 
    let (_ , V, proof) = prove_range(b, seed);
    verify_range(V, proof)
}

