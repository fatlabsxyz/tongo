use core::ec::{EcPointTrait};
use core::ec::{NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};

use tongo::verifier::structs::{InputsWithdraw, ProofOfWithdraw};
use tongo::prover::prover::prove_withdraw;
use tongo::prover::utils::generate_random;
use tongo::main::ITongoDispatcherTrait;
use snforge_std::{start_cheat_block_number};


#[test]
fn test_withdraw() {
    let seed = 12931238;
    let (address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();

    let b = 250;
    start_cheat_block_number(address,2000);
    dispatcher.fund([y.x(), y.y()], b);

    start_cheat_block_number(address, 2200);
    let epoch = dispatcher.current_epoch();

    let ((Lx,Ly), (Rx,Ry), _last_epoch) = dispatcher.get_buffer([y.x(),y.y()]);

    let inputs: InputsWithdraw = InputsWithdraw {
        y: [y.x(),y.y()],
        epoch,
        amount: b,
        L: [Lx,Ly],
        R: [Rx,Ry],
    };
    let proof: ProofOfWithdraw = prove_withdraw(inputs,x, seed);
    
    dispatcher.withdraw([y.x(),y.y()],b,address, proof);
    let balance = dispatcher.get_balance([y.x(),y.y()]);
    assert!(balance == ((0,0),(0,0)),"fail" );
    let buffer = dispatcher.get_buffer([y.x(),y.y()]);
    assert!(buffer == ((0,0),(0,0), epoch.try_into().unwrap()),"fail" )
}
