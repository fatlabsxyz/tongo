use core::poseidon::poseidon_hash_span;
use she::utils::reduce_modulo_order;
use crate::structs::aecipher::AEBalance;
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::starkpoint::StarkPoint;
use crate::structs::operations::audit::Audit;
use crate::structs::traits::{AppendPoint, Challenge, GeneralPrefixData, Prefix};

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
    pub amount: u128,
    pub hint: AEBalance,
    pub proof: ProofOfFund,
    pub auditPart: Option<Audit>,

}
/// Public inputs of the verifier for the fund operation.
///
/// - y: The Tongo account to fund.
/// - amount: The ammount of tongo to fund.
/// - nonce: The nonce of the Tongo account (from).
#[derive(Serde, Drop, Copy, Debug)]
pub struct InputsFund {
    pub y: PubKey,
    pub amount: u128,
    pub nonce: u64,
    pub prefix_data: GeneralPrefixData,
}

///// Computes the prefix by hashing some public inputs.
pub impl FundPrefix of Prefix<InputsFund> {
    fn compute_prefix(self: @InputsFund) -> felt252 {
        let fund_selector = 'fund';
        let GeneralPrefixData { chain_id, tongo_address, sender_address } = self.prefix_data;
        let array: Array<felt252> = array![
            *chain_id,
            (*tongo_address).into(),
            (*sender_address).into(),
            fund_selector,
            *self.y.x,
            *self.y.y,
            (*self.amount).into(),
            (*self.nonce).into(),
        ];
        poseidon_hash_span(array.span())
    }
}


/// Proof of fund operation.
#[derive(Serde, Drop, Copy)]
pub struct ProofOfFund {
    pub Ax: StarkPoint,
    pub sx: felt252,
}

/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeFund of Challenge<ProofOfFund> {
    fn compute_challenge(self: @ProofOfFund, prefix: felt252) -> felt252 {
        let mut arr = array![prefix];
        arr.append_coordinates(self.Ax);
        reduce_modulo_order(poseidon_hash_span(arr.span()))
    }
}

