use crate::tongo::setup::{setup_tongo, setup_erc20, print};
use crate::prover::functions::{prove_fund};
use crate::prover::utils::{generate_random};
use tongo::main::{ITongoDispatcherTrait, Fund};
use tongo::verifier::structs::{PubKeyTrait};
use snforge_std::{ start_cheat_caller_address };

#[test]
fn test_fund() {
    //TODO: Tiene sentido que la proof del fundeo dependa de b en el challenge?
    let seed = 12093821093;
    let (tongo_address, dispatcher) = setup_tongo();
    let (_STRK_ADDRESS, _erc20_dispatcher) = setup_erc20();
    let USER:felt252 = 0x075662cc8b986d55d709d58f698bbb47090e2474918343b010192f487e30c23f;
    print(USER.try_into().unwrap());

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b1 = 250;
    let fundPayload = Fund { to: y, amount: b1, proof: fund_proof };

    start_cheat_caller_address(tongo_address, USER.try_into().unwrap());
    dispatcher.fund(fundPayload);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));
    let b2 = 50;
    let fundPayload = Fund { to: y, amount: b2, proof: fund_proof };

    dispatcher.fund(fundPayload);
}

#[test]
#[should_panic(expected: 'ERROR F100')]
fn test_fund_failed() {
    //TODO: Tiene sentido que la proof del fundeo dependa de b en el challenge?
    let seed = 12093821093;
    let (_address, dispatcher) = setup_tongo();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let b1 = 250;

    dispatcher.fund(Fund { to: y, amount: b1, proof: fund_proof });
    dispatcher.fund(Fund { to: y, amount: b1, proof: fund_proof });
}
