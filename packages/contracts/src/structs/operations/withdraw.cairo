use starknet::ContractAddress;
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

/// Represents the calldata of a withdraw operation.
///
/// - from: The Tongo account to withdraw from.
/// - amount: The ammount of tongo to withdraw.
/// - to: The starknet contract address to send the funds to.
/// - hint: AE encription of the final balance of the account.
/// - proof: ZK proof for the withdraw operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx.
#[derive(Drop, Serde)]
pub struct Withdraw {
    pub from: PubKey,
    pub to: ContractAddress,
    pub amount: felt252,
    pub hint: AEBalance,
    pub proof: ProofOfWithdraw,
    pub auditPart: Option<Audit>,
}


/// Public inputs of the verifier for the withdarw operation.
///
/// - y: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - to: The starknet contract address to send the funds to.
/// - amount: The ammount of tongo to withdraw.
/// - currentBalance: The current CipherBalance stored for the account.
#[derive(Serde, Drop, Copy)]
pub struct InputsWithdraw {
    pub y: PubKey,
    pub nonce: u64,
    pub to: ContractAddress,
    pub amount: felt252,
    pub currentBalance: CipherBalance,
}

/// Proof of withdraw operation.
#[derive(Serde, Drop, Copy)]
pub struct ProofOfWithdraw {
    pub A_x: StarkPoint,
    pub A_r: StarkPoint,
    pub A: StarkPoint,
    pub A_v: StarkPoint,
    pub sx: felt252,
    pub sb: felt252,
    pub sr: felt252,
    pub R_aux: StarkPoint,
    pub range: Span<ProofOfBit>,
}

/// Computes the prefix by hashing some public inputs.
impl WithdrawPrefix of Prefix<InputsWithdraw> {
    /// There is no need to compute the hash of all elements.
    /// TODO: check this, read git issue
    fn prefix(self: @InputsWithdraw) -> felt252 {
        let mut arr = array!['withdraw'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}

/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeWithdraw of Challenge<ProofOfWithdraw> {
    fn compute_challenge(self: @ProofOfWithdraw, prefix: felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A_x);
       arr.append_coordinates(self.A_r);
       arr.append_coordinates(self.A);
       arr.append_coordinates(self.A_v);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}

