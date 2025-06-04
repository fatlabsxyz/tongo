use snforge_std::start_cheat_caller_address;
use starknet::ContractAddress;
use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::utils::{generate_random, decipher_balance};
use crate::prover::functions::prove_withdraw_all;
use crate::prover::functions::prove_transfer;
use crate::prover::functions::prove_fund;
use tongo::verifier::structs::{PubKeyTrait, CipherBalanceTrait};

use tongo::main::ITongoDispatcherTrait;
use tongo::verifier::structs::{Fund, WithdrawAll, Transfer};

#[test]
fn audit_fund() {
    let seed = 9130123;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let empty = dispatcher.get_audit(y);
    assert!(empty.is_zero(), "wrong");
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b0 = 3124;
    dispatcher.fund(Fund { to: y, amount: b0, proof: fund_proof, ae_hints: empty_ae_hint() });

    let audit = dispatcher.get_audit(y);
    decipher_balance(b0, 'CURIOSITY', audit);
}

#[test]
fn audit_withdraw_all() {
    let seed = 4719823;
    let (_address, dispatcher) = setup_tongo();

    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let empty = dispatcher.get_audit(y);
    assert!(empty.is_zero(), "wrong");
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b = 250;
    dispatcher.fund(Fund { to: y, amount: b, proof: fund_proof, ae_hints: empty_ae_hint() });

    let audit = dispatcher.get_audit(y);
    decipher_balance(b, 'CURIOSITY', audit);

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs, proof) = prove_withdraw_all(
        x, b, tranfer_address, balance.CL, balance.CR, nonce, seed
    );

    dispatcher.withdraw_all(WithdrawAll { from: y, amount: b, to: tranfer_address, proof, ae_hints: empty_ae_hint() });
    let audit = dispatcher.get_audit(y);
    decipher_balance(0, 'CURIOSITY', audit);
}

#[test]
fn audit_transfer() {
    let seed = 1273198273;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let empty = dispatcher.get_audit(y);
    assert!(empty.is_zero(), "wrong");

    let x_bar = generate_random(seed, 2);
    let y_bar = PubKeyTrait::from_secret(x_bar);

    let empty = dispatcher.get_audit(y_bar);
    assert!(empty.is_zero(), "wrong");
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b0 = 3124;
    dispatcher.fund(Fund { to: y, amount: b0, proof: fund_proof, ae_hints: empty_ae_hint() });
    let nonce = dispatcher.get_nonce(y);

    let audit = dispatcher.get_audit(y);
    decipher_balance(b0, 'CURIOSITY', audit);

    let balance = dispatcher.get_balance(y);

    let b = 100;
    let (inputs, proof) = prove_transfer(x, y_bar, b0, b, balance.CL, balance.CR, nonce, seed + 1);
    dispatcher
        .transfer(
            Transfer {
                from: inputs.y,
                to: inputs.y_bar,
                L: inputs.L,
                L_bar: inputs.L_bar,
                L_audit: inputs.L_audit,
                R: inputs.R,
                proof,
                ae_hints: empty_ae_hint()
            }
        );

    let audit = dispatcher.get_audit(y);
    decipher_balance(b0 - b, 'CURIOSITY', audit);

    let audit = dispatcher.get_audit(y_bar);
    decipher_balance(b, 'CURIOSITY', audit);
}
