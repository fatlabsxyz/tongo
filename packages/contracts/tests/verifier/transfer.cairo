use crate::prover::utils::{generate_random};
use crate::prover::functions::{prove_transfer};
use tongo::verifier::transfer::verify_transfer;

use tongo::structs::common::{
    cipherbalance::CipherBalanceTrait,
};
use crate::prover::utils::pubkey_from_secret;
use crate::consts::BIT_SIZE;
use crate::consts::USER_ADDRESS;

#[test]
fn test_transfer() {
    // setup

    let seed = 47198274198273;
    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    // balance stored
    let b0 = 100;
    let r0 = generate_random(seed, 3);
    let balance = CipherBalanceTrait::new(y, b0, r0);
    // end of setup

    let b = 12;
    let nonce = 1;
    let x_bar = generate_random(seed, 2);
    let y_bar = pubkey_from_secret(x_bar);
    let sender = USER_ADDRESS;

    let (inputs, proof,_) = prove_transfer(
        x, y_bar, b0, b, balance, nonce,BIT_SIZE,sender, generate_random(seed, 4)
    );

    verify_transfer(inputs, proof);
}
