use crate::tongo::setup::{setup_tongo};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use tongo::prover::prover::{prove_fund};
use tongo::prover::utils::{generate_random};
use core::ec::{EcPointTrait, NonZeroEcPoint};
use tongo::main::ITongoDispatcherTrait;
use tongo::verifier::structs::PubKey;

#[test]
fn test_fund(){
    //TODO: Tiene sentido que la proof del fundeo dependa de b en el challenge?
    let seed = 12093821093;
    let (_address,dispatcher) = setup_tongo();

    let x = generate_random(seed,1);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let y:PubKey = PubKey {x: y.x(), y: y.y()}; 

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));

    let b1 = 250;
    dispatcher.fund(y, b1, fund_proof);


    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    let b2 = 50;
    dispatcher.fund(y, b2, fund_proof);
}

#[test]
#[should_panic(expected: 'ERROR F100')]
fn test_fund_failed(){
    //TODO: Tiene sentido que la proof del fundeo dependa de b en el challenge?
    let seed = 12093821093;
    let (_address,dispatcher) = setup_tongo();

    let x = generate_random(seed,1);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let y:PubKey = PubKey {x: y.x(), y: y.y()};

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));

    let b1 = 250;
    dispatcher.fund(y, b1, fund_proof);
    dispatcher.fund(y, b1, fund_proof);
}
