use starknet::account::Call;
use starknet::SyscallResultTrait;

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
