use tongo::tongo::ITongo::{ITongoDispatcherTrait};
use tongo::structs::operations::fund::Fund;
use tongo::structs::common::pubkey::PubKey;
use tongo::structs::common::cipherbalance::CipherBalance;
use tongo::structs::common::starkpoint::StarkPoint;

use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::functions::{prove_fund};
use crate::consts::AUDITOR_KEY;
use crate::prover::utils::pubkey_from_secret;

#[test]
#[should_panic(expected: 'PubKey not an EcPoint')]
fn tamperPubKey() {
    let (_tongo_address, dispatcher) = setup_tongo();

    let x = 1234;
    let y = pubkey_from_secret(x);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);
    let previous_amount = 0;
    let fund_amount = 100; 
    let (inputs, fund_proof) = prove_fund(x,fund_amount, previous_amount, currentBalance, nonce, AUDITOR_KEY(), 8888);

    let tamperTo =  PubKey {x: y.x, y: y.y + 1 };
    let fundPayload = Fund { to: tamperTo, amount: fund_amount, auxBalance: inputs.auxBalance, auditedBalance: inputs.auditedBalance, proof: fund_proof, ae_hints: empty_ae_hint() };
    dispatcher.fund(fundPayload);
}

#[test]
#[should_panic(expected: 'StarkPoint not an EcPoint')]
fn tamperStarkPoint() {
    let (_tongo_address, dispatcher) = setup_tongo();

    let x = 1234;
    let y = pubkey_from_secret(x);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);
    let previous_amount = 0;
    let fund_amount = 100; 
    let (inputs, fund_proof) = prove_fund(x,fund_amount, previous_amount, currentBalance, nonce, AUDITOR_KEY(), 8888);
    
    let CipherBalance {L, R} = currentBalance;
    let tamperL = StarkPoint {x: L.x, y: L.y + 1};
    let tamperCipher = CipherBalance {L: tamperL, R};

    
    let fundPayload = Fund { to: y, amount: fund_amount, auxBalance: tamperCipher, auditedBalance: inputs.auditedBalance, proof: fund_proof, ae_hints: empty_ae_hint() };
    dispatcher.fund(fundPayload);
}

