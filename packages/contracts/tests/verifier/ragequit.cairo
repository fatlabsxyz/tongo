use crate::prover::utils::{generate_random};
use starknet::ContractAddress;
use crate::prover::functions::prove_ragequit;
use tongo::verifier::ragequit::verify_ragequit;
use tongo::structs::common::{
    cipherbalance::{CipherBalance,CipherBalanceTrait},
};
use crate::prover::utils::pubkey_from_secret;
use crate::consts::{USER_ADDRESS, RELAYER_ADDRESS, LEDGER_ADDRESS};


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

    let amount = 100;
    let nonce = 12;

    let (inputs, proof, _) = prove_ragequit(
        x,
        amount,
        tranfer_address,
        currentBalance,
        nonce,
        USER_ADDRESS,
        0,
        LEDGER_ADDRESS,
        generate_random(seed, 3)
    );
    verify_ragequit(inputs, proof);
}

#[test]
fn test_relay_ragequit() {
    let seed = 21389321;

    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    // balance stored
    let initial_balance = 100;
    let r0 = generate_random(seed, 2);
    let currentBalance:CipherBalance = CipherBalanceTrait::new(y, initial_balance, r0);
    // end of setup

    let amount = 100;
    let nonce = 12;

    let (inputs, proof, _) = prove_ragequit(
        x,
        amount,
        tranfer_address,
        currentBalance,
        nonce,
        RELAYER_ADDRESS,
        2,
        LEDGER_ADDRESS,
        generate_random(seed, 3)
    );
    verify_ragequit(inputs, proof);
}
