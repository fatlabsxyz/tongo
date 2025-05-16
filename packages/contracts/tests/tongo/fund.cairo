use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::functions::{prove_fund};
use crate::prover::utils::{generate_random};
use tongo::main::{ITongoDispatcherTrait};
use tongo::verifier::structs::{PubKeyTrait, Fund};

#[test]
fn test_fund() {
    //TODO: Tiene sentido que la proof del fundeo dependa de b en el challenge?
    let seed = 12093821093;
    let (_tongo_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b1 = 250;
    let fundPayload = Fund { to: y, amount: b1, proof: fund_proof, ae_hints: empty_ae_hint() };

    dispatcher.fund(fundPayload);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));
    let b2 = 50;
    let fundPayload = Fund { to: y, amount: b2, proof: fund_proof, ae_hints: empty_ae_hint() };

    dispatcher.fund(fundPayload);
}

#[test]
#[should_panic(expected: 'ERROR F100')]
fn test_fund_failed() {
    let seed = 12093821093;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b1 = 250;

    dispatcher.fund(Fund { to: y, amount: b1, proof: fund_proof, ae_hints: empty_ae_hint() });
    dispatcher.fund(Fund { to: y, amount: b1, proof: fund_proof, ae_hints: empty_ae_hint() });
}
