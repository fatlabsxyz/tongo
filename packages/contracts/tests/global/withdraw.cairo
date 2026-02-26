use starknet::ContractAddress;
use crate::global::setup::{full_setup};
use tongo::tongo::ILedger::{ILedgerDispatcherTrait};
use tongo::tongo::IGlobal::{IGlobalDispatcherTrait};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use crate::consts::{USER_ADDRESS, STRK_ADDRESS, GLOBAL_ADDRESS};

use crate::global::operations::{fundOperation, ragequitOperation, withdrawOperation};
use crate::prover::utils::{decipher_balance, pubkey_from_secret};
use snforge_std::{start_cheat_caller_address};


#[test]
fn test_ragequit() {
    let x = 12931238;
    let (Global, ledger_address, Ledger) = full_setup();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let y = pubkey_from_secret(x);
    
    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let sender = USER_ADDRESS;
    let fee_to_sender =  0;

    let operation = fundOperation(x, initial_balance, initial_fund, sender, fee_to_sender, ledger_address);
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    Global.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);

    let operation = ragequitOperation(x, initial_fund,transfer_address,USER_ADDRESS,0,ledger_address);
    Global.ragequit(operation);
    
    let balance = Ledger.get_balance(y);
    decipher_balance(0, x, balance);

    let pending = Ledger.get_pending(y);
    decipher_balance(0, x, pending);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let rate = Global.get_rate();
    assert(finalErc20  - initialErc20 == rate*initial_fund.into(), 'nope');
}

#[test]
fn test_withdraw() {
    let x = 218312983721;
    let (Global, ledger_address, Ledger) = full_setup();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let y = pubkey_from_secret(x);
    
    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let sender = USER_ADDRESS;
    let fee_to_sender =  0;

    let operation = fundOperation(x, initial_balance, initial_fund, sender, fee_to_sender, ledger_address);
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    Global.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);

    let withdraw_amount = 25_u128;

    let operation = withdrawOperation(x,initial_fund, withdraw_amount, transfer_address, USER_ADDRESS, 0, ledger_address);
    Global.withdraw(operation);

    let balance = Ledger.get_balance(y);
    decipher_balance((initial_fund- withdraw_amount).into(), x, balance);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let rate = Global.get_rate();
    assert(finalErc20  - initialErc20 == rate*withdraw_amount.into(), 'nope');
}
