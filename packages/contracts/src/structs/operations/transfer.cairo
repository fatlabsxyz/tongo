use core::poseidon::poseidon_hash_span;
use she::utils::reduce_modulo_order;
use starknet::ContractAddress;
use crate::structs::aecipher::AEBalance;
use crate::structs::common::cipherbalance::CipherBalance;
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::relayer::{RelayData, SerializeRelayData};
use crate::structs::common::starkpoint::StarkPoint;
use crate::structs::operations::audit::Audit;
use crate::structs::traits::{AppendPoint, Challenge, GeneralPrefixData, Prefix, SerializedData};
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
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
    pub hintTransfer: AEBalance,
    pub hintLeftover: AEBalance,
    pub auxiliarCipher: CipherBalance,
    pub auxiliarCipher2: CipherBalance,
    pub proof: ProofOfTransfer,
    pub auditPart: Option<Audit>,
    pub auditPartTransfer: Option<Audit>,
}

#[derive(Serde, Drop)]
pub struct TransferOptions {
    pub relayData: Option<RelayData>,
    pub externalData: Option<ExternalData>,
}

pub impl SerializeTransferOptions of SerializedData<Option<TransferOptions>> {
    fn serialize_data(self: @Option<TransferOptions>) -> Span<felt252> {
        match self {
            None => { return array![1].span(); },
            Some(options) => {
                let mut arr: Array<felt252> = array![0];

                let relay = options.relayData.serialize_data();
                for r in relay {
                    arr.append(*r)
                }

                let external = options.externalData.serialize_data();
                for e in external {
                    arr.append(*e)
                }
                return arr.span();
            },
        }
    }
}

#[derive(Drop, Serde)]
pub struct ExternalData {
    pub toTongo: ContractAddress,
    pub auditPart: Option<Audit>,
}

pub impl SerializeExternalData of SerializedData<Option<ExternalData>> {
    fn serialize_data(self: @Option<ExternalData>) -> Span<felt252> {
        match self {
            None => { return array![1].span(); },
            Some(external) => {
                let mut arr: Array<felt252> = array![0];
                arr.append((*external.toTongo).into());
                return arr.span();
            },
        }
    }
}

//TODO: Docs
#[derive(Drop, Serde)]
pub struct ExternalTransfer {
    pub fromTongo: ContractAddress,
    pub from: PubKey,
    pub nonce: u64,
    pub to: PubKey,
    pub transferBalance: CipherBalance,
    pub hintTransfer: AEBalance,
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
    pub data: Span<felt252>,
}

/// Computes the prefix by hashing some public inputs.
impl TransferPrefix of Prefix<InputsTransfer> {
    fn compute_prefix(self: @InputsTransfer) -> felt252 {
        let transfer_selector = 'transfer';
        let mut array: Array<felt252> = array![transfer_selector];
        self.serialize(ref array);
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
