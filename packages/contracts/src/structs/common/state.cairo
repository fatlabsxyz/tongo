use starknet::{ContractAddress, ClassHash};
use crate::structs::aecipher::AEBalance;
use crate::structs::common::cipherbalance::CipherBalance;

/// Represent the full state of an account.
///
/// - balance: The encripted balance of the account.
/// - pending: The pending balance of the account.
/// - nonce: The nonce of the amount.
/// - audit: The last declared balance of the account for the auditor key.
/// - ae_balance: A hint that is use for fast decription of the balance.
/// - ae_audit_balance: A hit given to the auditor for fast decription of the audit_balance.
#[derive(Serde, Drop, Copy)]
pub struct State {
    pub balance: CipherBalance,
    pub pending: CipherBalance,
    pub nonce: u64,
    pub audit: Option<CipherBalance>,
    pub ae_balance: Option<AEBalance>,
    pub ae_audit_balance: Option<AEBalance>,
}

/// Represent the setup of the Vaul
///
/// - vault_address: The contract address of the Vault.
/// - tongo_class_hash: The class hash of the Tongo this contract will work with.
/// - ERC20: The contract address of the ERC20 that Tongo will wrap.
/// - rate: The rate of conversion between the wrapped ERC20 and Tongo
/// - bit_size: The bit size Tongo will work it.
#[derive(Serde, Drop, starknet::Store)]
pub struct GlobalSetup {
    pub vault_address: ContractAddress,
    pub tongo_class_hash: ClassHash,
    pub ERC20: ContractAddress,
    pub rate: u256,
    pub bit_size: u32,
}
