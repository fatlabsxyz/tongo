use starknet::ContractAddress;
use tongo::structs::common::cipherbalance::CipherBalanceTrait;
use tongo::structs::traits::GeneralPrefixData;
use tongo::verifier::transfer::verify_transfer;
use crate::consts::{BIT_SIZE, CHAIN_ID, USER_ADDRESS};
use crate::prover::functions::prove_transfer;
use crate::prover::utils::{generate_random, pubkey_from_secret};

#[test]
fn test_transfer() {
    // setup
    let tongoAddress: ContractAddress = 'TONGO'.try_into().unwrap();
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

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID, tongo_address: tongoAddress, sender_address: sender,
    };

    let serialized_data: Span<felt252> = array![13].span();

    let (inputs, proof, _) = prove_transfer(
        x,
        y_bar,
        b0,
        b,
        balance,
        nonce,
        BIT_SIZE,
        prefix_data,
        serialized_data,
        generate_random(seed, 4),
    );

    verify_transfer(inputs, proof);
}
