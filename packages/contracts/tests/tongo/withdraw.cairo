use starknet::ContractAddress;
use tongo::tongo::ITongo::ITongoDispatcherTrait;
use tongo::structs::operations::{
    withdraw::Withdraw,
    ragequit::Ragequit,
};

use crate::tongo::fund::fund_account;
use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::functions::{prove_ragequit, prove_withdraw};
use crate::prover::utils::{generate_random, decipher_balance, pubkey_from_secret};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use crate::consts::{AUDITOR_KEY, STRK_ADDRESS};


#[test]
fn test_ragequit() {
    let seed = 12931238;
    let (_address, dispatcher) = setup_tongo();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed, 1);

    let y = pubkey_from_secret(x);
    
    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );

    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);
    let currentBalance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs, proof) = prove_ragequit(x, initial_fund, transfer_address,currentBalance , nonce, seed);

    dispatcher.ragequit(Ragequit { from: y, amount: initial_fund, to: transfer_address, proof, ae_hints: empty_ae_hint() });
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

    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );


    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(transfer_address);
    let currentBalance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);
    let withdraw_amount = 25;

    let (inputs, proof) = prove_withdraw(
        x,initial_fund, withdraw_amount, transfer_address, currentBalance, nonce,AUDITOR_KEY(), seed
    );

    dispatcher.withdraw(Withdraw { from: y, amount:withdraw_amount, to: transfer_address, proof,auditedBalance: inputs.auditedBalance, ae_hints: empty_ae_hint() });

    let finalErc20 = erc20dispatcher.balance_of(transfer_address);
    let rate = dispatcher.get_rate();
    assert(finalErc20  - initialErc20 == rate*withdraw_amount.into(), 'nope');
}
