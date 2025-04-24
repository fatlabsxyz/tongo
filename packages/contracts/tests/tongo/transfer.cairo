use core::ec::{EcPointTrait};
use core::ec::{ NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};
use tongo::prover::utils::{generate_random};
use tongo::prover::prover::{prove_transfer, prove_fund};

use tongo::main::ITongoDispatcherTrait;
use tongo::verifier::structs::PubKey;

#[test]
fn test_transfer() {
    let seed = 1293123841;
    let (_address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let y:PubKey = PubKey {x: y.x(), y: y.y()};
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
    let y_bar:PubKey = PubKey {x: y_bar.x(), y: y_bar.y()};

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    
    let b0 = 3124;
    dispatcher.fund(y, b0, fund_proof);

    let ((CLx,CLy),(CRx,CRy)) = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);
    
    let b = 100; 
    let (inputs, proof) = prove_transfer(x, y_bar, b0,b, [CLx,CLy], [CRx,CRy],nonce, seed + 1);
    dispatcher.transfer(
        inputs.y,
        inputs.y_bar,
        inputs.L,
        inputs.L_bar,
        inputs.L_audit,
        inputs.R,
        proof,
    );

}

#[test]
fn test_benchmark_prover() {
    let seed = 1293123841;
    let (_address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let y:PubKey = PubKey {x: y.x(), y: y.y()};
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
    let y_bar:PubKey = PubKey {x: y_bar.x(), y: y_bar.y()};
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    
    let b0 = 3124;
    dispatcher.fund(y, b0, fund_proof);

    let ((CLx,CLy),(CRx,CRy)) = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);
    
    let b = 100; 
    let (_inputs, _proof) = prove_transfer(x, y_bar, b0,b, [CLx,CLy], [CRx,CRy],nonce, seed + 1);
}
