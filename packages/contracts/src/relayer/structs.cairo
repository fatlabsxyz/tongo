use starknet::account::Call;
use starknet::ContractAddress;
use core::poseidon::{PoseidonTrait, poseidon_hash_span};
use core::hash::{HashStateExTrait, HashStateTrait};

use crate::structs::common::pubkey::PubKey;

const STARKNET_DOMAIN_TYPE_HASH: felt252 =
    0x1ff2f602e42168014d405a94f75e8a93d640751d71d16311266e140d8b0a210;
pub const OUTSIDE_EXECUTION_TYPE_HASH: felt252 =
    0x312b56c05a7965066ddbda31c016d8d05afc305071c0ca3cdc2192c3c2f1f0f;
const CALL_TYPE_HASH: felt252 =
    0x3635c7f2a7ba93844c0d064e18e487f35ab90f7c39d00f186a781fc3f0c2ca9;

#[derive(Drop, Copy, Hash)]
pub struct StarknetDomain {
    pub name: felt252,
    pub version: felt252,
    pub chain_id: felt252,
    pub revision: felt252,
}

pub trait StructHash<T> {
    fn hash_struct(self: @T) -> felt252;
}

pub impl StructHashStarknetDomain of StructHash<StarknetDomain> {
    fn hash_struct(self: @StarknetDomain) -> felt252 {
        PoseidonTrait::new().update_with(STARKNET_DOMAIN_TYPE_HASH).update_with(*self).finalize()
    }
}

pub impl StructHashCall of StructHash<Call> {
    fn hash_struct(self: @Call) -> felt252 {
        PoseidonTrait::new()
            .update_with(CALL_TYPE_HASH)
            .update_with(*self.to)
            .update_with(*self.selector)
            .update_with(poseidon_hash_span(*self.calldata))
            .finalize()
    }
}


#[derive(Copy, Drop, Serde)]
pub struct RelayStatus {
    pub asset: Option<ContractAddress>,
    pub target: Option<ContractAddress>,
    pub pubkey: Option<PubKey>,
    pub to_add: u256,
    pub to_subtract: u256,
}

#[generate_trait]
pub impl RelayStatusImpl of RelayStatusTrait {
    fn add(ref self: RelayStatus, amount: u256) {
        self.to_add += amount
    }

    fn subtract(ref self: RelayStatus, amount: u256) {
        self.to_subtract += amount
    }

    fn compare_and_set_asset(ref self: RelayStatus, asset: ContractAddress) {
        match self.asset {
            None => { self.asset = Some(asset) },
            Some(stored) => assert!(stored == asset, "FEE ASSET MISMATCH"),
        }
    }

    fn compare_and_set_target(ref self: RelayStatus, target: ContractAddress) {
        match self.target {
            None => { self.target = Some(target) },
            Some(stored) => assert!(stored == target, "MULTIPLE TONGO TARGETS"),
        }
    }

    fn compare_and_set_pubkey(ref self: RelayStatus, pubkey: PubKey) {
        match self.pubkey {
            None => { self.pubkey = Some(pubkey) },
            Some(stored) => assert!(stored == pubkey, "MULTIPLE TONGO PUBKEYS"),
        }
    }

    fn new() -> RelayStatus {
        RelayStatus {
            asset: None,
            target: None,
            pubkey: None,
            to_add: 0,
            to_subtract: 0,
        }
    }
}


#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct TargetConfig {
    pub erc20: starknet::ContractAddress,
    pub rate: u256,
    pub relayer_fee: u256,
}

#[derive(Copy, Drop, Serde)]
pub struct OutsideExecution {
    pub caller: ContractAddress,
    pub nonce: felt252,
    pub execute_after: u64,
    pub execute_before: u64,
    pub calls: Span<Call>,
}

pub impl StructHashOutsideExecution of StructHash<OutsideExecution> {
    fn hash_struct(self: @OutsideExecution) -> felt252 {
        let mut hashed_calls: Array<felt252> = array![];
        for call in *self.calls {
            hashed_calls.append(call.hash_struct());
        };
        PoseidonTrait::new()
            .update_with(OUTSIDE_EXECUTION_TYPE_HASH)
            .update_with(*self.caller)
            .update_with(*self.nonce)
            .update_with(*self.execute_after)
            .update_with(*self.execute_before)
            .update_with(poseidon_hash_span(hashed_calls.span()))
            .finalize()
    }
}

