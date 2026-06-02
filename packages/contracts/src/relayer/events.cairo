use starknet::ContractAddress;
use crate::structs::common::pubkey::PubKey;

#[derive(Drop, starknet::Event)]
pub struct RelayExecuted {
    #[key]
    pub forwarder: ContractAddress,
    #[key]
    pub target: ContractAddress,
    pub pubkey: PubKey,
    pub nonce: felt252,
    pub fee_tongo: u256,
    pub fee_erc20: u256,
}

#[derive(Drop, starknet::Event)]
pub struct AssetWhitelisted {
    #[key]
    pub asset: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct TargetWhitelisted {
    #[key]
    pub target: ContractAddress,
    pub erc20: ContractAddress,
    pub rate: u256,
}

#[derive(Drop, starknet::Event)]
pub struct ForwarderWhitelisted {
    #[key]
    pub forwarder: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct ForwarderDelisted {
    #[key]
    pub forwarder: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct AssetDelisted {
    #[key]
    pub asset: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct TargetDelisted {
    #[key]
    pub target: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct RelayerFeeSet {
    #[key]
    pub target: ContractAddress,
    pub fee: u256,
}

#[derive(Drop, starknet::Event)]
pub struct Pull {
    #[key]
    pub asset: ContractAddress,
    pub amount: u256,
}
