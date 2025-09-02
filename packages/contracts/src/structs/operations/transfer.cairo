use core::poseidon::poseidon_hash_span;
use crate::verifier::utils::{cast_in_order};
use crate::structs::{
    common::{
        cipherbalance::CipherBalance,
        pubkey::PubKey,
        starkpoint::StarkPoint,
    },
    traits::{
        Prefix,
        Challenge,
        AppendPoint,
    },
    operations::audit::Audit,
    aecipher::AEBalance,
};

use crate::structs::proofbit::ProofOfBit;

/// Represents the calldata of a transfer operation.
///
/// - from: The Tongo account to take tongos from.
/// - to: The Tongo account to send tongos to.
/// - transferBalance: The amount to transfer encrypted for the pubkey of `to`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `from`.
/// - hint: AE encription of the final balance of the account.
/// - proof: ZK proof for the transfer operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx.
/// - auditPartTransfer: Optional Audit to declare the transfer amount.
#[derive(Drop, Serde)]
pub struct Transfer {
    pub from: PubKey,
    pub to: PubKey,
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
    pub hint: AEBalance,
    pub proof: ProofOfTransfer,
    pub auditPart: Option<Audit>,
    pub auditPartTransfer: Option<Audit>,
}


/// Public inputs of the verifier for the transfer operation.
///
/// - y: The Tongo account to take tongos from.
/// - y_bar: The Tongo account to send tongos to.
/// - nonce: The nonce of the Tongo account (y).
/// - currentBalance: The current CipherBalance stored for the account (y)
/// - transferBalance: The amount to transfer encrypted for the pubkey of `y_bar`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `y`.
/// TODO: Change y/y_bar for from/to
#[derive(Serde, Drop, Copy)]
pub struct InputsTransfer {
    pub y: PubKey,
    pub y_bar: PubKey,
    pub nonce: u64,
    pub currentBalance: CipherBalance,
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
}

/// Proof of withdraw operation.
#[derive(Serde, Drop, Copy)]
pub struct ProofOfTransfer {
    pub A_x: StarkPoint,
    pub A_r: StarkPoint,
    pub A_r2: StarkPoint,
    pub A_b: StarkPoint,
    pub A_b2: StarkPoint,
    pub A_v: StarkPoint,
    pub A_v2: StarkPoint,
    pub A_bar: StarkPoint,
    pub s_x: felt252,
    pub s_r: felt252,
    pub s_b: felt252,
    pub s_b2: felt252,
    pub s_r2: felt252,
    pub R_aux: StarkPoint,
    pub range: Span<ProofOfBit>,
    pub R_aux2: StarkPoint,
    pub range2: Span<ProofOfBit>,
}

/// Computes the prefix by hashing some public inputs.
impl TransferPrefix of Prefix<InputsTransfer> {
    /// There is no need to compute the hash of all elements.
    /// TODO: check this, read git issue
    fn prefix(self: @InputsTransfer) -> felt252 {
        let mut arr = array!['transfer'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}

/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeTransfer of Challenge<ProofOfTransfer> {
    fn compute_challenge(self: @ProofOfTransfer, prefix: felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A_x);
       arr.append_coordinates(self.A_r);
       arr.append_coordinates(self.A_r2);
       arr.append_coordinates(self.A_b);
       arr.append_coordinates(self.A_b2);
       arr.append_coordinates(self.A_v);
       arr.append_coordinates(self.A_v2);
       arr.append_coordinates(self.A_bar);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}
