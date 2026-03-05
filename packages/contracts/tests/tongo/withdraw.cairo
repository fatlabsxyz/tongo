use starknet::ContractAddress;
use tongo::tongo::ITongo::ITongoDispatcherTrait;

use crate::tongo::operations::{fundOperation, ragequitOperation, withdrawOperation};
use crate::tongo::setup::{setup_tongo};

use crate::prover::utils::{generate_random, decipher_balance, pubkey_from_secret};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use crate::consts::{USER_ADDRESS,STRK_ADDRESS};


#[test]
fn test_ragequit() {
    let x = 12931238;
    let (_address, dispatcher) = setup_tongo();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();


    let y = pubkey_from_secret(x);
    
    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let sender = USER_ADDRESS;
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,dispatcher);
    dispatcher.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);

    let operation = ragequitOperation(x, initial_fund,transfer_address,USER_ADDRESS,0,dispatcher);
    dispatcher.ragequit(operation);
    
    let balance = dispatcher.get_balance(y);
    decipher_balance(0, x, balance);

    let pending = dispatcher.get_pending(y);
    decipher_balance(0, x, pending);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let rate = dispatcher.get_rate();
    assert(finalErc20  - initialErc20 == rate*initial_fund.into(), 'nope');
}

#[test]
fn test_withdraw() {
    let seed = 8309218;

    let (_address, dispatcher) = setup_tongo();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let initial_balance = 0_u128;
    let initial_fund = 250_u128;
    let sender = USER_ADDRESS;
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,dispatcher);
    dispatcher.fund(operation);

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);

    let withdraw_amount = 25_u128;

    let operation = withdrawOperation(x,initial_fund, withdraw_amount, transfer_address, USER_ADDRESS, 0, dispatcher);
    dispatcher.withdraw(operation);

    let balance = dispatcher.get_balance(y);
    decipher_balance((initial_fund- withdraw_amount).into(), x, balance);

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let rate = dispatcher.get_rate();
    assert(finalErc20  - initialErc20 == rate*withdraw_amount.into(), 'nope');
}
