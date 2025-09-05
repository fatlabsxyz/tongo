use crate::structs::{
    aecipher::AEBalance,
    common::{cipherbalance::CipherBalance,},
};

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
