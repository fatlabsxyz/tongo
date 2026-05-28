use starknet::ContractAddress;
use tongo::structs::common::cipherbalance::CipherBalanceTrait;
use tongo::structs::traits::GeneralPrefixData;
use tongo::verifier::withdraw::verify_withdraw;
use crate::consts::{BIT_SIZE, CHAIN_ID, USER_ADDRESS};
use crate::prover::functions::prove_withdraw;
use crate::prover::utils::{generate_random, pubkey_from_secret};

#[test]
fn test_withdraw() {
    let seed = 21389321;
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let tongoAddress: ContractAddress = 'TONGO'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    // balance stored
    let initial_balance = 100_u128;
    let r0 = generate_random(seed, 2);
    let currentBalance = CipherBalanceTrait::new(y, initial_balance.into(), r0);
    // end of setup

    let amount = 10;
    let nonce = 2;
    let sender = USER_ADDRESS;

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID, tongo_address: tongoAddress, sender_address: sender,
    };

    let serialized_data: Span<felt252> = array![13].span();

    let (inputs, proof, _) = prove_withdraw(
        x,
        amount,
        tranfer_address,
        initial_balance,
        currentBalance,
        nonce,
        BIT_SIZE,
        prefix_data,
        serialized_data,
        generate_random(seed, 3),
    );
    verify_withdraw(inputs, proof);
}

