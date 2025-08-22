use starknet::ContractAddress;
use tongo::tongo::ITongo::ITongoDispatcherTrait;


use tongo::structs::operations::{
    withdraw::Withdraw,
    transfer::Transfer,
    rollover::Rollover,
};

use crate::consts::{AUDITOR_KEY, AUDITOR_PRIVATE};
use crate::tongo::fund::fund_account;
use crate::prover::utils::{generate_random, decipher_balance};
use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::functions::{prove_transfer, prove_rollover, prove_withdraw};
use crate::prover::utils::pubkey_from_secret;

#[test]
fn full() {
    //set up
    let seed = 23097198721;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);

    let x_bar = generate_random(seed, 2);
    let y_bar = pubkey_from_secret(x_bar);

    // The initial pendings, balance, and audits should be 0
    let pending = dispatcher.get_pending(y);
    decipher_balance(0, x, pending);

    let balance = dispatcher.get_balance(y);
    decipher_balance(0, x, balance);

    let audit = dispatcher.get_audit(y);
    decipher_balance(0, AUDITOR_PRIVATE, audit);

    let pending = dispatcher.get_pending(y_bar);
    decipher_balance(0, x_bar, pending);

    let balance = dispatcher.get_balance(y_bar);
    decipher_balance(0, x_bar, balance);

    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(0, AUDITOR_PRIVATE, audit);


    // The initial nonces should be 0
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 0, "Initial nonce not 0");

    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 0, "Initial nonce not 0");

    // Funding the y account
    let initial_fund = 3124;
    fund_account(x, 0, initial_fund , dispatcher );

    //Bufer should be 0, balance initial_balance and audit initial_balance
    let pending = dispatcher.get_pending(y);
    decipher_balance(0, x , pending);

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_fund, AUDITOR_PRIVATE, audit);

    let balance = dispatcher.get_balance(y);
    decipher_balance(initial_fund, x, balance);

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 1, "Nonce is not 1");

    let transfer_amount = 100;
    let (inputs, proof) = prove_transfer(x, y_bar, initial_fund, transfer_amount,AUDITOR_KEY(), balance, nonce, seed + 1);
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

    // nonce for y should be 2
    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 2, "Nonce is not 2");

    //For y balance and audit  should be initial-transfer, pending 0
    let pending = dispatcher.get_pending(y);
    decipher_balance(0, x, pending);

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_fund - transfer_amount, AUDITOR_PRIVATE, audit);

    let balance = dispatcher.get_balance(y);
    decipher_balance(initial_fund - transfer_amount, x, balance);

    //for y_bar balance should be 0,  pending should be transfer_amount and audit 0
    let pending = dispatcher.get_pending(y_bar);
    decipher_balance(transfer_amount, x_bar, pending);

    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(0, AUDITOR_PRIVATE, audit);

    let balance = dispatcher.get_balance(y_bar);
    decipher_balance(0, x_bar, balance);


    //We are going to rollover for y_bar
    let nonce = dispatcher.get_nonce(y_bar);
    let (_fund_inputs, fund_proof) = prove_rollover(x_bar, nonce, generate_random(seed + 1, 1));
    dispatcher.rollover( Rollover{to:y_bar, proof: fund_proof, ae_hints: empty_ae_hint() } );

    //now nonce for y_bar should be 1
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 1, "Nonce is not 1");

    //for y_bar pending should be 0, balance shoul be transfer_amount and audit 0
    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(0, AUDITOR_PRIVATE, audit);

    let pending = dispatcher.get_pending(y_bar);
    decipher_balance(0, x_bar, pending);

    let balance = dispatcher.get_balance(y_bar);
    decipher_balance(transfer_amount, x_bar, balance);

    //y_bar will withdraw amount
    let currentBalance = dispatcher.get_balance(y_bar);
    let amount = 10;
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let nonce = dispatcher.get_nonce(y_bar);
    let (inputs, proof) = prove_withdraw(
        x_bar, transfer_amount, amount, tranfer_address, currentBalance, nonce,AUDITOR_KEY(), seed + 2
    );

    dispatcher.withdraw(Withdraw { from: y_bar, amount, to: tranfer_address, proof,auditedBalance: inputs.auditedBalance, ae_hints: empty_ae_hint() });

    //now y_bar noce should be 2
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 2, "Nonce is not 2");

    //the balance and audit should be transfer_amount - amount and the pending should be 0
    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(transfer_amount - amount, AUDITOR_PRIVATE, audit);

    let pending = dispatcher.get_pending(y_bar);
    decipher_balance(0, x_bar, pending);

    let balance = dispatcher.get_balance(y_bar);
    decipher_balance(transfer_amount - amount, x_bar, balance);
}
