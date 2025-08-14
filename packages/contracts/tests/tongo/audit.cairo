use starknet::ContractAddress;
use tongo::tongo::ITongo::ITongoDispatcherTrait;
use tongo::structs::common::{
};
use crate::consts::{ AUDITOR_PRIVATE};
use crate::tongo::setup::{setup_tongo};
use crate::tongo::operations::{fundOperation, withdrawOperation, ragequitOperation, transferOperation, rolloverOperation};
use crate::prover::utils::{pubkey_from_secret,generate_random, decipher_balance};


#[test]
fn audit_empty() {
    let seed = 2139812093812;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let audit = dispatcher.get_audit(y);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_fund() {
    let (_address, dispatcher) = setup_tongo();

    let x = 2093810923812;
    let y = pubkey_from_secret(x);

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    let audit = dispatcher.get_audit(y);
    if audit.is_some() {
        decipher_balance(initial_fund, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_withdraw() {
    let (_address, dispatcher) = setup_tongo();

    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let x = 129381237213;
    let y = pubkey_from_secret(x);

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    let withdraw_amount = 25;
    let operation = withdrawOperation(x,initial_fund, withdraw_amount, transfer_address,dispatcher);
    dispatcher.withdraw(operation);

    let audit = dispatcher.get_audit(y);
    if audit.is_some() {
        decipher_balance(initial_fund - withdraw_amount, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_ragequit() {
    let (_address, dispatcher) = setup_tongo();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = 92183091283;
    let y = pubkey_from_secret(x);

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);


    let operation = ragequitOperation(x, initial_fund,transfer_address,dispatcher);
    dispatcher.ragequit(operation);

    let audit = dispatcher.get_audit(y);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_transfer() {
    let (_address, dispatcher) = setup_tongo();

    let x = 12831209381;
    let y = pubkey_from_secret(x);

    let x_bar = 21983092183910283;
    let y_bar = pubkey_from_secret(x_bar);

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund,dispatcher);
    dispatcher.transfer(operation);

    let audit = dispatcher.get_audit(y);
    if audit.is_some() {
        decipher_balance(initial_fund - transfer_amount, AUDITOR_PRIVATE, audit.unwrap());
    }

    let audit = dispatcher.get_audit(y_bar);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_rollover() {
    let (_address, dispatcher) = setup_tongo();

    let x = 129310932;

    let x_bar = 95849543;
    let y_bar = pubkey_from_secret(x_bar);

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund,dispatcher);
    dispatcher.transfer(operation);

    let operation = rolloverOperation(x_bar,dispatcher);
    dispatcher.rollover(operation);

    let audit = dispatcher.get_audit(y_bar);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

