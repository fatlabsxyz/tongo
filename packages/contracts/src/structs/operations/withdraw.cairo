use core::poseidon::poseidon_hash_span;
use she::utils::reduce_modulo_order;
use starknet::ContractAddress;
use crate::structs::aecipher::AEBalance;
use crate::structs::common::cipherbalance::CipherBalance;
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::starkpoint::StarkPoint;
use crate::structs::operations::audit::Audit;
use crate::structs::traits::{AppendPoint, Challenge, GeneralPrefixData, Prefix};
use crate::verifier::range::Range;

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
    pub amount: u128,
    pub hint: AEBalance,
    pub auxiliarCipher: CipherBalance,
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
    pub amount: u128,
    pub currentBalance: CipherBalance,
    pub auxiliarCipher: CipherBalance,
    pub bit_size: u32,
    pub prefix_data: GeneralPrefixData,
}

/// Computes the prefix by hashing some public inputs.
impl WithdrawPrefix of Prefix<InputsWithdraw> {
    fn compute_prefix(self: @InputsWithdraw) -> felt252 {
        let withdraw_selector = 'withdraw';
        let GeneralPrefixData { chain_id, tongo_address, sender_address } = self.prefix_data;
        let CipherBalance {L,R} = *self.currentBalance;
        let CipherBalance {L:V,R:R_aux} = *self.auxiliarCipher;
        let array: Array<felt252> = array![
            *chain_id,
            (*tongo_address).into(),
            (*sender_address).into(),
            withdraw_selector,
            *self.y.x,
            *self.y.y,
            (*self.nonce).into(),
            (*self.amount).into(),
            (*self.to).into(),
            L.x,
            L.y,
            R.x,
            R.y,
            V.x,
            V.y,
            R_aux.x,
            R_aux.y
        ];
        poseidon_hash_span(array.span())
    }
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
    pub range: Range,
}

/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeWithdraw of Challenge<ProofOfWithdraw> {
    fn compute_challenge(self: @ProofOfWithdraw, prefix: felt252) -> felt252 {
        let mut arr = array![prefix];
        arr.append_coordinates(self.A_x);
        arr.append_coordinates(self.A_r);
        arr.append_coordinates(self.A);
        arr.append_coordinates(self.A_v);
        reduce_modulo_order(poseidon_hash_span(arr.span()))
    }
}

