use core::ec::{EcPointTrait, EcStateTrait};
use core::ec::{ NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::tongo::setup::{setup_tongo};
use tongo::prover::utils::{compute_s,generate_random};

use tongo::verifier::structs::Proof;
use tongo::verifier::utils::{g_epoch, challenge_commits};
use tongo::main::ITongoDispatcherTrait;
use snforge_std::{start_cheat_block_number};

fn generate_proof(epoch: u64, seed:felt252, x: felt252) -> Proof {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let [g_epoch_x, g_epoch_y] = g_epoch(epoch);
    let g_epoch = EcPointTrait::new(g_epoch_x, g_epoch_y).unwrap();
    let nonce: NonZeroEcPoint  = g_epoch.mul(x).try_into().unwrap();
    
    let k = generate_random(seed,1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    
    let A_u: NonZeroEcPoint = EcPointTrait::mul(g_epoch.try_into().unwrap(), k).try_into().unwrap();
    let mut commits = array![
        [A_x.x(), A_x.y()], 
        [A_u.x(), A_u.y()], 
    ];
    let c = challenge_commits(ref commits);
    let s = compute_s(c, x, k);
    let proof: Proof = Proof {
        nonce: [nonce.x(), nonce.y()],
        A_n: [A_u.x(), A_u.y()],
        A_x: [A_x.x(), A_x.y()],
        s_x: s,
    } ;
    return proof;
}

#[test]
fn test_nonce() {
    let seed = 12931238;
    let (address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();

    let b = 1;
    let r = generate_random(seed,3);
    let R:NonZeroEcPoint = g.mul(r).try_into().unwrap();
    let mut state = EcStateTrait::init();
        state.add_mul(b,g.try_into().unwrap());
        state.add_mul(r,y.try_into().unwrap());
    let L = state.finalize_nz().unwrap();


    let mut state = EcStateTrait::init();
        state.add_mul(b,g.try_into().unwrap());
        state.add_mul(r,y_bar.try_into().unwrap());
    let L_bar = state.finalize_nz().unwrap();
    
    
    let proof = generate_proof(20, seed, x);
    start_cheat_block_number(address,2000);
    
    dispatcher.transfer(
        [y.x(), y.y()],
        [y_bar.x(), y_bar.y()],
        [L.x(), L.y()],
        [L_bar.x(), L_bar.y()],
        [R.x(), R.y()],
        proof
    );
}

#[test]
#[should_panic(expected:  'Tx already used in epoch')]
fn test_nonce_fail() {
    let seed = 12931238;
    let (address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();

    let b = 1;
    let r = generate_random(seed,3);
    let R:NonZeroEcPoint = g.mul(r).try_into().unwrap();
    let mut state = EcStateTrait::init();
        state.add_mul(b,g.try_into().unwrap());
        state.add_mul(r,y.try_into().unwrap());
    let L = state.finalize_nz().unwrap();


    let mut state = EcStateTrait::init();
        state.add_mul(b,g.try_into().unwrap());
        state.add_mul(r,y_bar.try_into().unwrap());
    let L_bar = state.finalize_nz().unwrap();
    
    
    let proof = generate_proof(20, seed, x);
    start_cheat_block_number(address,2000);

    dispatcher.transfer(
        [y.x(), y.y()],
        [y_bar.x(), y_bar.y()],
        [L.x(), L.y()],
        [L_bar.x(), L_bar.y()],
        [R.x(), R.y()],
        proof
    );

    dispatcher.transfer(
        [y.x(), y.y()],
        [y_bar.x(), y_bar.y()],
        [L.x(), L.y()],
        [L_bar.x(), L_bar.y()],
        [R.x(), R.y()],
        proof
    );
}

#[test]
fn test_nonce_two_epochs() {
    let seed = 12931238;
    let (address,dispatcher) = setup_tongo();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = g.mul(x).try_into().unwrap();
    
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = g.mul(x_bar).try_into().unwrap();

    let b = 1;
    let r = generate_random(seed,3);
    let R:NonZeroEcPoint = g.mul(r).try_into().unwrap();
    let mut state = EcStateTrait::init();
        state.add_mul(b,g.try_into().unwrap());
        state.add_mul(r,y.try_into().unwrap());
    let L = state.finalize_nz().unwrap();


    let mut state = EcStateTrait::init();
        state.add_mul(b,g.try_into().unwrap());
        state.add_mul(r,y_bar.try_into().unwrap());
    let L_bar = state.finalize_nz().unwrap();
    
    
    let proof = generate_proof(20, seed, x);
    start_cheat_block_number(address,2000);

    dispatcher.transfer(
        [y.x(), y.y()],
        [y_bar.x(), y_bar.y()],
        [L.x(), L.y()],
        [L_bar.x(), L_bar.y()],
        [R.x(), R.y()],
        proof
    );

    start_cheat_block_number(address,2200);
    let proof = generate_proof(22, seed, x);
    
    dispatcher.transfer(
        [y.x(), y.y()],
        [y_bar.x(), y_bar.y()],
        [L.x(), L.y()],
        [L_bar.x(), L_bar.y()],
        [R.x(), R.y()],
        proof
    );
}
