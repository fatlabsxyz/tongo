//use core::ec::{EcPointTrait, EcStateTrait};
//use core::ec::{ NonZeroEcPoint};
//use core::ec::stark_curve::{GEN_X,GEN_Y};
//use crate::tongo::setup::{setup_tongo};
//use tongo::prover::utils::{compute_s,generate_random};
//use tongo::prover::prover::prove_transfer;
//
//use tongo::verifier::utils::{g_epoch, challenge_commits};
//use tongo::main::ITongoDispatcherTrait;
//use snforge_std::{start_cheat_block_number};
//
//#[test]
//fn test_nonce() {
//    let seed = 12931238;
//    let (address,dispatcher) = setup_tongo();
//    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
//    
//    let x = generate_random(seed,1);
//    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
//    
//    let x_bar = generate_random(seed,2);
//    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
//
//    let b = 1;
//    let r = generate_random(seed,3);
//    let R:NonZeroEcPoint = g.mul(r).try_into().unwrap();
//    let mut state = EcStateTrait::init();
//        state.add_mul(b,g.try_into().unwrap());
//        state.add_mul(r,y.try_into().unwrap());
//    let L = state.finalize_nz().unwrap();
//
//
//    let mut state = EcStateTrait::init();
//        state.add_mul(b,g.try_into().unwrap());
//        state.add_mul(r,y_bar.try_into().unwrap());
//    let L_bar = state.finalize_nz().unwrap();
//    
//    
//    let proof = generate_proof(20, seed, x);
//    start_cheat_block_number(address,2000);
//    
//    dispatcher.transfer(
//        [y.x(), y.y()],
//        [y_bar.x(), y_bar.y()],
//        [L.x(), L.y()],
//        [L_bar.x(), L_bar.y()],
//        [R.x(), R.y()],
//        proof
//    );
//}
//
//#[test]
//#[should_panic(expected:  'Tx already used in epoch')]
//fn test_nonce_fail() {
//    let seed = 12931238;
//    let (address,dispatcher) = setup_tongo();
//    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
//    
//    let x = generate_random(seed,1);
//    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
//    
//    let x_bar = generate_random(seed,2);
//    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
//
//    let b = 1;
//    let r = generate_random(seed,3);
//    let R:NonZeroEcPoint = g.mul(r).try_into().unwrap();
//    let mut state = EcStateTrait::init();
//        state.add_mul(b,g.try_into().unwrap());
//        state.add_mul(r,y.try_into().unwrap());
//    let L = state.finalize_nz().unwrap();
//
//
//    let mut state = EcStateTrait::init();
//        state.add_mul(b,g.try_into().unwrap());
//        state.add_mul(r,y_bar.try_into().unwrap());
//    let L_bar = state.finalize_nz().unwrap();
//    
//    
//    let proof = generate_proof(20, seed, x);
//    start_cheat_block_number(address,2000);
//
//    dispatcher.transfer(
//        [y.x(), y.y()],
//        [y_bar.x(), y_bar.y()],
//        [L.x(), L.y()],
//        [L_bar.x(), L_bar.y()],
//        [R.x(), R.y()],
//        proof
//    );

//    dispatcher.transfer(
//        [y.x(), y.y()],
//        [y_bar.x(), y_bar.y()],
//        [L.x(), L.y()],
//        [L_bar.x(), L_bar.y()],
//        [R.x(), R.y()],
//        proof
//    );
//}

//#[test]
//fn test_nonce_two_epochs() {
//    let seed = 12931238;
//    let (address,dispatcher) = setup_tongo();
//    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
//    
//    let x = generate_random(seed,1);
//    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
//    
//    let x_bar = generate_random(seed,2);
//    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();
//
//    let b = 1;
//    let r = generate_random(seed,3);
//    let R:NonZeroEcPoint = g.mul(r).try_into().unwrap();
//    let mut state = EcStateTrait::init();
//        state.add_mul(b,g.try_into().unwrap());
//        state.add_mul(r,y.try_into().unwrap());
//    let L = state.finalize_nz().unwrap();
//
//
//    let mut state = EcStateTrait::init();
//        state.add_mul(b,g.try_into().unwrap());
//        state.add_mul(r,y_bar.try_into().unwrap());
//    let L_bar = state.finalize_nz().unwrap();
//    
//    
//    let proof = generate_proof(20, seed, x);
//    start_cheat_block_number(address,2000);
//
//    dispatcher.transfer(
//        [y.x(), y.y()],
//        [y_bar.x(), y_bar.y()],
//        [L.x(), L.y()],
//        [L_bar.x(), L_bar.y()],
//        [R.x(), R.y()],
//        proof
//    );
//
//    start_cheat_block_number(address,2200);
//    let proof = generate_proof(22, seed, x);
//    
//    dispatcher.transfer(
//        [y.x(), y.y()],
//        [y_bar.x(), y_bar.y()],
//        [L.x(), L.y()],
//        [L_bar.x(), L_bar.y()],
//        [R.x(), R.y()],
//        proof
//    );
//}
