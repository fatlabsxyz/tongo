use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::utils::{generate_random};
use crate::prover::functions::{prove_transfer, prove_fund};

use tongo::main::ITongoDispatcherTrait;
use tongo::verifier::structs::{Fund, Transfer};
use tongo::verifier::structs::{PubKeyTrait};
use crate::consts::AUDITOR_KEY;

#[test]
fn test_transfer() {
    let seed = 1293123841;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);
    let x_bar = generate_random(seed, 2);
    let y_bar = PubKeyTrait::from_secret(x_bar);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b0 = 3124;
    dispatcher.fund(Fund { to: y, amount: b0, proof: fund_proof, ae_hints: empty_ae_hint() });

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let b = 100;
    let (inputs, proof) = prove_transfer(x, y_bar, b0, b, balance.CL, balance.CR, AUDITOR_KEY(), nonce, seed + 1);
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
}

#[test]
fn test_benchmark_prover() {
    let seed = 1293123841;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);
    let x_bar = generate_random(seed, 2);
    let y_bar = PubKeyTrait::from_secret(x_bar);
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b0 = 3124;
    dispatcher.fund(Fund { to: y, amount: b0, proof: fund_proof, ae_hints: empty_ae_hint() });

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let b = 100;
    let (_inputs, _proof) = prove_transfer(
        x, y_bar, b0, b, balance.CL, balance.CR, AUDITOR_KEY(), nonce, seed + 1
    );
}
