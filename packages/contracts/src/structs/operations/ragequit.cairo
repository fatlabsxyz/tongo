use core::poseidon::poseidon_hash_span;
use she::utils::reduce_modulo_order;
use starknet::ContractAddress;
use crate::structs::aecipher::AEBalance;
use crate::structs::common::cipherbalance::CipherBalance;
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::starkpoint::StarkPoint;
use crate::structs::operations::audit::Audit;
use crate::structs::traits::{AppendPoint, Challenge, GeneralPrefixData, Prefix};

/// Represents the calldata of a ragequit operation.
///
/// - from: The Tongo account to withdraw from.
/// - amount: The ammount of tongo to ragequit (the total amount of tongos in the account).
/// - to: The starknet contract address to send the funds to.
/// - hint: AE encription of the final balance of the account.
/// - proof: ZK proof for the ragequit operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx. (In theory it is
/// not necesary
///   for this operation, but it helps to keep things consistent and clean for a minimal cost)
#[derive(Drop, Serde)]
pub struct Ragequit {
    pub from: PubKey,
    pub to: ContractAddress,
    pub amount: felt252,
    pub hint: AEBalance,
    pub proof: ProofOfRagequit,
    pub auditPart: Option<Audit>,
}


/// Public inputs of the verifier for the ragequit operation.
///
/// - y: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - to: The starknet contract address to send the funds to.
/// - amount: The ammount of tongo to ragequit (the total amount of tongos in the account).
/// - currentBalance: The current CipherBalance stored for the account.
#[derive(Serde, Drop, Copy)]
pub struct InputsRagequit {
    pub y: PubKey,
    pub nonce: u64,
    pub to: ContractAddress,
    pub amount: felt252,
    pub currentBalance: CipherBalance,
    pub prefix_data: GeneralPrefixData,
}

/// Computes the prefix by hashing some public inputs.
impl RagequitPrefix of Prefix<InputsRagequit> {
    fn compute_prefix(self: @InputsRagequit) -> felt252 {
        let ragequit_selector = 'ragequit';
        let GeneralPrefixData { chain_id, tongo_address } = self.prefix_data;
        let array: Array<felt252> = array![
            *chain_id,
            (*tongo_address).into(),
            ragequit_selector,
            *self.y.x,
            *self.y.y,
            (*self.nonce).into(),
            *self.amount,
            (*self.to).into(),
        ];
        poseidon_hash_span(array.span())
    }
}

/// Proof of ragequit operation.
#[derive(Serde, Drop, Copy)]
pub struct ProofOfRagequit {
    pub Ax: StarkPoint,
    pub AR: StarkPoint,
    pub sx: felt252,
}


/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeRagequit of Challenge<ProofOfRagequit> {
    fn compute_challenge(self: @ProofOfRagequit, prefix: felt252) -> felt252 {
        let mut arr = array![prefix];
        arr.append_coordinates(self.Ax);
        arr.append_coordinates(self.AR);
        reduce_modulo_order(poseidon_hash_span(arr.span()))
    }
}
