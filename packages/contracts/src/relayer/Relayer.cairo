#[starknet::contract]
mod Relayer {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::account::Call;

    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry};
    use starknet::storage::{Vec, VecTrait, MutableVecTrait};

    use crate::relayer::structs::{RelayStatus, RelayStatusTrait, OutsideExecution, TargetConfig};
    use crate::relayer::IRelayer::{IRelayer, ISRC5, ISRC5_ID, ISRC9_V2, ISRC9_V2_ID, IExecute};

    use core::poseidon::poseidon_hash_span;
    use crate::relayer::utils::{execute_calls, extract_call_info, extract_transfer_info, extract_rollover_pubkey, is_tx_version_valid, get_outside_execution_hash, verify_outside_execution_signature, ROLLOVER_SELECTOR, TRANSFER_SELECTOR, WITHDRAW_SELECTOR, RAGEQUIT_SELECTOR};
    use crate::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    pub struct Storage {
        pub SRC9_nonces: Map<felt252, bool>,
        pub owner: ContractAddress,
        pub targets: Map<ContractAddress, TargetConfig>,
        pub assets: Map<ContractAddress, bool>,
        pub forwarders: Map<ContractAddress, bool>,
        pub tongo_selectors: Vec<felt252>,
        pub asset_selectors: Vec<felt252>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        use crate::relayer::utils::{WITHDRAW_SELECTOR, RAGEQUIT_SELECTOR, TRANSFER_SELECTOR, ROLLOVER_SELECTOR};
        self.tongo_selectors.push(WITHDRAW_SELECTOR);
        self.tongo_selectors.push(RAGEQUIT_SELECTOR);
        self.tongo_selectors.push(TRANSFER_SELECTOR);
        self.tongo_selectors.push(ROLLOVER_SELECTOR);
        self.asset_selectors.push(TRANSFER_SELECTOR);
    }

    #[abi(embed_v0)]
    impl SRC5 of ISRC5<ContractState> {
        fn supports_interface(self: @ContractState, interface_id: felt252) -> bool {
            interface_id == ISRC5_ID || interface_id == ISRC9_V2_ID
        }
    }

    #[abi(embed_v0)]
    impl SNIP9 of ISRC9_V2<ContractState> {
        fn execute_from_outside_v2(
            ref self: ContractState,
            outside_execution: OutsideExecution,
            signature: Span<felt252>,
        ) -> Array<Span<felt252>> {
            // 0. Assert caller is a whitelisted forwarder
            let caller = starknet::get_caller_address();
            assert!(self.is_forwarder_whitelisted(caller), "CALLER NOT WHITELISTED FORWARDER");

            // 'ANY_CALLER' can be used to bypass the specific-address validation
            if outside_execution.caller.into() != 'ANY_CALLER' {
                assert(caller == outside_execution.caller, 'INVALID_CALLER');
            }

            // 1. Validate the execution time span
            let now = starknet::get_block_timestamp();
            assert(outside_execution.execute_after < now, 'INVALID_AFTER');
            assert(now < outside_execution.execute_before, 'INVALID_BEFORE');

            // 2. Validate the nonce
            assert(!self.SRC9_nonces.read(outside_execution.nonce), 'DUPLICATED_NONCE');

            // 3. Mark the nonce as used
            self.SRC9_nonces.write(outside_execution.nonce, true);

            // 4. Validate the transactions and extract relay status (includes sender pubkey)
            let status = self.assert_valid_transaction(outside_execution.calls, outside_execution.nonce);

            // 5. Verify the OutsideExecution signature against the sender's Tongo pubkey
            let hash = get_outside_execution_hash(@outside_execution, starknet::get_contract_address());
            verify_outside_execution_signature(hash, status.pubkey.unwrap(), signature);

            // 6. Execute the calls
            execute_calls(outside_execution.calls)
        }

        fn is_valid_outside_execution_nonce(self: @ContractState, nonce: felt252) -> bool {
            !self.SRC9_nonces.read(nonce)
        }
    }

    #[abi(embed_v0)]
    impl Execute of IExecute<ContractState> {
        fn __execute__(self: @ContractState, calls: Array<Call>) {
            // Avoid calls from other contracts
            // https://github.com/OpenZeppelin/cairo-contracts/issues/344
            let sender = starknet::get_caller_address();
            assert(sender.is_zero(), 'INVALID_CALLER');
            assert(is_tx_version_valid(), 'INVALID_TX_VERSION');

            execute_calls(calls.span());
        }
    }

    #[abi(embed_v0)]
    impl Relayer of IRelayer<ContractState> {
        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn is_target_whitelisted(self: @ContractState, target: ContractAddress) -> bool {
            !self.targets.entry(target).read().erc20.is_zero()
        }

        fn is_asset_whitelisted(self: @ContractState, asset: ContractAddress) -> bool {
            self.assets.entry(asset).read()
        }

        fn is_forwarder_whitelisted(self: @ContractState, forwarder: ContractAddress) -> bool {
            self.forwarders.entry(forwarder).read()
        }

        fn get_tongo_selectors(self: @ContractState) -> Span<felt252> {
            let mut selectors = array![];
            for i in 0..self.tongo_selectors.len() {
                selectors.append(self.tongo_selectors[i].read());
            };
            selectors.span()
        }

        fn get_asset_selectors(self: @ContractState) -> Span<felt252> {
            let mut selectors = array![];
            for i in 0..self.asset_selectors.len() {
                selectors.append(self.asset_selectors[i].read());
            };
            selectors.span()
        }

        fn get_target_config(self: @ContractState, target: ContractAddress) -> TargetConfig {
            self.targets.entry(target).read()
        }

        fn whitelist_target(ref self: ContractState, target: ContractAddress) {
            self._assert_only_owner();
            assert!(!self.is_target_whitelisted(target), "TARGET ALREADY WHITELISTED");
            let tongo = ITongoDispatcher { contract_address: target };
            let erc20 = tongo.ERC20();
            assert!(self.is_asset_whitelisted(erc20), "ASSET NOT WHITELISTED");
            let rate = tongo.get_rate();
            self.targets.entry(target).write(TargetConfig { erc20, rate, relayer_fee: 0 });
        }

        fn whitelist_asset(ref self: ContractState, asset: ContractAddress) {
            self._assert_only_owner();
            self.assets.entry(asset).write(true);
        }

        fn whitelist_forwarder(ref self: ContractState, forwarder: ContractAddress) {
            self._assert_only_owner();
            self.forwarders.entry(forwarder).write(true);
        }

        fn delist_forwarder(ref self: ContractState, forwarder: ContractAddress) {
            self._assert_only_owner();
            self.forwarders.entry(forwarder).write(false);
        }

        fn set_tongo_selectors(ref self: ContractState, selectors: Span<felt252>) {
            self._assert_only_owner();
            let mut p = self.tongo_selectors.pop();
            while p.is_some() {
                p = self.tongo_selectors.pop();
            };
            for selector in selectors {
                self.tongo_selectors.push(*selector);
            };
        }

        fn pull(ref self: ContractState, asset: ContractAddress) {
            self._assert_only_owner();
            let balance = IERC20Dispatcher { contract_address: asset }.balance_of(starknet::get_contract_address());
            if balance > 0 {
                IERC20Dispatcher { contract_address: asset }.transfer(self.owner.read(), balance);
            }
        }

        fn set_asset_selectors(ref self: ContractState, selectors: Span<felt252>) {
            self._assert_only_owner();
            let mut p = self.asset_selectors.pop();
            while p.is_some() {
                p = self.asset_selectors.pop();
            };
            for selector in selectors {
                self.asset_selectors.push(*selector);
            };
        }

        fn set_relayer_fee(ref self: ContractState, target: ContractAddress, fee: u256) {
            self._assert_only_owner();
            assert!(self.is_target_whitelisted(target), "TARGET NOT WHITELISTED");
            let mut config = self.targets.entry(target).read();
            config.relayer_fee = fee;
            self.targets.entry(target).write(config);
        }
    }

    #[generate_trait]
    impl Private of IPrivate {
        fn assert_valid_transaction(ref self: ContractState, calls: Span<Call>, snip9_nonce: felt252) -> RelayStatus {
            assert!(calls.len() >= 2, "AT LEAST 2 CALLS REQUIRED");
            let mut status = RelayStatusTrait::new();

            for call in calls {
                if self.is_target_whitelisted(*call.to) {
                    self._process_tongo_call(call, ref status);
                } else if self.is_asset_whitelisted(*call.to) {
                    self._process_asset_call(call, ref status);
                } else {
                    panic!("UNAUTHORIZED TARGET");
                }
            };

            let target = status.target.expect('NO TONGO CALLS');
            let config = self.targets.entry(target).read();
            assert!(status.to_add >= status.to_subtract + config.relayer_fee, "RELAY FEE TOO LOW");

            let pubkey = status.pubkey.unwrap();
            let tongo_nonce: u64 = ITongoDispatcher { contract_address: target }.get_nonce(pubkey);
            let expected_nonce = poseidon_hash_span(array![pubkey.x, pubkey.y, tongo_nonce.into()].span());
            assert!(snip9_nonce == expected_nonce, "INVALID SNIP9 NONCE");
            status
        }

        fn _process_tongo_call(ref self: ContractState, call: @Call, ref status: RelayStatus) {
            assert!(self._is_tongo_selector_allowed(*call.selector), "SELECTOR NOT WHITELISTED");
            let selector = *call.selector;
            if selector == ROLLOVER_SELECTOR {
                self._process_rollover_call(call, ref status)
            } else if selector == TRANSFER_SELECTOR {
                self._process_transfer_call(call, ref status)
            } else if selector == WITHDRAW_SELECTOR || selector == RAGEQUIT_SELECTOR {
                self._process_withdraw_ragequit_call(call, ref status)
            } else {
                panic!("UNSUPPORTED SELECTOR")
            }
        }

        fn _process_rollover_call(ref self: ContractState, call: @Call, ref status: RelayStatus) {
            let to = extract_rollover_pubkey(*call.calldata);
            let config = self.targets.entry(*call.to).read();
            status.compare_and_set_asset(config.erc20);
            status.compare_and_set_target(*call.to);
            status.compare_and_set_pubkey(to);
        }

        fn _process_transfer_call(ref self: ContractState, call: @Call, ref status: RelayStatus) {
            let (from, _to, fee) = extract_transfer_info(*call.calldata);
            let config = self.targets.entry(*call.to).read();
            let fee_in_erc20: u256 = fee.into() * config.rate;
            status.add(fee_in_erc20);
            status.compare_and_set_asset(config.erc20);
            status.compare_and_set_target(*call.to);
            status.compare_and_set_pubkey(from);
        }

        fn _process_withdraw_ragequit_call(self: @ContractState, call: @Call, ref status: RelayStatus) {
            let (pubkey, fee) = extract_call_info(*call.selector, *call.calldata);
            let config = self.targets.entry(*call.to).read();
            status.add(fee.into() * config.rate);
            status.compare_and_set_asset(config.erc20);
            status.compare_and_set_target(*call.to);
            status.compare_and_set_pubkey(pubkey);
        }

        fn _process_asset_call(self: @ContractState, call: @Call, ref status: RelayStatus) {
            assert!(self._is_asset_selector_allowed(*call.selector), "ASSET SELECTOR NOT WHITELISTED");
            let mut cd = *call.calldata;
            let recipient: starknet::ContractAddress = Serde::deserialize(ref cd).expect('bad erc20 calldata');
            let amount: u256 = Serde::deserialize(ref cd).expect('bad erc20 amount');
            assert!(recipient == get_caller_address(), "RECIPIENT IS NOT THE FORWARDER");
            status.compare_and_set_asset(*call.to);
            status.subtract(amount);
        }

        fn _is_tongo_selector_allowed(self: @ContractState, selector: felt252) -> bool {
            let mut found = false;
            for i in 0..self.tongo_selectors.len() {
                if self.tongo_selectors[i].read() == selector {
                    found = true;
                    break;
                }
            };
            found
        }

        fn _is_asset_selector_allowed(self: @ContractState, selector: felt252) -> bool {
            let mut found = false;
            for i in 0..self.asset_selectors.len() {
                if self.asset_selectors[i].read() == selector {
                    found = true;
                    break;
                }
            };
            found
        }

        fn _assert_only_owner(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert!(caller == owner, "CALLER IS NOT THE OWNER");
        }
    }
}
