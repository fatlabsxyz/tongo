use core::ec::stark_curve::{GEN_X,GEN_Y,ORDER};
use core::ec::EcPointTrait;
use core::ec::EcStateTrait;
use core::ec::NonZeroEcPoint;
use tongo::verifier::utils::{challenge_commits};

use tongo::prover::utils::{generate_random, compute_s};



pub fn cipher_balance(b:felt252, y:[felt252;2],random:felt252) -> ([felt252;2], [felt252;2]) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = EcPointTrait::new_nz(*y.span()[0], *y.span()[1]).unwrap();
    let mut state = EcStateTrait::init();
        state.add_mul(b,g);
        state.add_mul(random,y);
    let L = state.finalize_nz().unwrap();
    let R:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), random).try_into().unwrap();
    return ([L.x(),L.y()], [R.x(), R.y()]);
}

pub fn prover_poe(g: [felt252;2], x: felt252, seed: felt252) -> ([felt252;2], felt252, felt252) {
    let g = EcPointTrait::new_nz(*g.span()[0], *g.span()[1]).unwrap();
    let k = generate_random(seed, 1000);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    let mut commit = array![[A_x.x(),A_x.y()]];
    let c = challenge_commits(ref commit);
    let s = compute_s(c, x, k);
    return ([A_x.x(), A_x.y()], c,s);
}

#[test]
// 2(ORDER - 10) is equal to ORDER - 20 only if computed mod(ORDER). 
fn compute_s_ok() {
    let c = ORDER - 10;
    let x = 2;
    let k = 0;
    let s = compute_s(c, x, k);
    assert!(s == (ORDER - 20).try_into().unwrap(), "Nope");
}
