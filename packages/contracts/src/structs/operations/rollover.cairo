use core::poseidon::poseidon_hash_span;
use she::utils::reduce_modulo_order;
use crate::structs::{
    common::{
        pubkey::PubKey,
        starkpoint::StarkPoint,
    },
    traits::{
        GeneralPrefixData,
        Prefix,
        Challenge,
        AppendPoint,
    },
    aecipher::AEBalance,
};

/// Represents the calldata of a fund operation.
///
/// - to: The Tongo account to rollover.
/// - hint: AE encription of the final balance (tentative in this case) of the account.
/// - proof: ZK proof for the rollover operation.
#[derive(Drop, Destruct, Serde, Copy)]
pub struct Rollover {
    pub to: PubKey,
    pub hint: AEBalance,
    pub proof: ProofOfRollOver,
}

/// Public inputs of the verifier for the rollover operation.
///
/// - y: The Tongo account to fund.
/// - nonce: The nonce of the Tongo account (from).
#[derive(Serde, Drop, Copy)]
pub struct InputsRollOver {
    pub y: PubKey,
    pub nonce: u64,
    pub prefix_data: GeneralPrefixData,
}

/// Computes the prefix by hashing some public inputs.
impl RollOverPrefix of Prefix<InputsRollOver> {
    fn compute_prefix(self: @InputsRollOver) -> felt252 {
        let rollover_selector = 'rollover';
        let GeneralPrefixData {chain_id, tongo_address} = self.prefix_data;
        let array: Array<felt252> = array![
            *chain_id,
            (*tongo_address).into(),
            rollover_selector,
            *self.y.x,
            *self.y.y,
            (*self.nonce).into(),
        ];
        poseidon_hash_span(array.span())
    }
}


/// Proof of rollover operation.
#[derive(Serde, Drop, Copy)]
pub struct ProofOfRollOver {
    pub Ax: StarkPoint,
    pub sx: felt252,
}

/// Computes the challenge to be ussed in the Non-Interactive protocol.
impl ChallengeRollOver of Challenge<ProofOfRollOver> {
    fn compute_challenge(self: @ProofOfRollOver, prefix: felt252) -> felt252 {
        let mut arr: Array<felt252> = array![prefix];
        arr.append_coordinates(self.Ax);
        reduce_modulo_order(poseidon_hash_span(arr.span()))
    }
}

