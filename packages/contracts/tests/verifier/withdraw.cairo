use crate::prover::utils::{generate_random};
use starknet::ContractAddress;
use crate::prover::functions::{prove_withdraw, prove_ragequit};
use tongo::verifier::verifier::{verify_withdraw, verify_ragequit};
use tongo::structs::common::{
    cipherbalance::{CipherBalance,CipherBalanceTrait},
};
use crate::consts::AUDITOR_KEY;
use crate::prover::utils::pubkey_from_secret;

#[test]
fn test_withdraw() {
    let seed = 21389321;
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    // balance stored
    let initial_balance = 100;
    let r0 = generate_random(seed, 2);
    let currentBalance = CipherBalanceTrait::new(y, initial_balance, r0);
    // end of setup

    let amount = 10;
    let nonce = 2;

    let (inputs, proof) = prove_withdraw(
        x,
        initial_balance,
        amount,
        tranfer_address,
        currentBalance,
        nonce,
        AUDITOR_KEY(),
        generate_random(seed, 3)
    );
    verify_withdraw(inputs, proof);
}


#[test]
fn test_ragequit() {
    let seed = 21389321;

    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    // balance stored
    let initial_balance = 100;
    let r0 = generate_random(seed, 2);
    let currentBalance:CipherBalance = CipherBalanceTrait::new(y, initial_balance, r0);
    // end of setup
    // end of setup

    let amount = 100;
    let nonce = 12;

    let (inputs, proof) = prove_ragequit(
        x, amount, tranfer_address, currentBalance, nonce, generate_random(seed, 3)
    );
    verify_ragequit(inputs, proof);
}
