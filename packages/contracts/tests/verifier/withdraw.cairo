use crate::prover::utils::{generate_random};
use starknet::ContractAddress;
use crate::prover::functions::prove_withdraw;
use tongo::verifier::withdraw::verify_withdraw;
use tongo::structs::common::{
    cipherbalance::CipherBalanceTrait,
};
use crate::prover::utils::pubkey_from_secret;
use crate::consts::BIT_SIZE;

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

    let (inputs, proof, _) = prove_withdraw(
        x,
        amount,
        tranfer_address,
        initial_balance,
        currentBalance,
        nonce,
        BIT_SIZE,
        generate_random(seed, 3)
    );
    verify_withdraw(inputs, proof);
}

