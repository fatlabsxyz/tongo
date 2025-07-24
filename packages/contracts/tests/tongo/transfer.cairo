
use tongo::tongo::ITongo::ITongoDispatcherTrait;
use tongo::structs::{
    operations::transfer::Transfer,
};
use crate::consts::AUDITOR_KEY;
use crate::tongo::fund::fund_account;
use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::utils::{generate_random};
use crate::prover::functions::{prove_transfer};
use crate::prover::utils::pubkey_from_secret;

#[test]
fn test_transfer() {
    let seed = 1293123841;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);
    let x_bar = generate_random(seed, 2);
    let y_bar = pubkey_from_secret(x_bar);

    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );


    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let b = 100;
    let (inputs, proof) = prove_transfer(x, y_bar, initial_fund, b,AUDITOR_KEY(), balance, nonce, seed + 1);
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
}

#[test]
fn test_benchmark_prover() {
    let seed = 1293123841;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = pubkey_from_secret(x);
    let x_bar = generate_random(seed, 2);
    let y_bar = pubkey_from_secret(x_bar);


    let initial_balance = 0;
    let initial_fund = 250;
    fund_account(x, initial_balance, initial_fund , dispatcher );


    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let b = 100;
    let _ = prove_transfer(x, y_bar, initial_fund, b,AUDITOR_KEY(), balance, nonce, seed + 1);
}
