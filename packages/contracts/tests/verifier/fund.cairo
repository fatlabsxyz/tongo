use crate::prover::utils::{generate_random};
use crate::prover::functions::{prove_fund};
use tongo::verifier::verifier::{verify_fund};

use tongo::structs::common::{
    cipherbalance::CipherBalanceTrait,
};
use crate::consts::AUDITOR_KEY;
use crate::prover::utils::pubkey_from_secret;

#[test]
fn test_fund() {
    let seed = 2194032843;
    let x = generate_random(seed, 1);
    let amount = 100;
    let initial_balance = 0;
    let nonce = 123;

    let y = pubkey_from_secret(x);
    let currentBalance = CipherBalanceTrait::new(y,initial_balance, generate_random(seed+1,1));

    //prover
    let (inputs, proof) = prove_fund(x,amount, initial_balance, currentBalance, nonce,AUDITOR_KEY(), seed);

    //Verifier
    verify_fund(inputs, proof)
}


//#[test]
//#[should_panic(expected: 'ERROR F100')]
//fn test_fund_fail() {
//    let seed = 2194032843;
//    let x = generate_random(seed, 1);
//    let nonce = 123;
//
//    //prover
//    let (_inputs, proof) = prove_fund(x, nonce, seed);
//
//    let y = pubkey_from_secret(1293);
//    let inputs: InputsFund = InputsFund { y: y, nonce: 123 };
//
//    //Verifier
//    verify_fund(inputs, proof)
//}
