use starknet::ContractAddress;
use tongo::tongo::ITongo::ITongoDispatcherTrait;

use crate::tongo::operations::{fundOperation, ragequitOperation, withdrawOperation, transferOperation};
use crate::tongo::setup::{setup_tongo};

use crate::prover::utils::{generate_random, decipher_balance, pubkey_from_secret};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use crate::consts::{USER_ADDRESS,STRK_ADDRESS, RELAYER_ADDRESS};

use snforge_std::{start_cheat_caller_address};


#[test]
fn test_tongo_relay_ragequit() {
    let x = 12931238;
    let (tongo_address, dispatcher) = setup_tongo();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let sender = RELAYER_ADDRESS;
    let fee_to_sender: u128 = 10;

    let y = pubkey_from_secret(x);
    
    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let operation = fundOperation(x,USER_ADDRESS, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);
    let initialErc20Relayer = erc20dispatcher.balance_of(sender);

    
    let operation = ragequitOperation(x, initial_fund,transfer_address,sender,fee_to_sender,dispatcher);
    start_cheat_caller_address(tongo_address, sender);
    dispatcher.ragequit(operation);
    
    let balance = dispatcher.get_balance(y);
    decipher_balance(0, x, balance);

    let pending = dispatcher.get_pending(y);
    decipher_balance(0, x, pending);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let finalErc20Relayer = erc20dispatcher.balance_of(sender);
    let rate = dispatcher.get_rate();
    assert(finalErc20  - initialErc20 == rate*(initial_fund - fee_to_sender).into(), 'nope');
    assert(finalErc20Relayer  - initialErc20Relayer == rate*(fee_to_sender).into(), 'nope');
}

#[test]
fn test_tongo_relay_withdraw() {
    let seed = 8309218;

    let (tongo_address, dispatcher) = setup_tongo();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let sender = RELAYER_ADDRESS;
    let fee_to_sender: u128 = 1;

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let operation = fundOperation(x,USER_ADDRESS, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);
    let initialErc20Relayer = erc20dispatcher.balance_of(sender);

    let withdraw_amount = 49_u128;

    let operation = withdrawOperation(x,initial_fund, withdraw_amount, transfer_address, RELAYER_ADDRESS, fee_to_sender, dispatcher);
    start_cheat_caller_address(tongo_address, sender);
    dispatcher.withdraw(operation);

    let balance = dispatcher.get_balance(y);
    decipher_balance((initial_fund- withdraw_amount - fee_to_sender).into(), x, balance);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let finalErc20Relayer = erc20dispatcher.balance_of(sender);
    let rate = dispatcher.get_rate();

    
    
    assert(finalErc20  - initialErc20 == rate*(withdraw_amount - fee_to_sender).into(), 'nope');
    assert(finalErc20Relayer  - initialErc20Relayer == rate*(fee_to_sender).into(), 'nope');
}


#[test]
fn test_tongo_relay_transfer() {
    let (tongo_address, dispatcher) = setup_tongo();

    let x = 2384230948239;
    let y = pubkey_from_secret(x);
    let x_bar = 2190381209380321;
    let y_bar = pubkey_from_secret(x_bar);
    let fee_to_sender = 10;
    let sender = RELAYER_ADDRESS;

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x,USER_ADDRESS, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20Relayer = erc20dispatcher.balance_of(sender);

    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund, sender, fee_to_sender,dispatcher);
    start_cheat_caller_address(tongo_address, sender);
    dispatcher.transfer(operation);

    let balance = dispatcher.get_balance(y);
    decipher_balance((initial_fund - fee_to_sender -  transfer_amount).into(), x, balance);

    let finalErc20Relayer = erc20dispatcher.balance_of(sender);
    let rate = dispatcher.get_rate();

    assert(finalErc20Relayer  - initialErc20Relayer == rate*(fee_to_sender).into(), 'nope');
}
