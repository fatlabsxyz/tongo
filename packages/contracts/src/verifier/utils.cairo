use core::ec::stark_curve::{ORDER};
use core::poseidon::poseidon_hash_span;
use core::ec::{EcPointTrait, NonZeroEcPoint};

// 2**32
const MAX: u128 = 4294967296;

///Checks if given number is less than curve order.
pub fn in_order(number: felt252) -> bool {
    let number: u256 = number.try_into().unwrap();
    let ORDER_256: u256 = ORDER.try_into().unwrap();
    if number < ORDER_256 {
        return true;
    }
    return false;
}

/// This is used to cast a felt252 into the curve order. It is ussed mainlly in challenge computation.
/// We could simply use a integer division number % CURVE_ORDER but this leads to a non-uniform distribution.
/// We decided to hash the number if it is bigger that CURVE_ORDER until it is in the correct range.
/// 
/// Note: The diference between a felt252 and CURVE_ORDER is ~ 2**70. So the chances of hashing anything
/// and not to land inside CURVE_ORDER are ~ 2**70/2**252.
pub fn cast_in_order(number: felt252) -> felt252 {
    let mut output = ORDER + 1;
    let mut salt = 1;
    while !in_order(output) {
        output = poseidon_hash_span(array![number,salt].span());
        salt = salt + 1;
    }
    return output;
}


/// Checks if given number is in the range of the balance.
/// Warning: be carefull if MAX is changed. It HAS to be 2**n
pub fn in_range(number: felt252) -> bool {
    let number: u128 = number.try_into().unwrap();
    if number < MAX {
        return true;
    }
    return false;
}

/// Computes the bitwise XOR between lhs and rhs.
pub fn feltXOR(lhs: felt252, rhs: felt252) -> felt252 {
    let l: u256 = lhs.try_into().unwrap();
    let r: u256 = rhs.try_into().unwrap();
    u256 { low: l.low ^ r.low, high: l.high ^ r.high }.try_into().unwrap()
}

/// This generatos has been computed hashing:
/// x = poseidon(input, nonce) for nonce from 1,... until x is a coordinate of a valid point
/// of the starknet curve, currently input= GEN_X.
/// TODO: Think if we need another input
pub fn generator_h() -> NonZeroEcPoint {
    let h_x: felt252 = 0x162eb5cc8f50e522225785a604ba6d7e9ab06b647157f77c59a06032610b2d2;
    let h_y: felt252 = 0x220a56864c490175202e3e34db0e24d12979fbfacea16a360e8feb1f6749192;
    let h = EcPointTrait::new_nz(h_x, h_y).unwrap();
    return h;
}
