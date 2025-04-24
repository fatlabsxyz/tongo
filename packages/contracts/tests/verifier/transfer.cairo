use core::ec::{EcPointTrait};
use core::ec::{NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};

use tongo::prover::utils::{cipher_balance, generate_random};
use tongo::prover::prover::{ prove_transfer};
use tongo::verifier::verifier::verify_transfer;

use tongo::verifier::structs::PubKey;

#[test]
fn test_transfer() {
    // setup
    let g:NonZeroEcPoint = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();

    let seed = 47198274198273;
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    let y:PubKey = PubKey {x: y.x(), y: y.y()};
    
    // balance stored
    let b0 = 100;
    let r0 = generate_random(seed,3);
    let (CL, CR) = cipher_balance(b0, y, r0);
    // end of setup

    let b = 12; 
    let nonce = 1;
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x_bar).try_into().unwrap();
    let y_bar:PubKey = PubKey {x: y_bar.x(), y: y_bar.y()};
    
    let (inputs, proof ) = prove_transfer(x, y_bar,b0, b,CL,CR,nonce, generate_random(seed,4));

    verify_transfer(inputs,proof);
}
