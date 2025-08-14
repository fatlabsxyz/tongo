use crate::structs::{
    aecipher::AEBalance,
    common::{
        cipherbalance::CipherBalance,
    },
};

#[derive(Serde, Drop, Copy)]
pub struct State {
    pub balance: CipherBalance,
    pub pending: CipherBalance,
    pub nonce: u64,
    pub audit: Option<CipherBalance>,
    pub ae_balance: Option<AEBalance>,
    pub ae_audit_balance: Option<AEBalance>,
}
