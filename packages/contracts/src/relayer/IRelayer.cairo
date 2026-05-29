use starknet::ContractAddress;
use starknet::account::Call;
use crate::relayer::structs::{OutsideExecution, TargetConfig};

pub const ISRC5_ID: felt252 = 0x3f918d17e5ee77373b56385708f855659a07f75997f365cf87748628532a055;
#[starknet::interface]
pub trait ISRC5<TContractState> {
    fn supports_interface(self: @TContractState, interface_id: felt252) -> bool;
}

pub const ISRC9_V2_ID: felt252 = 0x1d1144bb2138366ff28d8e9ab57456b1d332ac42196230c3a602003c89872;
#[starknet::interface]
pub trait ISRC9_V2<TContractState> {
    fn execute_from_outside_v2(ref self: TContractState, outside_execution: OutsideExecution, signature: Span<felt252>) -> Array<Span<felt252>>;
    fn is_valid_outside_execution_nonce(self: @TContractState, nonce: felt252) -> bool;
}

#[starknet::interface]
pub trait IExecute<TContractState> {
    fn __execute__(self: @TContractState, calls: Array<Call>);
}

#[starknet::interface]
pub trait IRelayer<TContractState> {
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn is_target_whitelisted(self: @TContractState, target: ContractAddress) -> bool;
    fn is_asset_whitelisted(self: @TContractState, asset: ContractAddress) -> bool;
    fn is_forwarder_whitelisted(self: @TContractState, forwarder: ContractAddress) -> bool;
    fn get_target_config(self: @TContractState, target: ContractAddress) -> TargetConfig;
    fn get_tongo_selectors(self: @TContractState) -> Span<felt252>;
    fn get_asset_selectors(self: @TContractState) -> Span<felt252>;

    fn whitelist_asset(ref self: TContractState, asset: ContractAddress);
    fn whitelist_target(ref self: TContractState, target: ContractAddress);
    fn whitelist_forwarder(ref self: TContractState, forwarder: ContractAddress);
    fn delist_forwarder(ref self: TContractState, forwarder: ContractAddress);
    fn set_tongo_selectors(ref self: TContractState, selectors: Span<felt252>);
    fn set_asset_selectors(ref self: TContractState, selectors: Span<felt252>);
    fn set_relayer_fee(ref self: TContractState, target: ContractAddress, fee: u256);
    fn pull(ref self: TContractState, asset: ContractAddress);
}
