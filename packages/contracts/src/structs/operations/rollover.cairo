use crate::structs::common::{
    starkpoint::StarkPoint,
    pubkey::PubKey,
};
use crate::verifier::utils::{cast_in_order};
use crate::structs::traits::{Prefix, Challenge};
use core::poseidon::poseidon_hash_span;

use crate::structs::traits::{AppendPoint};

#[derive(Serde, Drop, Copy)]
pub struct InputsRollOver {
    pub y: PubKey,
    pub nonce: u64,
}

impl RollOverPrefix of Prefix<InputsRollOver> {
    fn prefix(self: @InputsRollOver) -> felt252 {
        let mut arr = array!['rollover'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}

#[derive(Serde, Drop, Copy)]
pub struct ProofOfRollOver {
    pub Ax: StarkPoint,
    pub sx: felt252,
}


impl ChallengeRollOver of Challenge<ProofOfRollOver> {
    fn compute_challenge(self: @ProofOfRollOver, prefix: felt252) -> felt252 {
        let mut arr: Array<felt252> = array![prefix];
        arr.append_coordinates(self.Ax);
        cast_in_order(poseidon_hash_span(arr.span()))
    }
}

#[derive(Drop, Destruct, Serde, Copy)]
pub struct Rollover {
    pub to: PubKey,
    pub proof: ProofOfRollOver,
}

