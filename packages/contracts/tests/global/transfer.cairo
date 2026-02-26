use crate::global::setup::{full_setup};
use tongo::tongo::ILedger::{ILedgerDispatcherTrait};
use tongo::tongo::IGlobal::{IGlobalDispatcherTrait};
use crate::consts::{USER_ADDRESS, GLOBAL_ADDRESS};

use crate::global::operations::{fundOperation, transferOperation};
use crate::prover::utils::{decipher_balance, pubkey_from_secret};
use snforge_std::{start_cheat_caller_address};

#[test]
fn test_transfer() {
    let (Global, ledger_address, Ledger) = full_setup();

    let x = 2384230948239;
    let x_bar = 2190381209380321;
    let y_bar = pubkey_from_secret(x_bar);

    let initial_balance = 0;
    let initial_fund = 250;

    let sender = USER_ADDRESS;
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender,fee_to_sender, ledger_address);
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    Global.fund(operation);


    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund, USER_ADDRESS, fee_to_sender,ledger_address);
    Global.transfer(operation);

    let pending = Ledger.get_pending(y_bar);
    decipher_balance(transfer_amount.into(), x_bar, pending);
}

