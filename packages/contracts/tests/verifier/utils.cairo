use core::ec::stark_curve::{GEN_X,GEN_Y,ORDER};
use core::ec::EcPointTrait;
use core::ec::EcStateTrait;
use core::ec::NonZeroEcPoint;
use tongo::verifier::utils::{feltXOR, challenge_commits};
use tongo::verifier::structs::{ProofOfBit};

use tongo::prover::utils::{generate_random, compute_s};

/// Simulate a valid transcript (A_x, c, s) for a proof of exponent y = gen**x.
/// Output: A_x:[felt252;2], challenge: felt252, s: felt252
pub fn simPOE(y:[felt252;2], gen:[felt252;2], seed:felt252) -> ([felt252;2], felt252,felt252) {
    let gen = EcPointTrait::new(*gen.span()[0], *gen.span()[1]).unwrap();
    let y = EcPointTrait::new(*y.span()[0], *y.span()[1]).unwrap();
    let s = generate_random(seed,1);
    let c = generate_random(seed,2);
    let temp1 = EcPointTrait::mul(gen, s);
    let temp2 = EcPointTrait::mul(y, c.try_into().unwrap());
    let A:NonZeroEcPoint = (temp1 - temp2).try_into().unwrap();
    return ([A.x(),A.y()],c,s);
}

/// Generate the proof that assert that V = g**b h**r encodes a bit b that is either 0 or 1.
pub fn create_proofofbit(b:u8, h:[felt252;2], r:felt252) -> ProofOfBit {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let gen = EcPointTrait::new(*h.span()[0], *h.span()[1]).unwrap();
    //if b == 0 we follow the standar poe for 0 and simulate for 1
    if b== 0 {
        let V = EcPointTrait::mul(gen, r).try_into().unwrap();
        let V_1:NonZeroEcPoint = (V - g).try_into().unwrap();
        let k : felt252 = generate_random(r,1);
        let A0:NonZeroEcPoint = EcPointTrait::mul(gen, k).try_into().unwrap();

        let (A1, c_1, s_1) = simPOE([V_1.x(), V_1.y()], h, r);
        let mut commits = array![[A0.x(), A0.y()],A1];
        let c = challenge_commits(ref commits);
        let c_0 = feltXOR(c, c_1);
        let s_0 = compute_s(c_0, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V:[V.try_into().unwrap().x(),V.try_into().unwrap().y()],
            A0: [A0.x(), A0.y()],
            A1,
            h,
            c0:c_0,
            s0:s_0,
            s1:s_1};
        return pi;
    // if b == 1 we follow the standar poe for 1 and simulate for 0
    } else {
        //TODO: throw an error if b is not 0 nor 1.
        let V = g + EcPointTrait::mul(gen, r).try_into().unwrap();
        let (A0,c_0,s_0) = simPOE([V.try_into().unwrap().x(), V.try_into().unwrap().y()],h,r);

//        let V_1 = V - g;
        let k = generate_random(r,2);
        let A1:NonZeroEcPoint = EcPointTrait::mul(gen, k).try_into().unwrap();
        let mut commits = array![A0, [A1.x(), A1.y()]];
        let c = challenge_commits(ref commits);
        let c_1 = feltXOR(c, c_0);
        let s_1 = compute_s(c_1, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V:[V.try_into().unwrap().x(),V.try_into().unwrap().y()],
            A0,
            A1:[A1.x(),A1.y()],
            h,
            c0:c_0,
            s0:s_0,
            s1:s_1};
        return pi;
    }
}


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
