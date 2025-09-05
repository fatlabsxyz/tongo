use starknet::ContractAddress;
use crate::structs::common::{
    pubkey::PubKey,
    cipherbalance::CipherBalance,
    state::State,
};

use crate::structs::operations::{
    fund::Fund,
    withdraw::Withdraw,
    transfer::Transfer,
    ragequit::Ragequit,
    rollover::Rollover,
};
    
#[starknet::interface]
pub trait ITongo<TContractState> {
    // Tongo general setup:
    /// Returns the contract address that Tongo is wraping.
    fn ERC20(self: @TContractState) -> ContractAddress;

    /// Returns the rate of conversion between the wrapped ERC20 a tongo:
    ///
    /// ERC20_amount = Tongo_amount*rate
    ///
    /// The amount variable in all operation refers to the amount of Tongos.
    fn get_rate(self:@TContractState) -> u256;

    /// Returns the bit_size set for this Tongo contract.
    fn get_bit_size(self: @TContractState) -> u32;

    /// Returns the contract address of the owner of the Tongo account.
    fn get_owner(self:@TContractState) -> ContractAddress;

    // User operations:
    /// Funds a tongo account. Callable only by the account owner
    ///
    /// Emits FundEvent
    fn fund(ref self: TContractState, fund: Fund);

    /// Withdraw Tongos and send the ERC20 to a starknet address.
    ///
    /// Emits WithdrawEvent
    fn withdraw(ref self: TContractState, withdraw: Withdraw);

    /// Withdraw all the balance of an account and send the ERC20 to a starknet address. This proof avoids
    /// the limitations of the range prove that are present in the regular withdraw.
    ///
    /// Emits RagequitEvent
    fn ragequit(ref self: TContractState, ragequit: Ragequit);

    /// Transfer Tongos from the balanca of te sender to the pending of the receiver
    ///
    /// Emits TransferEvent
    fn transfer(ref self: TContractState, transfer: Transfer);

    /// Moves to the balance the amount stored in the pending. Callable only by the account owner.
    ///
    /// Emits RolloverEvent
    fn rollover(ref self: TContractState, rollover: Rollover);

    // State reading functions
    /// Returns the curretn stored balance of a Tongo account
    fn get_balance(self: @TContractState, y: PubKey) -> CipherBalance;

    /// Returns the current pending balance of a Tongo account
    fn get_pending(self: @TContractState, y: PubKey) -> CipherBalance;

    /// Return, if the Tongo instance allows, the current declared balance of a Tongo account for the auditor
    fn get_audit(self: @TContractState, y: PubKey) -> Option<CipherBalance>;

    /// Returns the current nonce of a Tongo account
    fn get_nonce(self: @TContractState, y: PubKey) -> u64;

    /// Returns the current state of a Tongo account.
    fn get_state(self: @TContractState, y: PubKey) -> State;

    // Auditor handling
    /// Returns the current auditor public key.
    fn auditor_key(self: @TContractState) -> Option<PubKey>;

    /// Rotates the current auditor public key.
    fn change_auditor_key(ref self: TContractState, new_auditor_key:PubKey);
}
