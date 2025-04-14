use core::ec::stark_curve::{ORDER};
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;
use core::ec::EcPointTrait;
use core::ec::stark_curve::{GEN_X,GEN_Y};

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

pub fn g_epoch(epoch: u64) -> [felt252;2] {
    let mut x:felt252 = 0;
    let mut salt = 1;
    while EcPointTrait::new_nz_from_x(x).is_none() {
        x = PedersenTrait::new('TONGO')    
            .update(epoch.try_into().unwrap())
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    let g_epoch = EcPointTrait::new_nz_from_x(x).unwrap();
    [g_epoch.x(), g_epoch.y()]
}

pub fn challenge_commits(ref commits: Array<[felt252;2]>) -> felt252 {
    let mut state = PedersenTrait::new(0);
    let mut commit = commits.pop_front();
    while commit.is_some() {
        let [x,y] = commit.unwrap();
        state = state.update(x); 
        state = state.update(y); 
        commit = commits.pop_front();
    };
    let base = state.finalize();
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(base)
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    return c;
}

/// This generator has to be generated at random a it exponent CAN NOT be known.
/// TODO: Generate one at random an store the cooridnates, generate the proof
/// that there are not magic numbers under the sleve
/// ULTRA WARNING: DO NOT FORGET TO DO THIS
pub fn generator_h() -> [felt252;2] {
    let ultra_secret:felt252 = 'TONGO';
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let h = g.mul(ultra_secret).try_into().unwrap();
    [h.x(), h.y()]
}


/// This return the key y from the auditor.
/// TODO: This sould change to a constat point whit the exponent only known for the auditor
pub fn view_key() -> [felt252;2] {
    let ultra_secret:felt252 = 'CURIOSITY';
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let h = g.mul(ultra_secret).try_into().unwrap();
    [h.x(), h.y()]
}
