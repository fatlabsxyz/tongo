use core::ec::{
    NonZeroEcPoint,
    EcPointTrait,
    stark_curve::{GEN_X, GEN_Y, ORDER},
};
use core::{
    pedersen::PedersenTrait,
    poseidon::poseidon_hash_span,
    hash::HashStateTrait,
};

use tongo::structs::common::{
    pubkey::PubKey,
    cipherbalance::{CipherBalance, CipherBalanceTrait},
};

use tongo::verifier::utils::generator_h;
use she::utils::in_curve_order;

pub fn pubkey_from_secret(x:felt252) -> PubKey {
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let key:NonZeroEcPoint = g.mul(x).try_into().unwrap();
        key.into()
}

/// Generates a "random" number in the curve order.
pub fn generate_random(seed: felt252, multiplicity: felt252) -> felt252 {
    let mut salt = 1;
    let mut c = ORDER + 1;
    while in_curve_order(c).is_err() {
        c = PedersenTrait::new(seed).update(multiplicity).update(salt).finalize();
        salt = salt + 1;
    };
    return c;
}

/// Asserts that g**b == L/R**x. This show that the given balance b is encoded in the cipher
/// balance (L,R) = (g**b y**r, g**r).
/// This function DOES NOT bruteforces b and is intended only for testing purposes
pub fn decipher_balance(b: felt252, x: felt252, cipher: CipherBalance) {
    let (L, R) = cipher.points();
    if b != 0 {
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let RHS: NonZeroEcPoint = (L - R.mul(x)).try_into().unwrap();
        let LHS: NonZeroEcPoint = g.mul(b).try_into().unwrap();
        assert!(LHS.coordinates() == RHS.coordinates(), "decipher failed");
    } else {
        let LHS: NonZeroEcPoint = L.try_into().unwrap();
        let RHS: NonZeroEcPoint = R.mul(x).try_into().unwrap();
        assert!(LHS.coordinates() == RHS.coordinates(), "decipher failed for b 0");
    }
}

pub fn computeH() -> NonZeroEcPoint {
    let input = GEN_X;
    let mut output = Option::None;
    let mut nonce: felt252 = 1;
    while (output.is_none()) {
        let x = poseidon_hash_span([input,nonce].span());
        output = EcPointTrait::new_nz_from_x(x);
        nonce = nonce + 1;
    }
    return output.unwrap();
}

#[test]
fn showH() {
    let h = computeH();
//    println!("H: x: {:x}, y: {:x}", h.x(), h.y());
    assert(h.coordinates() == generator_h().coordinates(), 'False');
}
