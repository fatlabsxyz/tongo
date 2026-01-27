use starknet::ContractAddress;
use crate::structs::aecipher::AEBalance;
use crate::structs::common::cipherbalance::CipherBalance;
use crate::structs::common::pubkey::PubKey;

/// Event emited in a Fund operation.
///
/// - to: The Tongo account to fund.
/// - nonce: The nonce of the Tongo account.
/// - from: The contract address is funding the account.
/// - amount: The ammount of tongo to fund.
#[derive(Drop, starknet::Event)]
pub struct FundEvent {
    #[key]
    pub to: PubKey,
    #[key]
    pub nonce: u64,
    #[key]
    pub from:  ContractAddress,
    pub amount: u128,
}

/// Event emited in a OutsideFund operation
///
/// - to: The Tongo account to fund.
/// - from: The contract address is funding the account.
/// - amount: The ammount of tongo to fund.
#[derive(Drop, starknet::Event)]
pub struct OutsideFundEvent {
    #[key]
    pub to: PubKey,
    #[key]
    pub from:  ContractAddress,
    pub amount: u128,
}

/// Event emited in a Rollover operation.
///
/// - to: The Tongo account to rollover.
/// - nonce: The nonce of the Tongo account.
/// - rolloverred: The cipherbalance of the rolloverred amount.
#[derive(Drop, starknet::Event)]
pub struct RolloverEvent {
    #[key]
    pub to: PubKey,
    #[key]
    pub nonce: u64,
    pub rollovered: CipherBalance,
}


/// Event emited in a Withdraw operation.
///
/// - from: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - amount: The ammount of tongo to withdraw.
/// - to: The starknet contract address to send the funds to.
#[derive(Drop, starknet::Event)]
pub struct WithdrawEvent {
    #[key]
    pub from: PubKey,
    #[key]
    pub nonce: u64,
    pub amount: u128,
    pub to: ContractAddress,
}


/// Event emited in a Transfer operation.
///
/// - to: The Tongo account to send tongos to.
/// - from: The Tongo account to take tongos from.
/// - nonce: The nonce of the Tongo account (from).
/// - transferBalance: The amount to transfer encrypted for the pubkey of `to`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `from`.
/// - hintTransfer: AE encryption of the amount to transfer to `to`.
/// - hintLeftover: AE encryption of the leftover balance of `from`.
#[derive(Drop, starknet::Event)]
pub struct TransferEvent {
    #[key]
    pub to: PubKey,
    #[key]
    pub from: PubKey,
    #[key]
    pub nonce: u64,
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
    pub hintTransfer: AEBalance,
    pub hintLeftover: AEBalance,
}


/// Event emited in a Ragequit operation.
///
/// - from: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - amount: The ammount of tongo to ragequit (the total amount of tongos in the account).
/// - to: The starknet contract address to send the funds to.
#[derive(Drop, starknet::Event)]
pub struct RagequitEvent {
    #[key]
    pub from: PubKey,
    #[key]
    pub nonce: u64,
    pub amount: u128,
    pub to: ContractAddress,
}

/// Event emited when users declare their balances to the auditor.
///
/// - from: The Tongo account that is declaring its balance.
/// - nonce: The nonce of the Tongo accout.
/// - auditorPubKey: The current public key of the auditor.
/// - declaredCipherBalance: The balance of the user encrypted for the auditor pubkey.
/// - hint: AE encryption of the balance for the auditor fast decryption.
#[derive(Drop, starknet::Event)]
pub struct BalanceDeclared {
    #[key]
    pub from: PubKey,
    #[key]
    pub nonce: u64,
    pub auditorPubKey: PubKey,
    pub declaredCipherBalance: CipherBalance,
    pub hint: AEBalance,
}


/// Event emited when users declare a transfer to the auditor.
///
/// - from: The Tongo account that is executing the transfer.
/// - to: The Tongo account that is receiving the transfer.
/// - nonce: The nonce of the Tongo accout (from).
/// - auditorPubKey: The current public key of the auditor.
/// - declaredCipherBalance: The transfer amount encrypted for the auditor pubkey.
/// - hint: AE encryption of the balance for the auditor fast decryption.
#[derive(Drop, starknet::Event)]
pub struct TransferDeclared {
    #[key]
    pub from: PubKey,
    #[key]
    pub to: PubKey,
    #[key]
    pub nonce: u64,
    pub auditorPubKey: PubKey,
    pub declaredCipherBalance: CipherBalance,
    pub hint: AEBalance,
}

/// Event emited when the owner sets a public key for the auditor.
///
/// - keyNumber: An increasing number that identifies the public key
/// - AuditorPubKey: The newly set auditor public key.
#[derive(Drop, starknet::Event)]
pub struct AuditorPubKeySet {
    #[key]
    pub keyNumber: u128,
    pub AuditorPubKey: PubKey,
}
