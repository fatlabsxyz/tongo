use crate::prover::utils::{generate_random};
use crate::prover::functions::{prove_fund};
use tongo::verifier::fund::{verify_fund};

use tongo::structs::common::{
    cipherbalance::CipherBalanceTrait,
};
use crate::prover::utils::pubkey_from_secret;
use crate::consts::{USER_ADDRESS, RELAYER_ADDRESS, LEDGER_ADDRESS};

#[test]
fn test_fund() {
    let seed = 2194032843;
    let x = generate_random(seed, 1);
    let amount = 100_u128;
    let initial_balance = 0_u128;
    let fee_to_sender = 0_128;

    let nonce = 123;

    let y = pubkey_from_secret(x);
    let currentBalance = CipherBalanceTrait::new(y,initial_balance.into(), generate_random(seed+1,1));

    //prover
    let (inputs, proof, _) = prove_fund(
        x,
        amount,
        initial_balance,
        currentBalance,
        nonce,
        USER_ADDRESS,
        fee_to_sender,
        LEDGER_ADDRESS,
        seed
    );

    //Verifier
    verify_fund(inputs, proof)
}


#[test]
fn test_fund_relay() {
    let seed = 2194032843;
    let x = generate_random(seed, 1);
    let amount = 100_u128;
    let initial_balance = 0_u128;
    let fee_to_sender = 10_128;

    let nonce = 123;

    let y = pubkey_from_secret(x);
    let currentBalance = CipherBalanceTrait::new(y,initial_balance.into(), generate_random(seed+1,1));

    //prover
    let (inputs, proof, _) = prove_fund(
        x,
        amount,
        initial_balance,
        currentBalance,
        nonce,
        RELAYER_ADDRESS,
        fee_to_sender,
        LEDGER_ADDRESS,
        seed
    );

    //Verifier
    verify_fund(inputs, proof)
}

