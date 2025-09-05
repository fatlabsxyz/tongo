use core::poseidon::poseidon_hash_span;
use she::utils::reduce_modulo_order;
use crate::structs::{
    common::{
        cipherbalance:: {CipherBalance},
        pubkey::PubKey,
        starkpoint::StarkPoint,
    },
    traits::{
        Challenge,
        AppendPoint,
    },
    aecipher::AEBalance,
};

/// Struct for audit declaration. These are optional in Tongo and only enforces if the 
/// Tongo contract was deployed with an Auditor publick key set.
///
/// - auditedBalance: The encryption of the balance (amount) to declare under the auditor public key.
/// - hint: The same amount encrypted with AE encryption for fast decryption.
/// - proof: The ZK proof that verifies the balance is actually the balance of the acount.
#[derive(Serde, Drop)]
pub struct Audit {
    pub auditedBalance: CipherBalance,
    pub hint: AEBalance,
    pub proof: ProofOfAudit,
}

/// Public inputs of the verifier for the audit declaration
///
/// - y: The Tongo account that is declaring its balance.
/// - auditorPubKey: The current auditor public key.
/// - sotredBalance: The current CipherBalance stored for the account (y).
/// - auditedBalance: The balance of y encrypted under the auditor public key.
#[derive(Serde, Drop)]
pub struct InputsAudit {
    pub y: PubKey, 
    pub auditorPubKey: PubKey,
    pub storedBalance: CipherBalance,
    pub auditedBalance: CipherBalance,
}

/// Proof of audit declaration
#[derive(Serde, Drop)]
pub struct ProofOfAudit {
    pub Ax: StarkPoint,
    pub AL0: StarkPoint,
    pub AL1: StarkPoint,
    pub AR1: StarkPoint,
    pub sx: felt252,
    pub sb: felt252,
    pub sr: felt252,
}

/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeAudit of Challenge<ProofOfAudit> {
    fn compute_challenge(self: @ProofOfAudit, prefix: felt252) -> felt252 {
        let mut arr: Array<felt252> = array![prefix];
        arr.append_coordinates(self.Ax);
        arr.append_coordinates(self.AL0);
        arr.append_coordinates(self.AL1);
        arr.append_coordinates(self.AR1);
        reduce_modulo_order(poseidon_hash_span(arr.span()))
    }
}
