use starknet::ContractAddress;
use crate::tongo::setup::{setup_tongo};
use tongo::prover::utils::{generate_random, decipher_balance};
use tongo::prover::prover::prove_withdraw_all;
use tongo::prover::prover::prove_transfer;
use tongo::prover::prover::prove_fund;
use tongo::verifier::structs::{PubKeyTrait,CipherBalanceTrait};

use tongo::main::ITongoDispatcherTrait;

#[test]
fn audit_fund() {
    let seed = 9130123;
    let (_address,dispatcher) = setup_tongo();
    
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    
    let empty = dispatcher.get_audit(y);
    assert!(empty.is_zero()  , "wrong");
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));

    let b0 = 3124;
    dispatcher.fund(y, b0, fund_proof);

    let audit = dispatcher.get_audit(y);
    decipher_balance(b0, 'CURIOSITY', audit);
}

#[test]
fn audit_withdraw_all() {
    let seed = 4719823;
    let (_address,dispatcher) = setup_tongo();
    
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);

    let empty = dispatcher.get_audit(y);
    assert!(empty.is_zero()  , "wrong");
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));

    let b = 250;
    dispatcher.fund(y, b, fund_proof);

    let audit = dispatcher.get_audit(y);
    decipher_balance(b, 'CURIOSITY',audit);


    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs,proof)= prove_withdraw_all(x,b,tranfer_address,balance.CL,balance.CR,nonce,seed);
    
    dispatcher.withdraw_all(y,b,tranfer_address, proof);
    let audit = dispatcher.get_audit(y);
    decipher_balance(0, 'CURIOSITY', audit);
}

#[test]
fn audit_transfer() {
    let seed = 1273198273;
    let (_address,dispatcher) = setup_tongo();
    
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);

    let empty = dispatcher.get_audit(y);
    assert!(empty.is_zero()  , "wrong");


    let x_bar = generate_random(seed,2);
    let y_bar = PubKeyTrait::from_secret(x_bar);

    let empty = dispatcher.get_audit(y_bar);
    assert!(empty.is_zero()  , "wrong");
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    
    let b0 = 3124;
    dispatcher.fund(y, b0, fund_proof);
    let nonce = dispatcher.get_nonce(y);

    let audit = dispatcher.get_audit(y);
    decipher_balance(b0, 'CURIOSITY', audit);

    let balance = dispatcher.get_balance(y);
    
    let b = 100; 
    let (inputs, proof) = prove_transfer(x, y_bar, b0,b, balance.CL,balance.CR,nonce,  seed + 1);
    dispatcher.transfer(
        inputs.y,
        inputs.y_bar,
        inputs.L,
        inputs.L_bar,
        inputs.L_audit,
        inputs.R,
        proof,
    );

    let audit = dispatcher.get_audit(y);
    decipher_balance(b0-b, 'CURIOSITY', audit);

    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(b, 'CURIOSITY',audit);
}
