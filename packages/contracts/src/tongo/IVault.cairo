use starknet::ContractAddress;
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::state::GlobalSetup;

#[starknet::interface]
pub trait IVault<TContractState> {
    fn get_vault_setup(self: @TContractState) -> GlobalSetup;

    fn ERC20(self: @TContractState) -> ContractAddress;

    fn get_rate(self: @TContractState) -> u256;

    fn get_bit_size(self: @TContractState) -> u32;

    fn is_known_tongo(self: @TContractState, address: ContractAddress) -> bool;
    fn tag_to_address(self: @TContractState, tag: felt252) -> ContractAddress;

    fn deploy_tongo(ref self: TContractState, owner: ContractAddress, tag: felt252, auditorKey: Option<PubKey>) -> ContractAddress;

    fn deposit(ref self: TContractState, amount: u256);

    fn withdraw(ref self: TContractState, amount: u256);
}
