use starknet::ContractAddress;
use tongo::tongo::ITongo::ITongoDispatcherTrait;
use tongo::structs::common::{
};

use tongo::structs::operations::{
    withdraw::Withdraw,
    transfer::Transfer,
    ragequit::Ragequit,
};

use crate::prover::utils::pubkey_from_secret;
use crate::consts::{AUDITOR_KEY, AUDITOR_PRIVATE};
use crate::tongo::fund::fund_account;
use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::utils::{generate_random, decipher_balance};
use crate::prover::functions::prove_ragequit;
use crate::prover::functions::prove_withdraw;
use crate::prover::functions::prove_transfer;

#[test]
fn audit_fund() {
    let seed = 9130123;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let empty = dispatcher.get_audit(y);
    decipher_balance(0, AUDITOR_PRIVATE, empty);

    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_fund, AUDITOR_PRIVATE, audit);
}

#[test]
fn audit_withdraw() {
    let seed = 4719823;
    let (_address, dispatcher) = setup_tongo();

    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );

    let currentBalance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let withdraw_amount = 100;
    let (inputs, proof) = prove_withdraw(
        x, initial_fund, withdraw_amount, transfer_address, currentBalance, nonce,AUDITOR_KEY(), seed
    );

    dispatcher.withdraw(Withdraw { from: y, amount:withdraw_amount, to: transfer_address, proof, auditedBalance: inputs.auditedBalance, ae_hints: empty_ae_hint() });
    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_fund - withdraw_amount, AUDITOR_PRIVATE, audit);
}

#[test]
fn audit_ragequit() {
    let seed = 4719823;
    let (_address, dispatcher) = setup_tongo();
    let transfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let empty = dispatcher.get_audit(y);
    decipher_balance(0, AUDITOR_PRIVATE, empty);

    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_fund, AUDITOR_PRIVATE, audit);

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs, proof) = prove_ragequit(
        x, initial_fund, transfer_address, balance, nonce, seed
    );

    dispatcher.ragequit(Ragequit { from: y, amount: initial_fund, to: transfer_address, proof, ae_hints: empty_ae_hint() });
    let audit = dispatcher.get_audit(y);
    decipher_balance(0, AUDITOR_PRIVATE, audit);
}

#[test]
fn audit_transfer() {
    let seed = 1273198273;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let empty = dispatcher.get_audit(y);
    decipher_balance(0, AUDITOR_PRIVATE, empty);

    let x_bar = generate_random(seed, 2);
    let y_bar = pubkey_from_secret(x_bar);

    let empty = dispatcher.get_audit(y_bar);
    decipher_balance(0, AUDITOR_PRIVATE, empty);

    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );

    let nonce = dispatcher.get_nonce(y);

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_fund, AUDITOR_PRIVATE, audit);

    let balance = dispatcher.get_balance(y);

    let transfer_amount = 100;
    let (inputs, proof) = prove_transfer(x, y_bar, initial_fund, transfer_amount, AUDITOR_KEY(),balance, nonce, seed + 1);
    dispatcher
        .transfer(
            Transfer {
                from: y,
                to: y_bar,
                transferBalance: inputs.transferBalance,
                transferBalanceSelf: inputs.transferBalanceSelf,
                auditedBalance: inputs.auditedBalance,
                auditedBalanceSelf: inputs.auditedBalanceSelf,
                proof,
                ae_hints: empty_ae_hint()
            }
        );

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_fund - transfer_amount, AUDITOR_PRIVATE, audit);

    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(0, AUDITOR_PRIVATE, audit);
}

//TODO: Make a audit for withdraw
