use starknet::{ContractAddress, ClassHash};
use crate::structs::common::{
    pubkey::PubKey,
    state::GlobalSetup,
};

#[starknet::interface]
pub trait IVault<TContractState> {
    /// Returns the global setup of the Vaul.
    fn get_vault_setup(self: @TContractState) -> GlobalSetup;

    /// Returns the class hash of the Tongo this contract will work with.
    fn get_tongo_class_hash(self: @TContractState) -> ClassHash;

    /// Returns the contract address of the ERC20 that Tongo will wrap.
    fn ERC20(self: @TContractState) -> ContractAddress;

    /// Returns the rate of conversion between the wrapped ERC20 and Tongo:
    ///
    /// ERC20_amount = Tongo_amount*rate
    ///
    /// The amount variable in all operation refers to the amount of Tongos.
    fn get_rate(self: @TContractState) -> u256;

    /// Returns the bit_size Tongo will work it.
    fn get_bit_size(self: @TContractState) -> u32;

    /// Returns true if the contract address is a Tongo contract deployed by this Vault.
    /// The Vault will only work with these contracts.
    fn is_known_tongo(self: @TContractState, address: ContractAddress) -> bool;

    /// Returns the address of a given tag if a Tongo contract was deployed with that particular tag.
    fn tag_to_address(self: @TContractState, tag: felt252) -> ContractAddress;

    /// Deploys a Tongo instance for the given owner and tag with the given auditor.
    ///
    /// Emits TongoDeployed event.
    fn deploy_tongo(ref self: TContractState, owner: ContractAddress, tag: felt252, auditorKey: Option<PubKey>) -> ContractAddress;

    /// Pulls ERC20 from the caller. The caller can only be a Tongo instance deployed by this Vault.
    fn deposit(ref self: TContractState, amount: u256);

    /// Sends ERC20 to the caller. The caller can only be a Tongo instance deployed by this Vault.
    fn withdraw(ref self: TContractState, amount: u256);
}
