#[starknet::contract]
pub mod Vault {
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::SyscallResultTrait;
    use starknet::{ContractAddress, ClassHash, get_caller_address, get_contract_address};
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::structs::common::pubkey::PubKey;
    use crate::structs::common::state::GlobalSetup;
    use crate::structs::events::TongoDeployed;
    use crate::tongo::IVault::{IVault};

    #[storage]
    struct Storage {
        /// The contract address of the ERC20 that Tongo is wrapping.
        ERC20: ContractAddress,
        /// The conversion  rage between the wrapped ERC20 a tongo:
        ///
        /// ERC20_amount = Tongo_amount*rate
        rate: u256,
        /// The bit size this contract will work with. This limites the values that cant be proven
        /// by a range proof. If is set to 32 that means that range proof will only work for values
        /// between 0 and 2**32-1.
        /// Note: The computational cost of verifying a tranfers operation (the most expensive one)
        /// is about (30 + 10*n) ec_muls and (20 + 8n) ec_adds, where n is the bit_size
        bit_size: u32,

        tongo_class: ClassHash,
        tongo_deployed: Map<ContractAddress, bool>,
        tag_to_address: Map<felt252, ContractAddress>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        ERC20: ContractAddress,
        rate: u256,
        bit_size: u32,
        ledger_class: ClassHash,
    ) {
        self.ERC20.write(ERC20);
        self.rate.write(rate);

        assert!(bit_size <= 128_u32, "Bit size should be 128 at max");
        self.bit_size.write(bit_size);

        self.tongo_class.write(ledger_class);
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TongoDeployed: TongoDeployed,
    }


    #[abi(embed_v0)]
    impl VaultImpl of IVault<ContractState> {
        fn get_vault_setup(self: @ContractState) -> GlobalSetup {
            GlobalSetup {
                global_tongo: get_contract_address(),
                ERC20: self.ERC20.read(),
                rate: self.rate.read(),
                bit_size: self.bit_size.read(),
            }
        }

        fn ERC20(self: @ContractState) -> ContractAddress {
            self.ERC20.read()
        }

        fn get_rate(self: @ContractState) -> u256 {
            self.rate.read()
        }

        fn get_bit_size(self: @ContractState) -> u32 {
            self.bit_size.read()
        }

        fn tag_to_address(self: @ContractState, tag: felt252) -> ContractAddress {
            assert!(self._is_known_tag(tag), "Tag is not registered");
            self.tag_to_address.entry(tag).read()
        }

        fn deploy_tongo(ref self: ContractState, owner: ContractAddress, tag:felt252, auditorKey: Option<PubKey>) -> ContractAddress {
            assert!(!self._is_known_tag(tag), "Tag is already used in other contract");

            let ledger_class_hash: ClassHash = self.tongo_class.read();
            let ERC20 = self.ERC20();
            let rate = self.get_rate();
            let bit_size = self.get_bit_size();

            let mut constructor_calldata: Array<felt252> = array![
                owner.into(),
                tag,
                ERC20.into(),
                rate.low.into(),
                rate.high.into(),
                bit_size.into(),
            ];
            auditorKey.serialize(ref constructor_calldata);

            let deploy_from_zero = false;
            let salt = tag;
            
            let (address, _ ) = deploy_syscall(
                ledger_class_hash,
                salt,
                constructor_calldata.span(),
                deploy_from_zero
            ).unwrap_syscall();

            self.tongo_deployed.entry(address).write(true);

            self.emit(
                TongoDeployed {
                    tag,
                    address,
                    ERC20,
                    rate,
                    bit_size,
                    AuditorPubKey: auditorKey
                }
            );

            address
        }

        fn is_known_tongo(self: @ContractState, address: ContractAddress) -> bool {
            self.tongo_deployed.entry(address).read()
        }

        fn deposit(ref self: ContractState, amount: u256){
            let caller = get_caller_address();
            assert!(self.is_known_tongo(caller), "Caller is not a valid Tongo contract");
            self._transfer_from_caller(amount);
        }

        fn withdraw(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            assert!(self.is_known_tongo(caller), "Caller is not a valid Tongo contract");
            self._transfer_to_caller(amount);
        }
    }

    #[generate_trait]
    impl PrivateImpl of IPrivate {
        /// Pull some ERC20 amount from the caller.
        fn _transfer_from_caller(self: @ContractState, amount: u256) {
            let from = get_caller_address();
            let asset_address = self.ERC20.read();
            let ERC20 = IERC20Dispatcher { contract_address: asset_address };
            let response = ERC20
                .transfer_from(from, get_contract_address(), amount);
            assert!(response, "ERC20 transfer_from failed");
        }

        /// Transfer some amount of ERC20 to the given starknet address.
        fn _transfer_to_caller(self: @ContractState, amount: u256) {
            let to = get_caller_address();
            let asset_address = self.ERC20.read();
            let ERC20 = IERC20Dispatcher { contract_address: asset_address };
            let response = ERC20.transfer(to, amount);
            assert!(response, "ERC20 transfer failed");
        }

        /// Returns the ERC20 equivalent of the given Tongo amount.
        ///
        /// ERC20_amount = Tongo_amount*rate
//        fn _unwrap_tongo_amount(self: @ContractState, amount: u128) -> u256 {
//            let rate = self.rate.read();
//            return (amount.into() * rate);
//        }

        fn _is_known_tag(self: @ContractState, tag:felt252) -> bool {
            let address: felt252 = self.tag_to_address.entry(tag).read().try_into().unwrap();
            address != 0
        }

        fn _register_tongo(ref self: ContractState, tag: felt252, tongo_address: ContractAddress) {
            assert!(!self.is_known_tongo(tongo_address), "Tongo Contract already deployed for this Address");
            self.tongo_deployed.entry(tongo_address).write(true);
            self.tag_to_address.entry(tag).write(tongo_address);
        }
    }
}
