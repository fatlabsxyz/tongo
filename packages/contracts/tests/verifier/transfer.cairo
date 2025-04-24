use tongo::prover::utils::{cipher_balance, generate_random};
use tongo::prover::prover::{ prove_transfer};
use tongo::verifier::verifier::verify_transfer;

use tongo::verifier::structs::PubKeyTrait;

#[test]
fn test_transfer() {
    // setup

    let seed = 47198274198273;
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    
    // balance stored
    let b0 = 100;
    let r0 = generate_random(seed,3);
    let (CL, CR) = cipher_balance(b0, y, r0);
    // end of setup

    let b = 12; 
    let nonce = 1;
    let x_bar = generate_random(seed,2);
    let y_bar = PubKeyTrait::from_secret(x_bar);
    
    let (inputs, proof ) = prove_transfer(x, y_bar,b0, b,CL,CR,nonce, generate_random(seed,4));

    verify_transfer(inputs,proof);
}
