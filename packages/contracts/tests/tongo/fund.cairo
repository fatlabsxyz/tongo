use crate::tongo::setup::{setup_tongo, empty_ae_hint};
use crate::prover::functions::{prove_fund};
use crate::prover::utils::{generate_random, decipher_balance};
use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use tongo::structs::operations::fund::Fund;
use crate::consts::{AUDITOR_KEY, USER_CALLER, STRK_ADDRESS};
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
    let seed = 12093821093;
    let (_tongo_address, dispatcher) = setup_tongo();
    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(USER_CALLER);
    let x = generate_random(seed, 1);
    let tongoAmount = 250;
    fund_account(x,0, tongoAmount, dispatcher);

    let finalErc20 = erc20dispatcher.balance_of(USER_CALLER);
    let rate = dispatcher.get_rate();
    assert(initialErc20 - finalErc20 == rate*tongoAmount.into(), 'nope');
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
