use core::poseidon::poseidon_hash_span;
use starknet::ContractAddress;
use she::utils::reduce_modulo_order;
use crate::structs::aecipher::AEBalance;
use crate::structs::common::cipherbalance::CipherBalance;
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::relayer::RelayData;
use crate::structs::common::starkpoint::StarkPoint;
use crate::structs::operations::audit::Audit;
use crate::structs::traits::{AppendPoint, Challenge, GeneralPrefixData, Prefix};
use crate::verifier::range::Range;

/// Represents the calldata of a transfer operation.
///
/// - from: The Tongo account to take tongos from.
/// - to: The Tongo account to send tongos to.
/// - transferBalance: The amount to transfer encrypted for the pubkey of `to`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `from`.
/// - hintTransfer: AE encryption of the amount to transfer to `to`.
/// - hintLeftover: AE encryption of the leftover balance of `from`.
/// - proof: ZK proof for the transfer operation.
/// - relayData: relayer related data.
/// - auditPart: Optional Audit to declare the balance of the account after the tx.
/// - auditPartTransfer: Optional Audit to declare the transfer amount.
#[derive(Drop, Serde)]
pub struct Transfer {
    pub from: PubKey,
    pub to: PubKey,
    pub ledger: ContractAddress,
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
    pub hintTransfer: AEBalance,
    pub hintLeftover: AEBalance,
    pub auxiliarCipher: CipherBalance,
    pub auxiliarCipher2: CipherBalance,
    pub proof: ProofOfTransfer,
    pub relayData: RelayData,
    pub auditPart: Option<Audit>,
    pub auditPartTransfer: Option<Audit>,
}


/// Public inputs of the verifier for the transfer operation.
///
/// - from: The Tongo account to take tongos from.
/// - to: The Tongo account to send tongos to.
/// - nonce: The nonce of the Tongo account (y).
/// - currentBalance: The current CipherBalance stored for the account (from)
/// - transferBalance: The amount to transfer encrypted for the pubkey of `to`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `from`.
#[derive(Serde, Drop, Copy)]
pub struct InputsTransfer {
    pub from: PubKey,
    pub to: PubKey,
    pub nonce: u64,
    pub currentBalance: CipherBalance,
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
    pub auxiliarCipher: CipherBalance,
    pub auxiliarCipher2: CipherBalance,
    pub bit_size: u32,
    pub prefix_data: GeneralPrefixData,
    pub relayData: RelayData,
}

/// Computes the prefix by hashing some public inputs.
impl TransferPrefix of Prefix<InputsTransfer> {
    fn compute_prefix(self: @InputsTransfer) -> felt252 {
        let transfer_selector = 'transfer';
        let GeneralPrefixData { chain_id, tongo_address, sender_address } = self.prefix_data;

        let fee_to_sender = *self.relayData.fee_to_sender;

        let CipherBalance { L: L0, R: R0 } = *self.currentBalance;
        let CipherBalance { L, R } = *self.transferBalanceSelf;
        let CipherBalance { L: L_bar, R: R_bar } = *self.transferBalance;
        let CipherBalance { L: V, R: R_aux } = *self.auxiliarCipher;
        let CipherBalance { L: V2, R: R_aux2 } = *self.auxiliarCipher2;

        let array: Array<felt252> = array![
            *chain_id,
            (*tongo_address).into(),
            (*sender_address).into(),
            fee_to_sender.into(),
            transfer_selector,
            *self.from.x,
            *self.from.y,
            *self.to.x,
            *self.to.y,
            (*self.nonce).into(),
            L0.x,
            L0.y,
            R0.x,
            R0.y,
            L.x,
            L.y,
            R.x,
            R.y,
            L_bar.x,
            L_bar.y,
            R_bar.x,
            R_bar.y,
            V.x,
            V.y,
            R_aux.x,
            R_aux.y,
            V2.x,
            V2.y,
            R_aux2.x,
            R_aux2.y,
        ];
        poseidon_hash_span(array.span())
    }
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
    pub range: Range,
    pub range2: Range,
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
        reduce_modulo_order(poseidon_hash_span(arr.span()))
    }
}
