use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::functions::{prove_fund};
use crate::prover::utils::{generate_random, decipher_balance};
use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use tongo::structs::operations::fund::Fund;
use crate::consts::AUDITOR_KEY;
use crate::prover::utils::pubkey_from_secret;

pub fn fund_account(x: felt252, previous_amount:felt252, fund_amount:felt252, dispatcher:ITongoDispatcher) {
    let y = pubkey_from_secret(x);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);
    //This is to secure that the current balance is encoding the previous_amount value
    decipher_balance(previous_amount,x, currentBalance);

    let (inputs, fund_proof) = prove_fund(x,fund_amount, previous_amount, currentBalance, nonce,AUDITOR_KEY(), generate_random(x, 1));
    let fundPayload = Fund { to: y, amount: fund_amount, auxBalance: inputs.auxBalance, auditedBalance: inputs.auditedBalance, proof: fund_proof, ae_hints: empty_ae_hint() };
    dispatcher.fund(fundPayload);
}

#[test]
fn test_fund() {
    //TODO: Tiene sentido que la proof del fundeo dependa de b en el challenge?
    let seed = 12093821093;
    let (_tongo_address, dispatcher) = setup_tongo();
    let x = generate_random(seed, 1);
    fund_account(x,0, 250, dispatcher);

    fund_account(x,250,100,dispatcher);
}

//#[test]
//#[should_panic(expected: 'ERROR F100')]
//fn test_fund_failed() {
//    let seed = 12093821093;
//    let (_address, dispatcher) = setup_tongo();
//
//    let x = generate_random(seed, 1);
//    let y = pubkey_from_secret(x);
//
//    let nonce = dispatcher.get_nonce(y);
//    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));
//
//    let b1 = 250;
//
//    dispatcher.fund(Fund { to: y, amount: b1, proof: fund_proof, ae_hints: empty_ae_hint() });
//    dispatcher.fund(Fund { to: y, amount: b1, proof: fund_proof, ae_hints: empty_ae_hint() });
//}
