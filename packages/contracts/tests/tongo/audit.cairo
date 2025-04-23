use core::ec::{EcPointTrait};
use starknet::ContractAddress;
use core::ec::{ NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};
use tongo::prover::utils::{generate_random, decipher_balance};
use tongo::prover::prover::prove_withdraw_all;
use tongo::prover::prover::prove_transfer;
use tongo::prover::prover::prove_fund;

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
    let nonce = dispatcher.get_nonce([y.x(),y.y()]);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));

    let b0 = 3124;
    dispatcher.fund([y.x(),y.y()], b0, fund_proof);

    let audit = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b0, 'CURIOSITY', audit);
}

#[test]
fn audit_withdraw_all() {
    let seed = 4719823;
    let (_address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();

    let empty = dispatcher.get_audit([y.x(),y.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");
    let nonce = dispatcher.get_nonce([y.x(),y.y()]);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));

    let b = 250;
    dispatcher.fund([y.x(), y.y()], b, fund_proof);

    let audit = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b, 'CURIOSITY',audit);


    let ((Lx,Ly), (Rx,Ry)) = dispatcher.get_balance([y.x(),y.y()]);
    let nonce = dispatcher.get_nonce([y.x(),y.y()]);

    let (_inputs,proof)= prove_withdraw_all(x,b,tranfer_address,[Lx,Ly],[Rx,Ry],nonce,seed);
    
    dispatcher.withdraw_all([y.x(),y.y()],b,tranfer_address, proof);
    let audit = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(0, 'CURIOSITY', audit);
}

#[test]
fn audit_transfer() {
    let seed = 1273198273;
    let (_address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    let empty = dispatcher.get_audit([y.x(),y.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");


    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
    let empty = dispatcher.get_audit([y_bar.x(),y_bar.y()]);
    assert!(empty ==((0,0),(0,0)) , "wrong");
    let nonce = dispatcher.get_nonce([y.x(),y.y()]);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    
    let b0 = 3124;
    dispatcher.fund([y.x(),y.y()], b0, fund_proof);
    let nonce = dispatcher.get_nonce([y.x(),y.y()]);

    let audit = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b0, 'CURIOSITY', audit);

    let ((CLx,CLy),(CRx,CRy)) = dispatcher.get_balance([y.x(), y.y()]);
    
    let b = 100; 
    let (inputs, proof) = prove_transfer(x, [y_bar.x(),y_bar.y()], b0,b, [CLx,CLy], [CRx,CRy],nonce,  seed + 1);
    dispatcher.transfer(
        inputs.y,
        inputs.y_bar,
        inputs.L,
        inputs.L_bar,
        inputs.L_audit,
        inputs.R,
        proof,
    );

    let audit = dispatcher.get_audit([y.x(),y.y()]);
    decipher_balance(b0-b, 'CURIOSITY', audit);

    let audit = dispatcher.get_audit([y_bar.x(),y_bar.y()]);
    decipher_balance(b, 'CURIOSITY',audit);
}
