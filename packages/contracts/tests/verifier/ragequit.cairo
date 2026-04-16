use starknet::ContractAddress;
use crate::prover::functions::prove_ragequit;
use tongo::verifier::ragequit::verify_ragequit;
use tongo::structs::traits::{GeneralPrefixData};
use tongo::structs::common::{
    cipherbalance::{CipherBalance,CipherBalanceTrait},
};
use crate::prover::utils::{generate_random, pubkey_from_secret};
use crate::consts::{USER_ADDRESS, CHAIN_ID};


#[test]
fn test_ragequit() {
    let seed = 21389321;

    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let tongoAddress: ContractAddress = 'TONGO'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    // balance stored
    let initial_balance = 100_u128;
    let r0 = generate_random(seed, 2);
    let currentBalance:CipherBalance = CipherBalanceTrait::new(y, initial_balance.into(), r0);

    let nonce = 2;
    let sender = USER_ADDRESS;

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:tongoAddress,
        sender_address:sender,
    };

    let serialized_data: Span<felt252> = array![13].span();

    let (inputs, proof, _) = prove_ragequit(
        x,
        initial_balance,
        tranfer_address,
        currentBalance,
        nonce,
        prefix_data,
        serialized_data,
        generate_random(seed, 3)
    );
    verify_ragequit(inputs, proof);
}
