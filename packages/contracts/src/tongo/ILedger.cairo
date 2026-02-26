use starknet::ContractAddress;
use crate::structs::common::cipherbalance::CipherBalance;
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::state::State;
use crate::structs::aecipher::AEBalance;

#[starknet::interface]
pub trait ILedger<TContractState> {
    /// Returns the contract address of the owner of the Tongo account.
    fn get_owner(self: @TContractState) -> ContractAddress;

    /// Returns the curretn stored balance of a Tongo account
    fn get_balance(self: @TContractState, y: PubKey) -> CipherBalance;

    /// Returns the current pending balance of a Tongo account
    fn get_pending(self: @TContractState, y: PubKey) -> CipherBalance;

    /// Return, if the Tongo instance allows, the current declared balance of a Tongo account for
    /// the auditor
    fn get_audit(self: @TContractState, y: PubKey) -> Option<CipherBalance>;

    /// Returns the current nonce of a Tongo account
    fn get_nonce(self: @TContractState, y: PubKey) -> u64;

    /// Returns the current state of a Tongo account.
    fn get_state(self: @TContractState, y: PubKey) -> State;

    fn get_global_tongo(self: @TContractState) -> ContractAddress;

    // Auditor handling
    /// Returns the current auditor public key.
    fn get_auditor_key(self: @TContractState) -> Option<PubKey>;

    /// Rotates the current auditor public key.
    fn change_auditor_key(ref self: TContractState, new_auditor_key: PubKey);

    fn add_to_account_balance(ref self: TContractState, to: PubKey, new_balance: CipherBalance);
    fn subtract_from_account_balance(ref self: TContractState, to: PubKey, new_balance: CipherBalance);

    fn overwrite_hint(ref self: TContractState,to: PubKey, hint: AEBalance);

    fn increase_nonce(ref self: TContractState, to: PubKey);

    fn set_audit(ref self: TContractState, y: PubKey, new_audit: CipherBalance);

    fn overwrite_audit_hint(ref self: TContractState, y: PubKey, hint: AEBalance);

    fn add_to_account_pending(ref self: TContractState, to: PubKey, new_balance: CipherBalance);

    fn reset_account_balance(ref self: TContractState, to: PubKey);

    fn pending_to_balance(ref self: TContractState, to: PubKey);
}
