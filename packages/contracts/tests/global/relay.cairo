use starknet::ContractAddress;
use crate::global::setup::{full_setup};
use tongo::tongo::IGlobal::{IGlobalDispatcherTrait};
use tongo::tongo::ILedger::{ILedgerDispatcherTrait};
use tongo::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};

use crate::global::operations::{fundOperation, withdrawOperation, ragequitOperation, transferOperation};

use snforge_std::{start_cheat_caller_address};
use crate::consts::{GLOBAL_ADDRESS, RELAYER_ADDRESS, STRK_ADDRESS};
use crate::prover::utils::{decipher_balance};
use crate::prover::utils::pubkey_from_secret;


#[test]
fn test_tongo_relay_ragequit() {
    let x = 12931238;
    let (Global, ledger_address, Ledger) = full_setup();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let sender = RELAYER_ADDRESS;
    let fee_to_sender: u128 = 10;

    let y = pubkey_from_secret(x);
    
    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    start_cheat_caller_address(GLOBAL_ADDRESS, sender);
    let operation = fundOperation(x, initial_balance,initial_fund,sender,fee_to_sender,ledger_address);
    Global.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);
    let initialErc20Relayer = erc20dispatcher.balance_of(sender);

    
    let operation = ragequitOperation(x, initial_fund,transfer_address,sender,fee_to_sender,ledger_address);
    Global.ragequit(operation);
    
    let balance = Ledger.get_balance(y);
    decipher_balance(0, x, balance);

    let pending = Ledger.get_pending(y);
    decipher_balance(0, x, pending);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let finalErc20Relayer = erc20dispatcher.balance_of(sender);
    let rate = Global.get_rate();
    assert(finalErc20  - initialErc20 == rate*(initial_fund - fee_to_sender).into(), 'nope');
    assert(finalErc20Relayer  - initialErc20Relayer == rate*(fee_to_sender).into(), 'nope');
}

#[test]
fn test_tongo_relay_withdraw() {
    let (Global, ledger_address, Ledger) = full_setup();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let sender = RELAYER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS, sender);
    let fee_to_sender: u128 = 1;

    let x = 83459873249832743298;
    let y = pubkey_from_secret(x);

    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let operation = fundOperation(x,initial_balance,initial_fund,sender, fee_to_sender, ledger_address);
    Global.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);
    let initialErc20Relayer = erc20dispatcher.balance_of(sender);

    let withdraw_amount = 49_u128;

    let operation = withdrawOperation(x,initial_fund, withdraw_amount, transfer_address, RELAYER_ADDRESS, fee_to_sender, ledger_address);
    Global.withdraw(operation);

    let balance = Ledger.get_balance(y);
    decipher_balance((initial_fund- withdraw_amount - fee_to_sender).into(), x, balance);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let finalErc20Relayer = erc20dispatcher.balance_of(sender);
    let rate = Global.get_rate();

    
    
    assert(finalErc20  - initialErc20 == rate*(withdraw_amount - fee_to_sender).into(), 'nope');
    assert(finalErc20Relayer  - initialErc20Relayer == rate*(fee_to_sender).into(), 'nope');
}


#[test]
fn test_tongo_relay_transfer() {
    let (Global, ledger_address, Ledger) = full_setup();

    let x = 2384230948239;
    let y = pubkey_from_secret(x);
    let x_bar = 2190381209380321;
    let y_bar = pubkey_from_secret(x_bar);
    let fee_to_sender = 10;
    let sender = RELAYER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS, sender);

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,ledger_address);
    Global.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20Relayer = erc20dispatcher.balance_of(sender);

    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund, sender, fee_to_sender,ledger_address);
    Global.transfer(operation);

    let balance = Ledger.get_balance(y);
    decipher_balance((initial_fund - fee_to_sender -  transfer_amount).into(), x, balance);

    let finalErc20Relayer = erc20dispatcher.balance_of(sender);
    let rate = Global.get_rate();

    assert(finalErc20Relayer  - initialErc20Relayer == rate*(fee_to_sender).into(), 'nope');
}

