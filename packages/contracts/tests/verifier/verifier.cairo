use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};
use tongo::verifier::verifier::{poe, verify_range, oneORzero};
use tongo::verifier::utils::{challenge_commits};

use tongo::prover::utils::{compute_s, generate_random, simPOE};
use tongo::prover::prover::{prove_bit, prove_range};


#[test]
fn test_poe() {
    //setup
    let x: felt252 = 123456789;
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();

    //generatin the proof (A_x,c,s)
    let seed = 38120931;
    let k = generate_random(seed, 1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    let mut commit = array![[A_x.x(), A_x.y()]];
    let c = challenge_commits(ref commit);
    let s = compute_s(c, x, k);
    //Verify
    poe(y, g, A_x, c, s);
}

#[test]
fn test_simulatePOE() {
    //setup
    let x: felt252 = 123456789;
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();

    let (A_x, c, s) = simPOE(y.into(), g, 37192873);
    poe(y.into(), g, A_x.try_into().unwrap(), c, s);
}


/// In this test the prover commits to V_0, V_1 and only knows the exponent of V_0. He wants to
/// convice the verifier that he knows one of the two. He knows V_0, so he follows the standar
/// procedure to prove the exponent. He does not know the exponent of V_1, so he will simulates the
/// proof. In order for the verifier to not know in which case (0 or 1) the correct protocol was
/// followed, the chose of the challenge has to be modified. At the end the verifier will assert for
/// two poe the two will pass but he cannot know which one was simulated.
#[test]
fn test_OR0() {
    let seed = 371928371;
    let r = generate_random(seed, 1);

    let pi = prove_bit(0, r);
    oneORzero(pi);
}

#[test]
fn test_OR1() {
    let seed = 47198274198273;
    let r = generate_random(seed, 2);

    let pi = prove_bit(1, r);
    oneORzero(pi);
}


#[test]
fn test_range() {
    let seed = 128309213893;
    let b = 18;
    let (_, proof) = prove_range(b, seed);
    let _V = verify_range(proof);
}

use tongo::verifier::verifier::alternative_oneORzero;
use tongo::prover::prover::alternative_prove_bit;
#[test]
fn alternative_OR1() {
    let seed = 1293812;
    let r = generate_random(seed, 1);
    let b = 1;
    let proof = alternative_prove_bit(b, r);

    alternative_oneORzero(proof);
}


#[test]
fn alternative_OR0() {
    let seed = 1293812;
    let r = generate_random(seed, 1);
    let b = 0;
    let proof = alternative_prove_bit(b, r);

    alternative_oneORzero(proof);
}
