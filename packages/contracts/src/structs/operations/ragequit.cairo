use crate::structs::common::{
    pubkey::PubKey,
    cipherbalance::CipherBalance,
    starkpoint::StarkPoint,
};

use crate::structs::aecipher::{AEHints};
use crate::verifier::utils::{cast_in_order};
use starknet::ContractAddress;
use crate::structs::traits::{Prefix, Challenge};
use core::poseidon::poseidon_hash_span;

use crate::structs::traits::{AppendPoint};

#[derive(Drop, Destruct, Serde, Copy)]
pub struct Ragequit {
    pub from: PubKey,
    pub amount: felt252,
    pub to: ContractAddress,
    pub ae_hints: AEHints,
    pub proof: ProofOfRagequit,
}

#[derive(Serde, Drop, Copy)]
pub struct InputsRagequit {
    pub y: PubKey,
    pub nonce: u64,
    pub to: ContractAddress,
    pub amount: felt252,
    pub currentBalance: CipherBalance,
}

#[derive(Serde, Drop, Copy)]
pub struct ProofOfRagequit {
    pub A_x: StarkPoint,
    pub A_cr: StarkPoint,
    pub s_x: felt252,
}


impl ChallengeRagequit of Challenge<ProofOfRagequit> {
    fn compute_challenge(self: @ProofOfRagequit, prefix: felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A_x);
       arr.append_coordinates(self.A_cr);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}

impl RagequitPrefix of Prefix<InputsRagequit> {
    fn prefix(self: @InputsRagequit) -> felt252 {
        let mut arr = array!['ragequit'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}
