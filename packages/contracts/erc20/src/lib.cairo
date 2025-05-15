use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer_from( ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn print(ref self: TContractState);
}


#[starknet::contract]
pub mod ERC20Contract {
    use starknet::storage::StoragePathEntry;
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
    };
    use core::num::traits::{Bounded, Zero};


    #[storage]
    pub struct Storage {
        pub ERC20_balances: Map<ContractAddress, u256>,
        pub ERC20_allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    pub mod Errors {
        pub const APPROVE_FROM_ZERO: felt252 = 'ERC20: approve from 0';
        pub const APPROVE_TO_ZERO: felt252 = 'ERC20: approve to 0';
        pub const TRANSFER_FROM_ZERO: felt252 = 'ERC20: transfer from 0';
        pub const TRANSFER_TO_ZERO: felt252 = 'ERC20: transfer to 0';
        pub const BURN_FROM_ZERO: felt252 = 'ERC20: burn from 0';
        pub const MINT_TO_ZERO: felt252 = 'ERC20: mint to 0';
        pub const INSUFFICIENT_BALANCE: felt252 = 'ERC20: insufficient balance';
        pub const INSUFFICIENT_ALLOWANCE: felt252 = 'ERC20: insufficient allowance';
        pub const EXPIRED_PERMIT_SIGNATURE: felt252 = 'ERC20: expired permit signature';
        pub const INVALID_PERMIT_SIGNATURE: felt252 = 'ERC20: invalid permit signature';
    }

    #[abi(embed_v0)]
    impl Erc20Impl of super::IERC20<ContractState> {
        fn print(ref self: ContractState) {
            let user  = starknet::get_caller_address();
            self.ERC20_balances.write(user, 1_000_000_u256);
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            let balance = self.ERC20_balances.entry(account).read();
            return balance;
        }

        fn transfer(
            ref self: ContractState, recipient: ContractAddress, amount: u256,
        ) -> bool {
            let sender = starknet::get_caller_address();
            self._transfer(sender, recipient, amount);
            true
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.ERC20_allowances.read((owner, spender))
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256,
        ) -> bool {
            let caller = starknet::get_caller_address();
            self._approve(caller, spender, amount);
            true
        }

        fn transfer_from(ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,) -> bool {
            let caller = starknet::get_caller_address();
            self._spend_allowance(sender, caller, amount);
            self._transfer(sender, recipient, amount);
            true
        }
    }

    #[generate_trait]
    pub impl PrivateImpl of IPrivate {

        fn _approve(
            ref self: ContractState,
            owner: ContractAddress,
            spender: ContractAddress,
            amount: u256,
        ) {
            assert(!owner.is_zero(), Errors::APPROVE_FROM_ZERO);
            assert(!spender.is_zero(), Errors::APPROVE_TO_ZERO);
            self.ERC20_allowances.write((owner, spender), amount);
        }

        fn _spend_allowance(
            ref self: ContractState,
            owner: ContractAddress,
            spender: ContractAddress,
            amount: u256,
        ) {
            let current_allowance = self.ERC20_allowances.read((owner, spender));
            if current_allowance != Bounded::MAX {
                assert(current_allowance >= amount, Errors::INSUFFICIENT_ALLOWANCE);
                self._approve(owner, spender, current_allowance - amount);
            }
        }

        fn _transfer(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            assert(!sender.is_zero(), Errors::TRANSFER_FROM_ZERO);
            assert(!recipient.is_zero(), Errors::TRANSFER_TO_ZERO);
            self.update(sender, recipient, amount);
        }

        fn update(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
                let from_balance = self.ERC20_balances.read(from);
                assert(from_balance >= amount, Errors::INSUFFICIENT_BALANCE);
                self.ERC20_balances.write(from, from_balance - amount);

                let to_balance = self.ERC20_balances.read(to);
                self.ERC20_balances.write(to, to_balance + amount);
            }
        }

    }
