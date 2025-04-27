use tongo::prover::utils::{cipher_balance,generate_random};
use starknet::ContractAddress;
use tongo::prover::prover::{prove_withdraw, prove_withdraw_all};
use tongo::verifier::verifier::{verify_withdraw, verify_withdraw_all};
use tongo::verifier::structs::PubKeyTrait;


#[test]
fn test_withdraw(){
    let seed = 21389321;
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    
    // balance stored
    let initial_balance = 100;
    let r0 = generate_random(seed,2);
    let balance = cipher_balance(initial_balance, y, r0);
    // end of setup

    let amount = 10;
    let nonce =2;

    let (inputs, proof) = prove_withdraw(x, initial_balance, amount,tranfer_address, balance.CL, balance.CR,nonce, generate_random(seed, 3));
    verify_withdraw(inputs, proof);
}


#[test]
fn test_withdraw_all(){
    let seed = 21389321;

    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    
    // balance stored
    let initial_balance = 100;
    let r0 = generate_random(seed,2);
    let balance = cipher_balance(initial_balance, y, r0);
    // end of setup

    let amount = 100;
    let nonce = 12;

    let (inputs, proof) = prove_withdraw_all(x, amount ,tranfer_address, balance.CL, balance.CR, nonce, generate_random(seed, 3));
    verify_withdraw_all(inputs, proof);
}
