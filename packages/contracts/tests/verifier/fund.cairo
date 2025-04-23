use tongo::prover::utils::{generate_random};
use tongo::prover::prover::{prove_fund};
use tongo::verifier::verifier::{verify_fund};

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
