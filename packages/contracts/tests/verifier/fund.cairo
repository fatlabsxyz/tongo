use tongo::prover::utils::{generate_random};
use tongo::prover::prover::{prove_fund};
use tongo::verifier::verifier::{verify_fund};
use tongo::verifier::structs::{InputsFund};
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};

#[test]
fn test_fund() {
    let seed = 2194032843;    
    let x = generate_random(seed,1);
    let nonce = 123;

    //prover
    let (inputs,proof) = prove_fund(x,nonce, seed);
    
    //Verifier
    verify_fund(inputs, proof)
}


#[test]
#[should_panic(expected: 'ERROR F100')]
fn test_fund_fail() {
    let seed = 2194032843;    
    let x = generate_random(seed,1);
    let nonce = 123;

    //prover
    let (_inputs,proof) = prove_fund(x,nonce, seed);

    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = g.mul(123).try_into().unwrap();
    let inputs: InputsFund = InputsFund{y:[y.x(), y.y()],nonce:123};

    //Verifier
    verify_fund(inputs, proof)
}
