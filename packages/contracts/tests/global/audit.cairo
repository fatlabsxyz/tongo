use starknet::ContractAddress;
use crate::global::setup::{full_setup};
use tongo::tongo::IGlobal::{IGlobalDispatcherTrait};
use tongo::tongo::ILedger::{ILedgerDispatcherTrait};

use crate::global::operations::{fundOperation, withdrawOperation, ragequitOperation, transferOperation, rolloverOperation};

use snforge_std::{start_cheat_caller_address};
use crate::consts::{USER_ADDRESS, AUDITOR_PRIVATE, GLOBAL_ADDRESS};
use crate::prover::utils::{decipher_balance};
use crate::prover::utils::pubkey_from_secret;


#[test]
fn audit_empty() {
    let (_Global, _ledger_address, Ledger) = full_setup();

    let x = 23832094820934832984;
    let y = pubkey_from_secret(x);

    let audit = Ledger.get_audit(y);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_fund() {
    let (Global, ledger_address, Ledger) = full_setup();

    let x = 2093810923812;
    let y = pubkey_from_secret(x);

    let initial_balance = 0_u128;
    let initial_fund = 250_u128;

    let sender = USER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,ledger_address);
    Global.fund(operation);

    let audit = Ledger.get_audit(y);
    if audit.is_some() {
        decipher_balance(initial_fund.into(), AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_withdraw() {
    let (Global, ledger_address, Ledger) = full_setup();

    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let x = 129381237213;
    let y = pubkey_from_secret(x);

    let initial_balance = 0_u128;
    let initial_fund = 250_u128;

    let sender = USER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,ledger_address);
    Global.fund(operation);

    let withdraw_amount = 25_u128;
    let operation = withdrawOperation(x,initial_fund, withdraw_amount, transfer_address, USER_ADDRESS,0, ledger_address);
    Global.withdraw(operation);

    let audit = Ledger.get_audit(y);
    if audit.is_some() {
        decipher_balance((initial_fund - withdraw_amount).into(), AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_ragequit() {
    let (Global, ledger_address, Ledger) = full_setup();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = 92183091283;
    let y = pubkey_from_secret(x);

    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    
    let sender = USER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,ledger_address);
    Global.fund(operation);


    let operation = ragequitOperation(x, initial_fund,transfer_address,USER_ADDRESS,0,ledger_address);
    Global.ragequit(operation);

    let audit = Ledger.get_audit(y);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_transfer() {
    let (Global, ledger_address, Ledger) = full_setup();

    let x = 12831209381;
    let y = pubkey_from_secret(x);

    let x_bar = 21983092183910283;
    let y_bar = pubkey_from_secret(x_bar);


    let initial_balance = 0_u128;
    let initial_fund = 250_u128;

    let sender = USER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,ledger_address);
    Global.fund(operation);

    let transfer_amount = 100_u128;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund, USER_ADDRESS, fee_to_sender, ledger_address);
    Global.transfer(operation);

    let audit = Ledger.get_audit(y);
    if audit.is_some() {
        decipher_balance((initial_fund - fee_to_sender - transfer_amount).into(), AUDITOR_PRIVATE, audit.unwrap());
    }

    let audit = Ledger.get_audit(y_bar);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

#[test]
fn audit_rollover() {
    let (Global, ledger_address, Ledger) = full_setup();

    let x = 129310932;

    let x_bar = 95849543;
    let y_bar = pubkey_from_secret(x_bar);


    let initial_balance = 0;
    let initial_fund = 250;

    let sender = USER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,ledger_address);
    Global.fund(operation);

    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund,USER_ADDRESS, fee_to_sender, ledger_address);
    Global.transfer(operation);

    let operation = rolloverOperation(x_bar,sender,ledger_address);
    Global.rollover(operation);

    let audit = Ledger.get_audit(y_bar);
    if audit.is_some() {
        decipher_balance(0, AUDITOR_PRIVATE, audit.unwrap());
    }
}

