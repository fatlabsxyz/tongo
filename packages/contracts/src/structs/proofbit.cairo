use crate::structs::common::starkpoint::StarkPoint;
use crate::structs::traits::{Challenge, SerdeNonZeroEcPoint, AppendPoint};
use crate::verifier::utils::{cast_in_order};
use core::poseidon::poseidon_hash_span;


#[derive(Serde, Drop, Copy)]
/// Proof that V = g**b h**r with b either one or zero is well formed. The proof use a OR protocol
/// to assert that one of the two is valid without revealing which one.
pub struct ProofOfBit {
    pub V: StarkPoint,
    pub A0: StarkPoint,
    pub A1: StarkPoint,
    pub c0: felt252,
    pub s0: felt252,
    pub s1: felt252,
}

impl ChallengeBit of Challenge<ProofOfBit> {
    fn compute_challenge(self: @ProofOfBit, prefix:felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A0);
       arr.append_coordinates(self.A1);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}

#[derive(Serde, Drop, Copy)]
pub struct ProofOfBit2 {
    pub V: StarkPoint,
    pub A: StarkPoint,
    pub B: StarkPoint,
    pub sb: felt252,
    pub sr: felt252,
    pub z: felt252,
}


impl ChallengeBit2 of Challenge<ProofOfBit2> {
    fn compute_challenge(self: @ProofOfBit2, prefix:felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A);
       arr.append_coordinates(self.B);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}
