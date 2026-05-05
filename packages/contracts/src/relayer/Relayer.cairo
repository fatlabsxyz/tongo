#[starknet::contract]
mod Relayer {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::account::Call;

    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry};
    use starknet::storage::{Vec, VecTrait, MutableVecTrait};

    use crate::relayer::structs::{FeeStatus, FeeStatusTrait, OutsideExecution};
    use crate::relayer::IRelayer::{IRelayer, ISRC5, ISRC5_ID, ISRC9_V2, ISRC9_V2_ID, IExecute};

    use crate::relayer::utils::{execute_calls, is_tx_version_valid };

    #[storage]
    pub struct Storage {
        pub SRC9_nonces: Map<felt252, bool>,
        pub owner: ContractAddress,
        pub targets: Map<ContractAddress, bool>,
        pub assets: Map<ContractAddress, bool>,
        pub selectors: Map<ContractAddress, Vec<felt252>>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
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
            // 'ANY_CALLER' can be used to bypass the caller validation
            if outside_execution.caller.into() != 'ANY_CALLER' {
                assert(
                    starknet::get_caller_address() == outside_execution.caller,
                    'INVALID_CALLER'
                );
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

        /// Returns the status of a given nonce. `true` if the nonce is available to use.
        fn is_valid_outside_execution_nonce(
            self: @ContractState, nonce: felt252,
        ) -> bool {
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
            self.targets.entry(target).read()
        }

        fn is_asset_whitelisted(self: @ContractState, asset: ContractAddress) -> bool {
            self.assets.entry(asset).read()
        }

        fn selectors_for_target(self: @ContractState, target: ContractAddress) -> Span<felt252> {
            let mut selectors = array![];
            let path = self.selectors.entry(target);
            for i in 0..path.len() {
                selectors.append(path[i].read())
            }

            selectors.span()
        }

        fn whitelist_target(ref self: ContractState, target: ContractAddress) {
            self._assert_only_owner();
            self.targets.entry(target).write(true);
        }
        fn whitelist_asset(ref self: ContractState, asset: ContractAddress) {
            self._assert_only_owner();
            self.assets.entry(asset).write(true);
        }

        fn set_selectors_for_target(ref self: ContractState, target: ContractAddress, selectors: Span<felt252>) {
            self._assert_only_owner();
            assert!(!self.is_target_whitelisted(target), "TARGET IS NOT WHITELISTED");

            let path = self.selectors.entry(target);

            let mut p = path.pop();
            while p.is_some() {
                p = path.pop()
            }

            for selector in selectors {
                path.push(*selector)
            }
        }
    }

    #[generate_trait]
    impl Private of IPrivate {
        fn assert_valid_transaction(self: @ContractState, calls: Span<Call>)  {
            assert!(calls.len() == 2, "2 CALLS ARE NEEDED")
            let mut feeStatus = FeeStatusTrait::new();

            for call in calls {
               self._assert_valid_call(call, feeStatus) 
            }

            assert!(feeStatus.to_add > feeStatus.to_subtract, "RELLAY FEE TO LOW");
        }


        fn _assert_valid_call(self: @ContractState, call: @Call, feeStatus: FeeStatus) {
            if self.is_target_whitelisted(*call.to) {
//                self.process_tongo_call(call, feeStatus);
            } else if self.is_asset_whitelisted(*call.to) {
//                self.process_asset_call(call, feeStatus);
            }
        }

        fn process_tongo_call(self: @ContractState, call: @Call, feeStatus: FeeStatus) {
//            let Call { to, selector, calldata } = call;
//            assert!(self.selectors.entry(
        }

        fn _assert_only_owner(self: @ContractState) {
//            TODO: UNCOMMENT
//            let caller = get_caller_address();
//            let owner = self.owner.read();
//            assert!(caller == owner, "CALLER IS NOT THE OWNER");
        }
    }
}


