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

/// Represents the calldata of a fund operation.
///
/// - to: The Tongo account to fund.
/// - amount: The ammount of tongo to fund.
/// - hint: AE encription of the final balance of the account.
/// - proof: ZK proof for the fund operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx.
#[derive(Drop, Serde)]
pub struct Fund {
    pub to: PubKey,
    pub amount: felt252,
    pub hint: AEBalance,
    pub proof: ProofOfFund,
    pub auditPart: Option<Audit>,
}

/// Public inputs of the verifier for the fund operation.
///
/// - y: The Tongo account to fund.
/// - amount: The ammount of tongo to fund.
/// - nonce: The nonce of the Tongo account (from).
/// - currentBalance: The current CipherBalance stored for the account. TODO: This is not needed anymore
#[derive(Serde, Drop, Copy, Debug)]
pub struct InputsFund {
    pub y: PubKey,
    pub amount: felt252,
    pub nonce: u64,
    pub currentBalance: CipherBalance,
}

/// Proof of fund operation.
#[derive(Serde, Drop, Copy)]
pub struct ProofOfFund {
    pub Ax: StarkPoint,
    pub sx: felt252,
}

/// Computes the prefix by hashing some public inputs.
impl FundPrefix of Prefix<InputsFund> {
    /// There is no need to compute the hash of all elements.
    /// TODO: check this, read git issue
    fn prefix(self: @InputsFund) -> felt252 {
        let mut arr = array!['fund'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}

/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeFund of Challenge<ProofOfFund> {
    fn compute_challenge(self: @ProofOfFund, prefix: felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.Ax);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}

