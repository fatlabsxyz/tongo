#[starknet::contract]
mod Relayer {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::account::Call;

    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry};
    use starknet::storage::{Vec, VecTrait, MutableVecTrait};

    use crate::relayer::structs::{FeeStatus, FeeStatusTrait, OutsideExecution, TargetConfig};
    use crate::relayer::IRelayer::{IRelayer, ISRC5, ISRC5_ID, ISRC9_V2, ISRC9_V2_ID, IExecute};

    use crate::relayer::utils::{execute_calls, extract_relay_fee, is_tx_version_valid};
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
        self.tongo_selectors.push(selector!("withdraw"));
        self.tongo_selectors.push(selector!("ragequit"));
        self.tongo_selectors.push(selector!("transfer"));
        self.asset_selectors.push(selector!("transfer"));
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

            // 4. Validate the transactions
            self.assert_valid_transaction(outside_execution.calls);

            // 5. Execute the calls
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
            let tongo = ITongoDispatcher { contract_address: target };
            let erc20 = tongo.ERC20();
            assert!(self.is_asset_whitelisted(erc20), "ASSET NOT WHITELISTED");
            let rate = tongo.get_rate();
            self.targets.entry(target).write(TargetConfig { erc20, rate });
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

        fn pull(ref self: ContractState, asset: ContractAddress, amount: u256) {
            self._assert_only_owner();
            IERC20Dispatcher { contract_address: asset }.transfer(self.owner.read(), amount);
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
    }

    #[generate_trait]
    impl Private of IPrivate {
        fn assert_valid_transaction(self: @ContractState, calls: Span<Call>) {
            assert!(calls.len() >= 2, "AT LEAST 2 CALLS REQUIRED");
            let mut feeStatus = FeeStatusTrait::new();

            for call in calls {
                if self.is_target_whitelisted(*call.to) {
                    self._process_tongo_call(call, ref feeStatus);
                } else if self.is_asset_whitelisted(*call.to) {
                    self._process_asset_call(call, ref feeStatus);
                } else {
                    panic!("UNAUTHORIZED TARGET");
                }
            };

            assert!(feeStatus.to_add >= feeStatus.to_subtract, "RELAY FEE TOO LOW");
        }

        fn _process_tongo_call(self: @ContractState, call: @Call, ref feeStatus: FeeStatus) {
            assert!(self._is_tongo_selector_allowed(*call.selector), "SELECTOR NOT WHITELISTED");
            let fee = extract_relay_fee(*call.selector, *call.calldata);
            assert!(fee > 0, "RELAY FEE MUST BE POSITIVE");
            let config = self.targets.entry(*call.to).read();
            let fee_in_erc20: u256 = fee.into() * config.rate;
            feeStatus.add(fee_in_erc20);
            feeStatus.compare_and_set_asset(config.erc20);
        }

        fn _process_asset_call(self: @ContractState, call: @Call, ref feeStatus: FeeStatus) {
            assert!(self._is_asset_selector_allowed(*call.selector), "ASSET SELECTOR NOT WHITELISTED");
            let mut cd = *call.calldata;
            let recipient: starknet::ContractAddress = Serde::deserialize(ref cd).expect('bad erc20 calldata');
            let amount: u256 = Serde::deserialize(ref cd).expect('bad erc20 amount');
            assert!(recipient == get_caller_address(), "RECIPIENT IS NOT THE FORWARDER");
            feeStatus.compare_and_set_asset(*call.to);
            feeStatus.subtract(amount);
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
