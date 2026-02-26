use crate::global::setup::{full_setup};
use tongo::tongo::ILedger::{ILedgerDispatcherTrait};
use tongo::tongo::IGlobal::{IGlobalDispatcherTrait};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use tongo::structs::operations::fund::OutsideFund;
use crate::consts::{USER_ADDRESS, STRK_ADDRESS, GLOBAL_ADDRESS};

use crate::global::operations::{fundOperation};
use crate::prover::utils::{decipher_balance, pubkey_from_secret};
use snforge_std::{start_cheat_caller_address};

#[test]
fn test_fund() {
    let x = 12398109328;
    let y = pubkey_from_secret(x);

    let (Global, ledger_address, Ledger) = full_setup();
    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let tongoAmount = 250;
    let sender = USER_ADDRESS;
    let fee_to_sender =  0;

    let operation = fundOperation(x, 0, tongoAmount, sender, fee_to_sender, ledger_address);
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    Global.fund(operation);

    let finalErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let rate = Global.get_rate();
    assert(initialErc20 - finalErc20 == rate*tongoAmount.into(), 'nope');

    let balance = Ledger.get_balance(y);
    decipher_balance(tongoAmount.into(), x, balance);
}

#[test]
fn test_outside_fund() {
    let x = 1192032130921;
    let to = pubkey_from_secret(x);

    let (Global, ledger_address, Ledger) = full_setup();
    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let tongoAmount = 250;
    

    let sender = USER_ADDRESS;
    start_cheat_caller_address(GLOBAL_ADDRESS,sender);

    let outsideFund = OutsideFund {to, amount: tongoAmount, ledger: ledger_address};

    Global.outside_fund(outsideFund);

    let finalErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let rate = Global.get_rate();
    assert(initialErc20 - finalErc20 == rate*tongoAmount.into(), 'nope');

    let pending = Ledger.get_pending(to);
    decipher_balance(tongoAmount.into(), x.into(), pending);
}
