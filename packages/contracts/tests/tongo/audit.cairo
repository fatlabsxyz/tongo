use core::ec::{EcPointTrait};
use core::ec::{ NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};
use tongo::prover::utils::{generate_random, decipher_balance};
use tongo::prover::prover::prove_withdraw_all;
use tongo::prover::prover::prove_transfer;

use snforge_std::{start_cheat_block_number};
use tongo::main::ITongoDispatcherTrait;

#[test]
fn audit_fund() {
    let seed = 9130123;
    let (_address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    
    let empty = dispatcher.get_audit([y.x(),y.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");

    let b0 = 3124;
    dispatcher.fund([y.x(),y.y()], b0);

    let ((Lx,Ly) ,(Rx,Ry)) = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b0, 'CURIOSITY', [Lx,Ly], [Rx,Ry]);
}

#[test]
fn audit_withdraw_all() {
    let seed = 4719823;
    let (address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();

    let empty = dispatcher.get_audit([y.x(),y.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");

    let b = 250;
    start_cheat_block_number(address,2000);
    dispatcher.fund([y.x(), y.y()], b);
    let ((Lx,Ly) ,(Rx,Ry)) = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b, 'CURIOSITY', [Lx,Ly], [Rx,Ry]);

    start_cheat_block_number(address, 2200);
    let epoch = dispatcher.current_epoch();

    let ((Lx,Ly), (Rx,Ry)) = dispatcher.get_balance([y.x(),y.y()]);

    let (_inputs,proof)= prove_withdraw_all(x,b,[Lx,Ly],[Rx,Ry],epoch,seed);
    
    dispatcher.withdraw_all([y.x(),y.y()],b,address, proof);
    let empty = dispatcher.get_audit([y.x(),y.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");
}

#[test]
fn audit_transfer() {
    let seed = 1273198273;
    let (address,dispatcher) = setup_tongo();
    start_cheat_block_number(address,120);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let empty = dispatcher.get_audit([y.x(),y.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");


    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
    let empty = dispatcher.get_audit([y_bar.x(),y_bar.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");
    
    let b0 = 3124;
    dispatcher.fund([y.x(),y.y()], b0);

    let ((Lx,Ly) ,(Rx,Ry)) = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b0, 'CURIOSITY', [Lx,Ly], [Rx,Ry]);

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

    let ((Lx,Ly) ,(Rx,Ry)) = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b0-b, 'CURIOSITY', [Lx,Ly], [Rx,Ry]);

    let ((Lx,Ly) ,(Rx,Ry)) = dispatcher.get_audit([y_bar.x(),y_bar.y()]);
    decipher_balance(b, 'CURIOSITY', [Lx,Ly], [Rx,Ry]);
}
