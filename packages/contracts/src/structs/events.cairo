use starknet::ContractAddress;
use crate::structs::common::{
    cipherbalance::CipherBalance,
    pubkey::PubKey,
};


#[derive(Drop, starknet::Event)]
pub struct FundEvent {
    #[key]
    pub to: PubKey,
    #[key]
    pub nonce: u64,
    pub amount: u64,
    pub auditorPubKey: PubKey,
    pub auditedBalanceLeft: CipherBalance,
}

#[derive(Drop, starknet::Event)]
pub struct RolloverEvent {
    #[key]
    pub to: PubKey,
    #[key]
    pub nonce: u64,
}

#[derive(Drop, starknet::Event)]
pub struct WithdrawEvent {
    #[key]
    pub from: PubKey,
    #[key]
    pub nonce: u64,
    pub amount: u64,
    pub to: ContractAddress,
    pub auditorPubKey: PubKey,
    pub auditedBalanceLeft: CipherBalance,
}

#[derive(Drop, starknet::Event)]
pub struct TransferEvent {
    #[key]
    pub to: PubKey,
    #[key]
    pub from: PubKey,
    #[key]
    pub nonce: u64,
    pub auditorPubKey: PubKey,
    pub auditedBalanceLeft: CipherBalance,
    pub auditedBalanceSend: CipherBalance,
}


#[derive(Drop, starknet::Event)]
pub struct RagequitEvent {
    #[key]
    pub from: PubKey,
    #[key]
    pub nonce: u64,
    pub amount: u64,
    pub to: ContractAddress,
}
