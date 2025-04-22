use core::ec::{EcPointTrait};
use core::ec::{NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};

use tongo::prover::prover::{prove_withdraw_all, prove_withdraw};
use tongo::prover::utils::generate_random;
use tongo::main::ITongoDispatcherTrait;


#[test]
fn test_withdraw_all() {
    let seed = 12931238;
    let (address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();

    let b = 250;
    dispatcher.fund([y.x(), y.y()], b);

    let ((Lx,Ly), (Rx,Ry)) = dispatcher.get_balance([y.x(),y.y()]);

    let (_inputs,proof)= prove_withdraw_all(x,b,[Lx,Ly],[Rx,Ry],seed);
    
    dispatcher.withdraw_all([y.x(),y.y()],b,address, proof);
    let balance = dispatcher.get_balance([y.x(),y.y()]);
    assert!(balance == ((0,0),(0,0)),"fail" );
    let buffer = dispatcher.get_buffer([y.x(),y.y()]);
    assert!(buffer == ((0,0),(0,0)),"fail" )
}

#[test]
fn test_withdraw() {
    let seed = 8309218;
    let (address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();

    let initial_balance = 250;
    let amount = 50;
    dispatcher.fund([y.x(), y.y()], initial_balance);

    let ((Lx,Ly), (Rx,Ry)) = dispatcher.get_balance([y.x(),y.y()]);

    let (_inputs,proof)= prove_withdraw(x,initial_balance, amount,[Lx,Ly],[Rx,Ry],seed);
    
    dispatcher.withdraw([y.x(),y.y()],amount,address, proof);
}
