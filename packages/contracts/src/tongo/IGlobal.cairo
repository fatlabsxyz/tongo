use starknet::ContractAddress;
use crate::structs::common::pubkey::PubKey;
use crate::structs::operations::fund::{Fund, OutsideFund};
use crate::structs::operations::ragequit::Ragequit;
use crate::structs::operations::rollover::Rollover;
use crate::structs::operations::transfer::Transfer;
use crate::structs::operations::withdraw::Withdraw;

#[starknet::interface]
pub trait IGlobal<TContractState> {
    // Tongo general setup:
    /// Returns the contract address that Tongo is wraping.
    fn ERC20(self: @TContractState) -> ContractAddress;

    /// Returns the rate of conversion between the wrapped ERC20 a tongo:
    ///
    /// ERC20_amount = Tongo_amount*rate
    ///
    /// The amount variable in all operation refers to the amount of Tongos.
    fn get_rate(self: @TContractState) -> u256;

    /// Returns the bit_size set for this Tongo contract.
    fn get_bit_size(self: @TContractState) -> u32;

    fn is_known_ledger(self: @TContractState, ledger: ContractAddress) -> bool;

    fn deploy_ledger(ref self: TContractState, owner: ContractAddress, auditorKey: Option<PubKey>, salt: felt252) -> ContractAddress;

    // User operations:
    /// Funds a tongo account. Callable only by the account owner
    ///
    /// Emits FundEvent
    fn fund(ref self: TContractState, fund: Fund);

    /// Funds a tongo acount. Can be called without knowledge of the pk.
    ///
    /// Emits OutsideFundEvent
    fn outside_fund(ref self: TContractState, outsideFund: OutsideFund);

    /// Withdraw Tongos and send the ERC20 to a starknet address.
    ///
    /// Emits WithdrawEvent
    fn withdraw(ref self: TContractState, withdraw: Withdraw);

    /// Withdraw all the balance of an account and send the ERC20 to a starknet address. This proof
    /// avoids the limitations of the range prove that are present in the regular withdraw.
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
}
