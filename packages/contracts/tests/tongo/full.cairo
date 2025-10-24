use starknet::ContractAddress;
use tongo::tongo::ITongo::{ITongoDispatcherTrait, ITongoDispatcher};

use crate::tongo::operations::{fundOperation, withdrawOperation, ragequitOperation, transferOperation, rolloverOperation};

use crate::consts::{ AUDITOR_PRIVATE};
use crate::prover::utils::{decipher_balance};
use crate::tongo::setup::{setup_tongo};
use crate::prover::utils::pubkey_from_secret;
use crate::consts::{USER_CALLER};

fn checkBalances(x: felt252, balanceAmount:u128, pendingAmount:u128,auditAmount:u128, dispatcher: ITongoDispatcher) {
    let public_key = pubkey_from_secret(x);

    let balance = dispatcher.get_balance(public_key);
    decipher_balance(balanceAmount.into(), x, balance);

    let pending= dispatcher.get_pending(public_key);
    decipher_balance(pendingAmount.into(), x, pending);

    let audit = dispatcher.get_audit(public_key);
    if audit.is_some() {
        decipher_balance(auditAmount.into(), AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn full() {
    //set up
    let (_address, dispatcher) = setup_tongo();

    let x = 5873498374578;
    let y = pubkey_from_secret(x);

    let x_bar = 9583954385;
    let y_bar = pubkey_from_secret(x_bar);

    // The initial pendings, balance, and audits should be 0
    checkBalances(x,0,0,0,dispatcher);
    checkBalances(x_bar,0,0,0,dispatcher);

    // The initial nonces should be 0
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 0, "Initial nonce not 0");

    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 0, "Initial nonce not 0");


    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let operation = fundOperation(x,USER_CALLER, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    //Bufer should be 0, balance initial_balance and audit initial_balance
    checkBalances(x,initial_fund,0,initial_fund,dispatcher);

    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 1, "Nonce is not 1");

    let transfer_amount = 100_u128;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund,dispatcher);
    dispatcher.transfer(operation);

    // nonce for y should be 2
    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 2, "Nonce is not 2");

    checkBalances(x, initial_fund - transfer_amount, 0, initial_fund- transfer_amount, dispatcher);
    checkBalances(x_bar, 0, transfer_amount, 0, dispatcher);

    //We are going to rollover for y_bar
    let operation = rolloverOperation(x_bar,dispatcher);
    dispatcher.rollover(operation);

    //now nonce for y_bar should be 1
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 1, "Nonce is not 1");

    //for y_bar pending should be 0, balance shoul be transfer_amount and audit 0
    checkBalances(x_bar, transfer_amount, 0, 0, dispatcher);

    //y_bar will withdraw amount
    let withdraw_amount = 25;
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let operation = withdrawOperation(x_bar,transfer_amount, withdraw_amount, transfer_address,dispatcher);
    dispatcher.withdraw(operation);

    //now y_bar noce should be 2
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 2, "Nonce is not 2");

    checkBalances(x_bar, transfer_amount - withdraw_amount, 0, transfer_amount- withdraw_amount, dispatcher);

    //y will ragequit

    let operation = ragequitOperation(x, initial_fund - transfer_amount,transfer_address,dispatcher);
    dispatcher.ragequit(operation);

    // nonce for y should be 3
    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 3, "Nonce is not 3");
    checkBalances(x,0,0,0,dispatcher);
}
