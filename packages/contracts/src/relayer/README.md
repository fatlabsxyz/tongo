 Relayer:
 
 We need to subscribe to SNIP-9 (outside_execution) with the interface

```cairo
pub const ISRC9_V2_ID: felt252 = 0x1d1144bb2138366ff28d8e9ab57456b1d332ac42196230c3a602003c89872;
#[starknet::interface]
pub trait ISRC9_V2<TContractState> {
    fn execute_from_outside_v2(ref self: TContractState, outside_execution: OutsideExecution, signature: Span<felt252>) -> Array<Span<felt252>>;
    fn is_valid_outside_execution_nonce(self: @TContractState, nonce: felt252) -> bool;
}
```cairo

- Problem 1: Starknet.js calls a function `supports_interface` when creating an account class with a `paymaster` options. It does this according to the snip-5 (introspection of interfaces).

- Solution: We need to implement SRC5 with interface:
```cairo
pub const ISRC5_ID: felt252 = 0x3f918d17e5ee77373b56385708f855659a07f75997f365cf87748628532a055;
#[starknet::interface]
pub trait ISRC5<TContractState> {
    fn supports_interface(self: @TContractState, interface_id: felt252) -> bool;
}
```

- Problem 2: Also, I notice that and `__execute__` fuction is needed for the `feeEstimations` functions of the paymaster. I suspect that it is needed for the simulation. No error was raised if the contract does not have `__validate__`. When I implemented a empty `__execute__` and try to operate with that I got an error saying `MAX_AMOUNT_TO_LOW`. I suspect the simulation of that execute returns almost 0 in `estimatePaymasterTransactionFee` and when I use those parameters in `executePaymasterTransaction` some internal simulation rejected the operation.

- Solution: Leave a `__execute__` entrypoint open for starknet.js to be able to simulate. There is not risk in leave that because `__execute__` implements a assertion that the caller must be the Zero address (that is no contract or account call `__execute__`). This is indeed what all accounts in starknet do. All of them have an `__execute__` exposes. I propose to do the same but without having a `__validate__` in the contract. The OZ implementation is 

```cairo
fn __execute__(self: @ContractState, calls: Array<Call>) {
    // Avoid calls from other contracts
    // https://github.com/OpenZeppelin/cairo-contracts/issues/344
    let sender = starknet::get_caller_address();
    assert(sender.is_zero(), 'INVALID_CALLER');
    assert(is_tx_version_valid(), 'INVALID_TX_VERSION');

    for call in calls.span() {
        execute_single_call(call);
    }
}
```


Sepolia:

- Vault 0x0595970cbb7999f3ffc0ce583fcc0c3512afbdf1a7e247a3d150aa19f18629a6
- Tongo V2 : 0x7b670f703cb67d07f2f07eb78e7713892fd00122099e7aef2d8692540233ca2
    - Owner: 0x1205a5a942f937a4354c3816dd94c4e5df8504fb19bbc55c10b0fc009ad5a9d

- Relayer: 0x0670625873a2a00cf4224b91aa7b2e4c80944391f3d2e2299fe1901ffd00ebef
- Owner: 0x1205a5a942f937a4354c3816dd94c4e5df8504fb19bbc55c10b0fc009ad5a9d

- Whitelisted Asset(strk): 0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
- Whitelisted Target: 0x7b670f703cb67d07f2f07eb78e7713892fd00122099e7aef2d8692540233ca2

- Forwarder: 0x075a180e18e56da1b1cae181c92a288f586f5fe22c18df21cf97886f1e4b316c
