use crate::structs::common::{
    cipherbalance::CipherBalance,
    pubkey::PubKey,
    starkpoint::StarkPoint,
};
use crate::structs::aecipher::AEHints;
use crate::structs::proofbit::ProofOfBit;
use crate::verifier::utils::{cast_in_order};
use crate::structs::traits::{Prefix, Challenge};
use core::poseidon::poseidon_hash_span;

use starknet::ContractAddress;

use crate::structs::traits::{AppendPoint};

#[derive(Drop, Destruct, Serde, Copy)]
pub struct Withdraw {
    pub from: PubKey,
    pub to: ContractAddress,
    pub amount: felt252,
    pub auditedBalance: CipherBalance,
    pub ae_hints: AEHints,
    pub proof: ProofOfWithdraw,
}

#[derive(Serde, Drop, Copy)]
pub struct InputsWithdraw {
    pub y: PubKey,
    pub nonce: u64,
    pub to: ContractAddress,
    pub amount: felt252,
    pub auditorPubKey: PubKey,
    pub currentBalance: CipherBalance,
    pub auditedBalance: CipherBalance,
}

#[derive(Serde, Drop, Copy)]
pub struct ProofOfWithdraw {
    pub A_x: StarkPoint,
    pub A_r: StarkPoint,
    pub A: StarkPoint,
    pub A_v: StarkPoint,
    pub A_auditor: StarkPoint,
    pub sx: felt252,
    pub sb: felt252,
    pub sr: felt252,
    pub range: Span<ProofOfBit>,
}

impl ChallengeWithdraw of Challenge<ProofOfWithdraw> {
    fn compute_challenge(self: @ProofOfWithdraw, prefix: felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A_x);
       arr.append_coordinates(self.A_r);
       arr.append_coordinates(self.A);
       arr.append_coordinates(self.A_v);
       arr.append_coordinates(self.A_auditor);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}



impl WithdrawPrefix of Prefix<InputsWithdraw> {
    fn prefix(self: @InputsWithdraw) -> felt252 {
        let mut arr = array!['withdraw'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}
