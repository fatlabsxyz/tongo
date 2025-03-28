use core::ec::{EcPointTrait};
use core::ec::{ NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X,GEN_Y,ORDER};
use crate::setup::{setup_tongo};
use crate::verifier::utils::{compute_s,generate_random};
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;

use tongo::verifier::utils::{in_order};
use tongo::verifier::structs::ProofOfWithdraw;
use tongo::verifier::utils::g_epoch;
use tongo::main::ITongoDispatcherTrait;
use snforge_std::{start_cheat_block_number};


pub fn prove(b:felt252, x:felt252, seed:felt252, epoch:u64, R:[felt252;2]) -> ProofOfWithdraw {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let R = EcPointTrait::new_nz(*R.span()[0],  *R.span()[1]).unwrap();
    let g_epoch = g_epoch(epoch);
    let nonce: NonZeroEcPoint  = g_epoch.mul(x).try_into().unwrap();

    //poe for y = g**x and L/g**b = R**x
    let k = generate_random(seed,3);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    let A_cr: NonZeroEcPoint = EcPointTrait::mul(R.try_into().unwrap(), k).try_into().unwrap();
    let A_u: NonZeroEcPoint = EcPointTrait::mul(g_epoch.try_into().unwrap(), k).try_into().unwrap();
    let c = challenge_proof(A_x, A_u, A_cr);
    let s = compute_s(c, x, k);

    let proof: ProofOfWithdraw = ProofOfWithdraw {
        nonce: [nonce.x(), nonce.y()],
        A_n: [A_u.x(), A_u.y()],
        A_x: [A_x.x(), A_x.y()],
        A_cr: [A_cr.x(), A_cr.y()],
        s_x: s,
    };
    println!("Proof generated");
    return proof;
}

fn challenge_proof(A_x: NonZeroEcPoint, A_u: NonZeroEcPoint, A_cr:NonZeroEcPoint) -> felt252 {
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(A_x.x())
            .update(A_x.y())
            .update(A_u.x())
            .update(A_u.y())
            .update(A_cr.x())
            .update(A_cr.y())
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    return c;
}

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

    let ( _ , (Rx_buff,Ry_buff), _last_epoch) = dispatcher.get_buffer([y.x(),y.y()]);

    let proof = prove(b,x, seed, epoch, [Rx_buff,Ry_buff]);
    
    dispatcher.withdraw([y.x(),y.y()],b,address, proof);
    let balance = dispatcher.get_balance([y.x(),y.y()]);
    assert!(balance == ((0,0),(0,0)),"fail" );
    let buffer = dispatcher.get_buffer([y.x(),y.y()]);
    assert!(buffer == ((0,0),(0,0), epoch.try_into().unwrap()),"fail" )
}
