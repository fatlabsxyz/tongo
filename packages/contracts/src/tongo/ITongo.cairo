
use starknet::ContractAddress;
use crate::structs::operations::{
    fund::Fund,
    withdraw::Withdraw,
    transfer::Transfer,
    ragequit::Ragequit,
    rollover::Rollover,
};
    
use crate::structs::{
    aecipher::AEBalance,
    common::{
        pubkey::PubKey,
        cipherbalance::CipherBalance,
    },
};

#[derive(Serde, Drop, Copy)]
pub struct State {
    pub balance: CipherBalance,
    pub pending: CipherBalance,
    pub audit: CipherBalance,
    pub nonce: u64,
    pub ae_balance: Option<AEBalance>,
    pub ae_audit_balance: Option<AEBalance>,
}

#[starknet::interface]
pub trait ITongo<TContractState> {
    fn fund(ref self: TContractState, fund: Fund);
    fn rollover(ref self: TContractState, rollover: Rollover);
    fn ragequit(ref self: TContractState, ragequit: Ragequit);
    fn withdraw(ref self: TContractState, withdraw: Withdraw);
    fn transfer(ref self: TContractState, transfer: Transfer);
    fn get_balance(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_audit(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_pending(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_nonce(self: @TContractState, y: PubKey) -> u64;
    fn ERC20(self: @TContractState) -> ContractAddress;
    fn get_state(self: @TContractState, y: PubKey) -> State;
    fn change_auditor_key(ref self: TContractState, new_auditor_key:PubKey);
    fn auditor_key(self: @TContractState) -> PubKey;
    fn get_rate(self:@TContractState) -> u256;
}
