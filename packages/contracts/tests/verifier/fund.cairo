use starknet::ContractAddress;
use crate::prover::utils::{generate_random};
use crate::prover::functions::{prove_fund};
use tongo::verifier::fund::{verify_fund};
use tongo::structs::traits::{GeneralPrefixData};

use tongo::structs::common::{
    cipherbalance::CipherBalanceTrait,
};
use crate::prover::utils::pubkey_from_secret;
use crate::consts::{USER_ADDRESS, CHAIN_ID};

#[test]
fn test_fund() {
    let seed = 2194032843;
    let x = generate_random(seed, 1);
    let amount = 100_u128;
    let initial_balance = 0_u128;
    let tongoAddress: ContractAddress = 'TONGO'.try_into().unwrap();
    let sender = USER_ADDRESS;

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:tongoAddress,
        sender_address:sender,
    };

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
        prefix_data,
        seed
    );

    //Verifier
    verify_fund(inputs, proof)
}

