use core::ec::{EcPointTrait};
use core::ec::{ NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};
use tongo::prover::utils::{generate_random};
use tongo::prover::prover::prove_transfer;

use tongo::main::ITongoDispatcherTrait;
use snforge_std::{start_cheat_block_number};

#[test]
fn test_transfer() {
    let seed = 1293123841;
    let (address,dispatcher) = setup_tongo();
    start_cheat_block_number(address,120);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
    
    let b0 = 3124;
    dispatcher.fund([y.x(),y.y()], b0);

    start_cheat_block_number(address,220);
    let this_epoch = dispatcher.current_epoch();
    let ((CLx,CLy),(CRx,CRy)) = dispatcher.get_balance([y.x(), y.y()]);
    
    let b = 100; 
    let (inputs, proof) = prove_transfer(x, [y_bar.x(),y_bar.y()], b0,b, [CLx,CLy], [CRx,CRy], this_epoch, seed + 1);
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
    let (address,dispatcher) = setup_tongo();
    start_cheat_block_number(address,120);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
    
    let b0 = 3124;
    dispatcher.fund([y.x(),y.y()], b0);

    start_cheat_block_number(address,220);
    let this_epoch = dispatcher.current_epoch();
    let ((CLx,CLy),(CRx,CRy)) = dispatcher.get_balance([y.x(), y.y()]);
    
    let b = 100; 
    let (_inputs, _proof) = prove_transfer(x, [y_bar.x(),y_bar.y()], b0,b, [CLx,CLy], [CRx,CRy], this_epoch, seed + 1);
}
