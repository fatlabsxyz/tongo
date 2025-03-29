use core::ec::{EcPointTrait};
use core::ec::{NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};

use tongo::prover::utils::{cipher_balance, generate_random};
use tongo::prover::prover::{ prove_transfer};
use tongo::verifier::verifier::verify_transfer;


#[test]
fn test_transfer() {
    // setup
    let g:NonZeroEcPoint = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let epoch = 94;

    let seed = 47198274198273;
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    
    // balance stored
    let b0 = 100;
    let r0 = generate_random(seed,3);
    let (CL, CR) = cipher_balance(b0, [y.x(), y.y()], r0);
    // end of setup

    let b = 12; 
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x_bar).try_into().unwrap();
    
    let (inputs, proof ) = prove_transfer(x, [y_bar.x(), y_bar.y()],b0, b,CL,CR, epoch, generate_random(seed,4));

    verify_transfer(inputs,proof);
}
