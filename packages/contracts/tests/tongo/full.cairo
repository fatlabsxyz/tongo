use crate::prover::utils::{generate_random, decipher_balance};
use crate::tongo::setup::{setup_tongo};
use crate::prover::functions::{prove_transfer, prove_fund, prove_withdraw};
use starknet::ContractAddress;
use tongo::verifier::structs::{PubKeyTrait, CipherBalanceTrait};
use tongo::verifier::structs::{Rollover, Fund, Transfer, Withdraw};

use tongo::main::ITongoDispatcherTrait;

#[test]
fn full() {
    //set up
    let seed = 23097198721;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let x_bar = generate_random(seed, 2);
    let y_bar = PubKeyTrait::from_secret(x_bar);

    // The initial pendings, balance, and audits should be 0
    let pending = dispatcher.get_pending(y);
    assert!(pending.is_zero(), "Initial pending not 0");

    let balance = dispatcher.get_balance(y);
    assert!(balance.is_zero(), "Initial balance not 0");

    let audit = dispatcher.get_audit(y);
    assert!(audit.is_zero(), "Initial audit not 0");

    let pending = dispatcher.get_pending(y_bar);
    assert!(pending.is_zero(), "Initial pending not 0");

    let balance = dispatcher.get_balance(y_bar);
    assert!(balance.is_zero(), "Initial balance not 0");

    let audit = dispatcher.get_audit(y_bar);
    assert!(audit.is_zero(), "Initial audit not 0");

    // The initial nonces should be 0
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 0, "Initial nonce not 0");

    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 0, "Initial nonce not 0");

    // Funding the y account
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));
    let initial_balance = 3124;
    dispatcher.fund(Fund { to: y, amount: initial_balance, proof: fund_proof });

    //Bufer should be 0, balance initial_balance and audit initial_balance
    let pending = dispatcher.get_pending(y);
    assert!(pending.is_zero(), "Initial pending not 0");

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_balance, 'CURIOSITY', audit);

    let balance = dispatcher.get_balance(y);
    decipher_balance(initial_balance, x, balance);

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 1, "Nonce is not 1");

    let transfer_amount = 100;
    let (inputs, proof) = prove_transfer(
        x, y_bar, initial_balance, transfer_amount, balance.CL, balance.CR, nonce, seed + 1
    );
    dispatcher
        .transfer(
            Transfer {
                from: inputs.y,
                to: inputs.y_bar,
                L: inputs.L,
                L_bar: inputs.L_bar,
                L_audit: inputs.L_audit,
                R: inputs.R,
                proof
            }
        );

    // nonce for y should be 2
    let nonce = dispatcher.get_nonce(y);
    assert!(nonce == 2, "Nonce is not 2");

    //For y balance and audit  should be initial-transfer, pending 0
    let pending = dispatcher.get_pending(y);
    assert!(pending.is_zero(), "Buffer is not 0");

    let audit = dispatcher.get_audit(y);
    decipher_balance(initial_balance - transfer_amount, 'CURIOSITY', audit);

    let balance = dispatcher.get_balance(y);
    decipher_balance(initial_balance - transfer_amount, x, balance);

    //for y_bar balance should be 0, audit and pending should be transfer_amount
    let pending = dispatcher.get_pending(y_bar);
    decipher_balance(transfer_amount, x_bar, pending);

    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(transfer_amount, 'CURIOSITY', audit);

    let balance = dispatcher.get_balance(y_bar);
    assert!(balance.is_zero(), "Balance is not 0");

    //We are going to rollover for y_bar
    let nonce = dispatcher.get_nonce(y_bar);
    let (_fund_inputs, fund_proof) = prove_fund(x_bar, nonce, generate_random(seed + 1, 1));
    dispatcher.rollover( Rollover{to:y_bar, proof: fund_proof} );

    //now nonce for y_bar should be 1
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 1, "Nonce is not 1");

    //for y_bar pending should be 0, audit and balance shoul be transfer_amount
    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(transfer_amount, 'CURIOSITY', audit);

    let pending = dispatcher.get_pending(y_bar);
    assert!(pending.is_zero(), "Buffer is not 0");

    let balance = dispatcher.get_balance(y_bar);
    decipher_balance(transfer_amount, x_bar, balance);

    //y_bar will withdraw amount
    let balance = dispatcher.get_balance(y_bar);
    let amount = 10;
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let nonce = dispatcher.get_nonce(y_bar);
    let (_inputs, proof) = prove_withdraw(
        x_bar, transfer_amount, amount, tranfer_address, balance.CL, balance.CR, nonce, seed + 2
    );

    dispatcher.withdraw(Withdraw { from: y_bar, amount, to: tranfer_address, proof });

    //now y_bar noce should be 2
    let nonce = dispatcher.get_nonce(y_bar);
    assert!(nonce == 2, "Nonce is not 2");

    //the balance and audit should be transfer_amount - amount and the pending should be 0
    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(transfer_amount - amount, 'CURIOSITY', audit);

    let pending = dispatcher.get_pending(y_bar);
    assert!(pending.is_zero(), "Buffer is not 0");

    let balance = dispatcher.get_balance(y_bar);
    decipher_balance(transfer_amount - amount, x_bar, balance);
}
