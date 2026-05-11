use starknet::account::Call;
use starknet::SyscallResultTrait;

use crate::structs::common::pubkey::PubKey;
use crate::structs::common::relayer::RelayData;
use crate::structs::operations::ragequit::{Ragequit, RagequitOptions};
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

/// Extracts the sender pubkey and relay fee from the calldata of a Tongo operation in one pass.
pub fn extract_call_info(selector: felt252, calldata: Span<felt252>) -> (PubKey, u128) {
    let mut cd = calldata;
    if selector == selector!("withdraw") {
        let Withdraw { from, .. } = Serde::deserialize(ref cd).expect('bad withdraw calldata');
        let opts: Option<WithdrawOptions> = Serde::deserialize(ref cd).expect('bad withdraw opts');
        let WithdrawOptions { relayData } = opts.expect('NO OPTIONS');
        let RelayData { fee_to_sender } = relayData.expect('NO RELAY DATA');
        (from, fee_to_sender)
    } else if selector == selector!("ragequit") {
        let Ragequit { from, .. } = Serde::deserialize(ref cd).expect('bad ragequit calldata');
        let opts: Option<RagequitOptions> = Serde::deserialize(ref cd).expect('bad ragequit opts');
        let RagequitOptions { relayData } = opts.expect('NO OPTIONS');
        let RelayData { fee_to_sender } = relayData.expect('NO RELAY DATA');
        (from, fee_to_sender)
    } else if selector == selector!("transfer") {
        let Transfer { from, .. } = Serde::deserialize(ref cd).expect('bad transfer calldata');
        let opts: Option<TransferOptions> = Serde::deserialize(ref cd).expect('bad transfer opts');
        let TransferOptions { relayData, .. } = opts.expect('NO OPTIONS');
        let RelayData { fee_to_sender } = relayData.expect('NO RELAY DATA');
        (from, fee_to_sender)
    } else {
        panic!("UNSUPPORTED SELECTOR")
    }
}
