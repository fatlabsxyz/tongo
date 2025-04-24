use starknet::ContractAddress;
use crate::tongo::setup::{setup_tongo};

use tongo::prover::prover::{prove_withdraw_all, prove_withdraw, prove_fund};
use tongo::prover::utils::generate_random;
use tongo::main::ITongoDispatcherTrait;

use tongo::verifier::structs::{PubKeyTrait};


#[test]
fn test_withdraw_all() {
    let seed = 12931238;
    let (_address,dispatcher) = setup_tongo();
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    let b = 250;
    dispatcher.fund(y, b, fund_proof);

    let ((Lx,Ly), (Rx,Ry)) = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs,proof)= prove_withdraw_all(x,b,tranfer_address,[Lx,Ly],[Rx,Ry],nonce,seed);
    
    dispatcher.withdraw_all(y,b,tranfer_address, proof);
    let balance = dispatcher.get_balance(y);
    assert!(balance == ((0,0),(0,0)),"fail" );
    let buffer = dispatcher.get_buffer(y);
    assert!(buffer == ((0,0),(0,0)),"fail" )
}

#[test]
fn test_withdraw() {
    let seed = 8309218;
    let (_address,dispatcher) = setup_tongo();
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));

    let initial_balance = 250;
    let amount = 50;
    dispatcher.fund(y, initial_balance, fund_proof);

    let ((Lx,Ly), (Rx,Ry)) = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs,proof)= prove_withdraw(x,initial_balance, amount,tranfer_address,[Lx,Ly],[Rx,Ry],nonce,seed);
    
    dispatcher.withdraw(y,amount,tranfer_address, proof);
}
