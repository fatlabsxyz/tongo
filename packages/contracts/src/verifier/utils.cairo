use core::ec::stark_curve::{ORDER};
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;
use core::ec::EcPointTrait;
use core::ec::EcPoint;

// 2**32
const MAX: u128 = 4294967296;


///Checks if given number is less than curve order. 
pub fn in_order(number:felt252) -> bool { 
    let number: u256 = number.try_into().unwrap();
    let ORDER_256: u256 = ORDER.try_into().unwrap();
    if number < ORDER_256 { return true ; }
    return false;
}

/// Checks if given number is in the range of the balance.
/// Warning: be carefull if MAX is changed. It HAS to be 2**n
pub fn in_range(number:felt252) -> bool { 
    let number: u128 = number.try_into().unwrap();
    if number < MAX { return true ; }
    return false;
}

/// Computes the bitwise XOR between lhs and rhs.
pub fn feltXOR(lhs: felt252, rhs: felt252) -> felt252 {
    let l: u256 = lhs.try_into().unwrap();
    let r: u256 = rhs.try_into().unwrap();
    u256{low: l.low ^ r.low, high: l.high ^ r.high}.try_into().unwrap()
}

/// Checks if given pair of felts are the coordinates [x,y] of a point in the stark curve.
pub fn on_curve(coordinates: [felt252;2]) -> bool {
    let point = EcPointTrait::new(*coordinates.span()[0], *coordinates.span()[1]);
    return point.is_some();
}

///TODO: This function is the simple one I propose, is it hard to test because
/// we have to find a A_x such that the challenge computed from it overflows the curve order.
pub fn compute_challenge(A_x:[felt252;2]) -> felt252 {
    assert!(on_curve(A_x));
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(*A_x.span()[0])
            .update(*A_x.span()[1])
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    return c;
}

/// Compute the challenge in the non-interactive sigma protocol needed in the proof of balance
pub fn compute_challenge_pob(A_x:[felt252;2], A_cr:[felt252;2]) -> felt252 {
    assert!(on_curve(A_x));
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(*A_x.span()[0])
            .update(*A_x.span()[1])
            .update(*A_cr.span()[0])
            .update(*A_cr.span()[1])
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    return c;
}


/// Compute the challenge in the non-interactive sigma protocol needed in the OR proof
pub fn compute_challenge_or(A_0:[felt252;2], A_1:[felt252;2]) -> felt252 {
    assert!(on_curve(A_0));
    assert!(on_curve(A_1));
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(*A_0.span()[0])
            .update(*A_0.span()[1])
            .update(*A_1.span()[0])
            .update(*A_1.span()[1])
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    return c;
}

/// Reconstruct the number given its binary decomposition.
/// TODO: uptdate this to 2**32
pub fn bin_to_num(num:[u32;6]) -> felt252 {
    let mut pow: felt252 = 1;
    let mut i = 0;
    let mut s = 0;
    while i < 6 {
        s = s + (*num.span()[i]).try_into().unwrap() * pow;
        i = i+1;
    };
    s
}


pub fn g_epoch(epoch: u64) -> EcPoint {
    let mut x:felt252 = 0;
    let mut salt = 1;
    while EcPointTrait::new_nz_from_x(x).is_none() {
        x = PedersenTrait::new('TONGO')    
            .update(epoch.try_into().unwrap())
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    EcPointTrait::new_from_x(x).unwrap()
}
