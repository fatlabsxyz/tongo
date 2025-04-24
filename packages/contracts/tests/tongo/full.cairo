use tongo::prover::utils::{generate_random, decipher_balance};
use core::ec::{EcPointTrait};
use core::ec::{ NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};
use tongo::prover::prover::{prove_transfer, prove_fund, prove_withdraw};
use starknet::ContractAddress;
use tongo::verifier::structs::PubKey;

use tongo::main::ITongoDispatcherTrait;

#[test]
fn full(){
    //set up
    let seed = 23097198721;
    let (_address,dispatcher) = setup_tongo();

    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let y:PubKey = PubKey {x: y.x(), y: y.y()};
    let x_bar = generate_random(seed,2);

    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
    let y_bar:PubKey = PubKey {x: y_bar.x(), y: y_bar.y()};

    // The initial buffers, balance, and audits should be 0
        let buffer = dispatcher.get_buffer(y);
        assert!(buffer == ((0,0),(0,0)), "Initial buffer not 0");

        let balance = dispatcher.get_balance(y);
        assert!(balance == ((0,0),(0,0)), "Initial balance not 0");

        let audit = dispatcher.get_audit(y);
        assert!(audit == ((0,0),(0,0)), "Initial audit not 0");

        let buffer = dispatcher.get_buffer(y_bar);
        assert!(buffer == ((0,0),(0,0)), "Initial buffer not 0");

        let balance = dispatcher.get_balance(y_bar);
        assert!(balance == ((0,0),(0,0)), "Initial balance not 0");

        let audit = dispatcher.get_audit(y_bar);
        assert!(audit == ((0,0),(0,0)), "Initial audit not 0");

        // The initial nonces should be 0
        let nonce = dispatcher.get_nonce(y_bar);
        assert!(nonce == 0, "Initial nonce not 0");

        let nonce = dispatcher.get_nonce(y);
        assert!(nonce == 0, "Initial nonce not 0");

    // Funding the y account
    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    let initial_balance = 3124;
    dispatcher.fund(y, initial_balance, fund_proof);

        //Bufer should be 0, balance initial_balance and audit initial_balance
        let buffer = dispatcher.get_buffer(y);
        assert!(buffer == ((0,0),(0,0)), "Initial buffer not 0");

        let audit = dispatcher.get_audit(y);
        decipher_balance(initial_balance, 'CURIOSITY', audit);

        let balance = dispatcher.get_balance(y);
        decipher_balance(initial_balance, x, balance);

    let ((CLx,CLy),(CRx,CRy)) = balance; 
    let nonce = dispatcher.get_nonce(y);
    assert!(nonce ==1, "Nonce is not 1");
    
    let transfer_amount = 100; 
    let (inputs, proof) = prove_transfer(x, y_bar, initial_balance, transfer_amount, [CLx,CLy], [CRx,CRy],nonce, seed + 1);
    dispatcher.transfer(
        inputs.y,
        inputs.y_bar,
        inputs.L,
        inputs.L_bar,
        inputs.L_audit,
        inputs.R,
        proof,
    );

    // nonce for y should be 2
        let nonce = dispatcher.get_nonce(y);
        assert!(nonce == 2, "Nonce is not 2");

    //For y balance and audit  should be initial-transfer, buffer 0
        let buffer = dispatcher.get_buffer(y);
        assert!(buffer == ((0,0),(0,0)), "Buffer is not 0");

        let audit = dispatcher.get_audit(y);
        decipher_balance(initial_balance - transfer_amount, 'CURIOSITY', audit);

        let balance = dispatcher.get_balance(y);
        decipher_balance(initial_balance - transfer_amount, x, balance);

        //for y_bar balance should be 0, audit and buffer should be transfer_amount
        let buffer = dispatcher.get_buffer(y_bar);
        decipher_balance(transfer_amount, x_bar, buffer);

        let audit = dispatcher.get_audit(y_bar);
        decipher_balance(transfer_amount, 'CURIOSITY', audit);

        let balance = dispatcher.get_balance(y_bar);
        assert!(balance == ((0,0),(0,0)), "Balance is not 0");


    //We are going to rollover for y_bar
    let nonce = dispatcher.get_nonce(y_bar);
    let (_fund_inputs, fund_proof ) = prove_fund(x_bar, nonce, generate_random(seed+1,1));
    dispatcher.rollover(y_bar, fund_proof);

    //now nonce for y_bar should be 1
        let nonce = dispatcher.get_nonce(y_bar);
        assert!(nonce ==1, "Nonce is not 1");

    //for y_bar buffer should be 0, audit and balance shoul be transfer_amount
        let audit = dispatcher.get_audit(y_bar);
        decipher_balance(transfer_amount, 'CURIOSITY', audit);

        let buffer = dispatcher.get_buffer(y_bar);
        assert!(buffer == ((0,0),(0,0)), "Buffer is not 0");

        let balance = dispatcher.get_balance(y_bar);
        decipher_balance(transfer_amount, x_bar, balance);

    //y_bar will withdraw amount
    let ((Lx,Ly), (Rx,Ry)) = balance;
    let amount = 10;
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let nonce = dispatcher.get_nonce(y_bar);
    let (_inputs,proof)= prove_withdraw(x_bar,transfer_amount, amount,tranfer_address,[Lx,Ly],[Rx,Ry],nonce,seed+2);
    
    dispatcher.withdraw(y_bar,amount,tranfer_address, proof);

    //now y_bar noce should be 2
        let nonce = dispatcher.get_nonce(y_bar);
        assert!(nonce == 2, "Nonce is not 2");

    //the balance and audit should be transfer_amount - amount and the buffer should be 0
        let audit = dispatcher.get_audit(y_bar);
        decipher_balance(transfer_amount - amount, 'CURIOSITY', audit);

        let buffer = dispatcher.get_buffer(y_bar);
        assert!(buffer == ((0,0),(0,0)), "Buffer is not 0");

        let balance = dispatcher.get_balance(y_bar);
        decipher_balance( transfer_amount-amount , x_bar, balance);
}
