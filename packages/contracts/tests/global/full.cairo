use starknet::ContractAddress;
use crate::global::setup::{full_setup};
use tongo::tongo::IGlobal::{IGlobalDispatcherTrait};
use tongo::tongo::ILedger::{ILedgerDispatcherTrait, ILedgerDispatcher};

use crate::global::operations::{fundOperation, withdrawOperation, ragequitOperation, transferOperation, rolloverOperation};

use snforge_std::{start_cheat_caller_address};
use crate::consts::{USER_ADDRESS, AUDITOR_PRIVATE, GLOBAL_ADDRESS};
use crate::prover::utils::{decipher_balance};
use crate::prover::utils::pubkey_from_secret;

fn checkBalances(x: felt252, balanceAmount:u128, pendingAmount:u128,auditAmount:u128, dispatcher: ILedgerDispatcher) {
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
    let (Global, ledger_address, Ledger) = full_setup();

    let x = 5873498374578;
    let y = pubkey_from_secret(x);

    let x_bar = 9583954385;
    let y_bar = pubkey_from_secret(x_bar);

    // The initial pendings, balance, and audits should be 0
    checkBalances(x,0,0,0,Ledger);
    checkBalances(x_bar,0,0,0,Ledger);

    // The initial nonces should be 0
    let nonce = Ledger.get_nonce(y_bar);
    assert!(nonce == 0, "Initial nonce not 0");

    let nonce = Ledger.get_nonce(y);
    assert!(nonce == 0, "Initial nonce not 0");


    let initial_balance = 0_u128;
    let initial_fund = 250_u128;

    let sender = USER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,ledger_address);
    Global.fund(operation);

    //Bufer should be 0, balance initial_balance and audit initial_balance
    checkBalances(x,initial_fund,0,initial_fund,Ledger);

    let nonce = Ledger.get_nonce(y);
    assert!(nonce == 1, "Nonce is not 1");

    let transfer_amount = 100_u128;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund, USER_ADDRESS, fee_to_sender,ledger_address);
    Global.transfer(operation);

    // nonce for y should be 2
    let nonce = Ledger.get_nonce(y);
    assert!(nonce == 2, "Nonce is not 2");

    checkBalances(x, initial_fund - transfer_amount, 0, initial_fund- transfer_amount, Ledger);
    checkBalances(x_bar, 0, transfer_amount, 0, Ledger);

    //We are going to rollover for y_bar
    let operation = rolloverOperation(x_bar,sender,ledger_address);
    Global.rollover(operation);

    //now nonce for y_bar should be 1
    let nonce = Ledger.get_nonce(y_bar);
    assert!(nonce == 1, "Nonce is not 1");

    //for y_bar pending should be 0, balance shoul be transfer_amount and audit 0
    checkBalances(x_bar, transfer_amount, 0, 0, Ledger);

    //y_bar will withdraw amount
    let withdraw_amount = 25;
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let operation = withdrawOperation(x_bar,transfer_amount, withdraw_amount, transfer_address,USER_ADDRESS,0, ledger_address);
    Global.withdraw(operation);

    //now y_bar noce should be 2
    let nonce = Ledger.get_nonce(y_bar);
    assert!(nonce == 2, "Nonce is not 2");

    checkBalances(x_bar, transfer_amount - withdraw_amount, 0, transfer_amount- withdraw_amount, Ledger);

    //y will ragequit

    let operation = ragequitOperation(x, initial_fund - transfer_amount,transfer_address,USER_ADDRESS,0, ledger_address);
    Global.ragequit(operation);

    // nonce for y should be 3
    let nonce = Ledger.get_nonce(y);
    assert!(nonce == 3, "Nonce is not 3");
    checkBalances(x,0,0,0,Ledger);
}

