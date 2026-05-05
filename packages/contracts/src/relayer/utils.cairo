use starknet::account::Call;
use starknet::SyscallResultTrait;
use starknet::ContractAddress;
use core::ecdsa::check_ecdsa_signature;
use core::poseidon::PoseidonTrait;
use core::hash::{HashStateExTrait, HashStateTrait};

use crate::structs::common::pubkey::PubKey;
use crate::structs::common::relayer::RelayData;
use crate::relayer::structs::{OutsideExecution, StarknetDomain, StructHash, StructHashStarknetDomain, StructHashOutsideExecution};
use crate::structs::operations::ragequit::{Ragequit, RagequitOptions};
use crate::structs::operations::rollover::Rollover;
use crate::structs::operations::transfer::{Transfer, TransferOptions};
use crate::structs::operations::withdraw::{Withdraw, WithdrawOptions};

/// Executes a single call and returns the return value.
pub fn execute_single_call(call: @Call) -> Span<felt252> {
    let Call { to, selector, calldata } = *call;
    starknet::syscalls::call_contract_syscall(to, selector, calldata).unwrap_syscall()
}

/// Executes a list of calls and returns the return values.
pub fn execute_calls(calls: Span<Call>) -> Array<Span<felt252>> {
    let mut res = array![];
    for call in calls {
        res.append(execute_single_call(call));
    }
    res
}

pub const WITHDRAW_SELECTOR: felt252 = 0x015511cc3694f64379908437d6d64458dc76d02482052bfb8a5b33a72c054c77;
pub const RAGEQUIT_SELECTOR: felt252 = 0x00527537e04b80d3b3bd9dfa43834f03d4b745f8411ca72260a3c7e02ea7fa3f;
pub const TRANSFER_SELECTOR: felt252 = 0x0083afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e;
pub const ROLLOVER_SELECTOR: felt252 = 0x03587511558a364dd791967d1d1190665c476e9588485c30c7473d6618fb8ed1;

const MIN_TRANSACTION_VERSION: u256 = 1;
const QUERY_OFFSET: u256 = 0x100000000000000000000000000000000;
const QUERY_VERSION: u256 = 0x100000000000000000000000000000001;
pub fn is_tx_version_valid() -> bool {
    let tx_info = starknet::get_tx_info().unbox();
    let tx_version = tx_info.version.into();
    if tx_version >= QUERY_OFFSET {
        QUERY_OFFSET + MIN_TRANSACTION_VERSION <= tx_version
    } else {
        MIN_TRANSACTION_VERSION <= tx_version
    }
}

pub fn get_outside_execution_hash(
    outside_execution: @OutsideExecution, signer: ContractAddress,
) -> felt252 {
    let domain = StarknetDomain {
        name: 'Account.execute_from_outside',
        version: 2,
        chain_id: starknet::get_tx_info().unbox().chain_id,
        revision: 1,
    };
    PoseidonTrait::new()
        .update_with('StarkNet Message')
        .update_with(domain.hash_struct())
        .update_with(signer)
        .update_with(outside_execution.hash_struct())
        .finalize()
}

pub fn verify_outside_execution_signature(
    hash: felt252, pubkey: PubKey, signature: Span<felt252>,
) {
    assert!(signature.len() == 2, "INVALID_SIGNATURE_LENGTH");
    assert!(
        check_ecdsa_signature(hash, pubkey.x, *signature.at(0), *signature.at(1)),
        "INVALID_SIGNATURE",
    );
}

/// Extracts from, to, and relay fee from a transfer calldata in one pass.
pub fn extract_transfer_info(calldata: Span<felt252>) -> (PubKey, PubKey, u128) {
    let mut cd = calldata;
    let Transfer { from, to, .. } = Serde::deserialize(ref cd).expect('bad transfer calldata');
    let opts: Option<TransferOptions> = Serde::deserialize(ref cd).expect('bad transfer opts');
    let TransferOptions { relayData, .. } = opts.expect('NO OPTIONS');
    let RelayData { fee_to_sender } = relayData.expect('NO RELAY DATA');
    (from, to, fee_to_sender)
}

/// Extracts the target pubkey from a rollover calldata.
pub fn extract_rollover_pubkey(calldata: Span<felt252>) -> PubKey {
    let mut cd = calldata;
    let Rollover { to, .. } = Serde::deserialize(ref cd).expect('bad rollover calldata');
    to
}

/// Extracts the sender pubkey and relay fee from the calldata of a Tongo operation in one pass.
pub fn extract_call_info(selector: felt252, calldata: Span<felt252>) -> (PubKey, u128) {
    let mut cd = calldata;
    if selector == WITHDRAW_SELECTOR {
        let Withdraw { from, .. } = Serde::deserialize(ref cd).expect('bad withdraw calldata');
        let opts: Option<WithdrawOptions> = Serde::deserialize(ref cd).expect('bad withdraw opts');
        let WithdrawOptions { relayData } = opts.expect('NO OPTIONS');
        let RelayData { fee_to_sender } = relayData.expect('NO RELAY DATA');
        (from, fee_to_sender)
    } else if selector == RAGEQUIT_SELECTOR {
        let Ragequit { from, .. } = Serde::deserialize(ref cd).expect('bad ragequit calldata');
        let opts: Option<RagequitOptions> = Serde::deserialize(ref cd).expect('bad ragequit opts');
        let RagequitOptions { relayData } = opts.expect('NO OPTIONS');
        let RelayData { fee_to_sender } = relayData.expect('NO RELAY DATA');
        (from, fee_to_sender)
    } else { //transfer
        let Transfer { from, .. } = Serde::deserialize(ref cd).expect('bad transfer calldata');
        let opts: Option<TransferOptions> = Serde::deserialize(ref cd).expect('bad transfer opts');
        let TransferOptions { relayData, .. } = opts.expect('NO OPTIONS');
        let RelayData { fee_to_sender } = relayData.expect('NO RELAY DATA');
        (from, fee_to_sender)
    }
}
