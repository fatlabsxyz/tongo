#[starknet::contract]
pub mod Global {
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::SyscallResultTrait;
    use starknet::{ContractAddress, ClassHash, get_caller_address, get_contract_address, get_tx_info};
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::structs::common::cipherbalance::{CipherBalance, CipherBalanceTrait};
    use crate::structs::common::pubkey::PubKey;
    use crate::structs::operations::audit::{Audit, InputsAudit};
    use crate::structs::operations::fund::{Fund, InputsFund, OutsideFund};
    use crate::structs::operations::ragequit::{InputsRagequit, Ragequit};
    use crate::structs::operations::rollover::{InputsRollOver, Rollover};
    use crate::structs::operations::transfer::{InputsTransfer, Transfer};
    use crate::structs::operations::withdraw::{InputsWithdraw, Withdraw};
    use crate::structs::traits::GeneralPrefixData;
    use crate::tongo::IGlobal::{IGlobal};
    use crate::tongo::ILedger::{ILedgerDispatcher, ILedgerDispatcherTrait};
    use crate::verifier::fund::verify_fund;
    use crate::verifier::audit::verify_audit;
    use crate::verifier::ragequit::verify_ragequit;
    use crate::verifier::rollover::verify_rollover;
    use crate::verifier::transfer::verify_transfer;
    use crate::verifier::withdraw::verify_withdraw;


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

        ledgers: Map<ContractAddress, bool>,
        ledger_class: ClassHash,
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
        self.ledger_class.write(ledger_class);
    }


    #[abi(embed_v0)]
    impl GlobalImpl of IGlobal<ContractState> {
        /// Returns the contract address that Tongo is wraping.
        fn ERC20(self: @ContractState) -> ContractAddress {
            self.ERC20.read()
        }

        /// Returns the rate of conversion between the wrapped ERC20 a tongo:
        ///
        /// ERC20_amount = Tongo_amount*rate
        ///
        /// The amount variable in all operation refers to the amount of Tongos.
        fn get_rate(self: @ContractState) -> u256 {
            self.rate.read()
        }

        /// Returns the bit_size set for this Tongo contract.
        fn get_bit_size(self: @ContractState) -> u32 {
            self.bit_size.read()
        }

        fn deploy_ledger(ref self: ContractState, owner: ContractAddress, auditorKey: Option<PubKey>, salt:felt252) -> ContractAddress {
            let ledger_class_hash: ClassHash = self.ledger_class.read();

            let mut calldata: Array<felt252> = array![
                owner.into(),
            ];
            auditorKey.serialize(ref calldata);
            let deploy_from_zero = false;
            
            let (address, _ ) = deploy_syscall(
                ledger_class_hash,
                salt,
                calldata.span(),
                deploy_from_zero
            ).unwrap_syscall();

            self.ledgers.entry(address).write(true);

            address
        }

        fn is_known_ledger(self: @ContractState, ledger: ContractAddress) -> bool {
            self.ledgers.entry(ledger).read()
        }

        /// Funds a tongo account. Callable only by the account owner
        ///
        /// Emits FundEvent
        fn fund(ref self: ContractState, fund: Fund) {
            let Fund { to, amount, proof, relayData,  auditPart, hint, ledger } = fund;
            let Ledger = ILedgerDispatcher {contract_address: ledger};

            let nonce = Ledger.get_nonce(to);
            let prefix_data = self._get_general_prefix_data(ledger);

            let inputs: InputsFund = InputsFund { 
                y: to,
                nonce,
                amount,
                relayData,
                prefix_data
            };

            verify_fund(inputs, proof);

            let fee_to_sender = relayData.fee_to_sender;

            self._transfer_from_caller(self._unwrap_tongo_amount(amount+fee_to_sender));

            if fee_to_sender != 0 {
                self._transfer_to(get_caller_address(), self._unwrap_tongo_amount(fee_to_sender.into()));
            }

            let cipher = CipherBalanceTrait::new(to, amount.into(), 'fund');
            Ledger.add_to_account_balance(to, cipher);
            Ledger.overwrite_hint(to, hint);

            if Ledger.get_auditor_key().is_some() {
                self._handle_audit_balance(ledger, to, nonce, auditPart);
            }

            Ledger.increase_nonce(to);
        }

        /// Funds a tongo acount. Can be called without knowledge of the pk.
        ///
        /// Emits OutsideFundEvent
        fn outside_fund(ref self: ContractState, outsideFund: OutsideFund) {
            let OutsideFund { to, amount, ledger} = outsideFund;
            let Ledger = ILedgerDispatcher {contract_address: ledger};

            self._transfer_from_caller(self._unwrap_tongo_amount(amount));

            let cipher = CipherBalanceTrait::new(to, amount.into(), 'outsideFund');
            Ledger.add_to_account_pending(to, cipher);
            //TODO: emit event
        }

        /// Withdraw Tongos and send the ERC20 to a starknet address.
        ///
        /// Emits WithdrawEvent
        fn withdraw(ref self: ContractState, withdraw: Withdraw) {
            let Withdraw {
                from, amount, to, proof, auditPart, hint, auxiliarCipher, relayData, ledger
            } = withdraw;

            let Ledger = ILedgerDispatcher {contract_address: ledger};

            let currentBalance = Ledger.get_balance(from);
            let nonce = Ledger.get_nonce(from);

            let prefix_data = self._get_general_prefix_data(ledger);
            let bit_size = self.get_bit_size();

            let inputs: InputsWithdraw = InputsWithdraw {
                y: from,
                amount,
                nonce,
                to,
                currentBalance,
                auxiliarCipher,
                bit_size,
                prefix_data,
                relayData,
            };
            verify_withdraw(inputs, proof);

            let mut cipher = CipherBalanceTrait::new(from, amount.into(), 'withdraw');
            if relayData.fee_to_sender != 0 {
                let fee = CipherBalanceTrait::new(from, relayData.fee_to_sender.into(), 'fee');
                cipher = cipher.add(fee);
            }

            Ledger.subtract_from_account_balance(from, cipher);
            Ledger.overwrite_hint(from, hint);

            if relayData.fee_to_sender == 0 {
                self._transfer_to(to, self._unwrap_tongo_amount(amount));
            } else {
                self._handle_relayed_withdraw(amount, to, relayData.fee_to_sender);
            }

            //TODO: emit event

            if Ledger.get_auditor_key().is_some() {
                self._handle_audit_balance(ledger, from, nonce, auditPart);
            }

            Ledger.increase_nonce(from);
        }

        /// Withdraw all the balance of an account and send the ERC20 to a starknet address. This
        /// proof avoids the limitations of the range prove that are present in the regular
        /// withdraw.
        ///
        /// Emits RagequitEvent
        fn ragequit(ref self: ContractState, ragequit: Ragequit) {
            let Ragequit { from, amount, to, proof, hint, auditPart, relayData, ledger} = ragequit;
            let Ledger = ILedgerDispatcher {contract_address: ledger};

            let currentBalance = Ledger.get_balance(from);
            let nonce = Ledger.get_nonce(from);
            let prefix_data = self._get_general_prefix_data(ledger);

            let inputs: InputsRagequit = InputsRagequit {
                y: from, amount, nonce, to, currentBalance, prefix_data, relayData,
            };

            verify_ragequit(inputs, proof);

            Ledger.reset_account_balance(from);
            Ledger.overwrite_hint(from, hint);

            if relayData.fee_to_sender == 0 {
                self._transfer_to(to, self._unwrap_tongo_amount(amount));
            } else {
                self._handle_relayed_withdraw(amount, to, relayData.fee_to_sender);
            }

            //TODO: emit event

            if Ledger.get_auditor_key().is_some() {
                self._handle_audit_balance(ledger, from, nonce, auditPart);
            }

            Ledger.increase_nonce(from);
        }

        /// Transfer Tongos from the balance of the sender to the pending of the receiver
        ///
        /// Emits TransferEvent
        fn transfer(ref self: ContractState, transfer: Transfer) {

            let Transfer {
                from,
                to,
                ledger,
                transferBalance,
                transferBalanceSelf,
                auxiliarCipher,
                auxiliarCipher2,
                proof,
                auditPart,
                auditPartTransfer,
                relayData,
                hintTransfer: _,
                hintLeftover,
            } = transfer;


            let Ledger = ILedgerDispatcher {contract_address: ledger};
            let currentBalance = Ledger.get_balance(from);
            let nonce = Ledger.get_nonce(from);


            let bit_size = self.get_bit_size();
            let prefix_data = self._get_general_prefix_data(ledger);

            let inputs: InputsTransfer = InputsTransfer {
                from,
                to,
                nonce,
                currentBalance,
                transferBalance,
                transferBalanceSelf,
                auxiliarCipher,
                auxiliarCipher2,
                bit_size,
                prefix_data,
                relayData,
            };

            verify_transfer(inputs, proof);

            if relayData.fee_to_sender != 0 {
                self
                    ._transfer_to(
                        get_caller_address(), self._unwrap_tongo_amount(relayData.fee_to_sender),
                    );
                let cipher = CipherBalanceTrait::new(from, relayData.fee_to_sender.into(), 'fee');
                Ledger.subtract_from_account_balance(from, cipher);
            }

            Ledger.subtract_from_account_balance(from, transferBalanceSelf);
            Ledger.overwrite_hint(from, hintLeftover);

            Ledger.add_to_account_pending(to, transferBalance);
            
            //TODO: emit event

            if Ledger.get_auditor_key().is_some() {
                self._handle_audit_balance(ledger, from, nonce, auditPart);
                self
                    ._handle_audit_transfer(
                        ledger, from, nonce, to, transferBalanceSelf, auditPartTransfer,
                    );
            }

            Ledger.increase_nonce(from);
        }

        /// Moves to the balance the amount stored in the pending. Callable only by the account
        /// owner.
        ///
        /// Emits RolloverEvent
        fn rollover(ref self: ContractState, rollover: Rollover) {
            let Rollover { to, proof, hint, ledger} = rollover;
            let Ledger = ILedgerDispatcher {contract_address: ledger};


            let nonce = Ledger.get_nonce(to);

            let prefix_data = self._get_general_prefix_data(ledger);

            let inputs: InputsRollOver = InputsRollOver { y: to, nonce, prefix_data };
            verify_rollover(inputs, proof);

//            let rollovered = Ledger.get_pending(to);
//            self.emit(RolloverEvent { to, nonce, rollovered });
            //TODO: emit event

            Ledger.pending_to_balance(to);
            Ledger.increase_nonce(to);
            Ledger.overwrite_hint(to, hint);
        }

    }

    #[generate_trait]
    pub impl PrivateImpl of IPrivate {
        /// Pull some ERC20 amount from the caller.
        fn _transfer_from_caller(self: @ContractState, amount: u256) {
            let asset_address = self.ERC20.read();
            let ERC20 = IERC20Dispatcher { contract_address: asset_address };
            let response = ERC20
                .transfer_from(get_caller_address(), get_contract_address(), amount);
            assert!(response, "ERC20 transfer_from failed");
        }

        /// Transfer some amount of ERC20 to the given starknet address.
        fn _transfer_to(self: @ContractState, to: ContractAddress, amount: u256) {
            let asset_address = self.ERC20.read();
            let ERC20 = IERC20Dispatcher { contract_address: asset_address };
            let response = ERC20.transfer(to, amount);
            assert!(response, "ERC20 transfer failed");
        }

        /// Returns the ERC20 equivalent of the given Tongo amount.
        ///
        /// ERC20_amount = Tongo_amount*rate
        fn _unwrap_tongo_amount(self: @ContractState, amount: u128) -> u256 {
            let rate = self.rate.read();
            return (amount.into() * rate);
        }

        fn _get_general_prefix_data(self: @ContractState, ledger: ContractAddress) -> GeneralPrefixData {
            let chain_id = get_tx_info().unbox().chain_id;
            let sender_address = get_caller_address();

            GeneralPrefixData { chain_id, tongo_address: ledger, sender_address }
        }


        fn _handle_audit_balance(
            ref self: ContractState, ledger: ContractAddress, y: PubKey, nonce: u64, audit: Option<Audit>,
        ) {
            assert!(audit.is_some(), "You must declare your balance");
            let Audit { auditedBalance, proof: auditProof, hint } = audit.unwrap();

            let Ledger = ILedgerDispatcher {contract_address: ledger};

            let auditorPubKey = Ledger.get_auditor_key().unwrap();
            let storedBalance = Ledger.get_balance(y);
            let prefix_data = self._get_general_prefix_data(ledger);

            let inputs: InputsAudit = InputsAudit {
                y, auditorPubKey, storedBalance, auditedBalance, prefix_data,
            };
            verify_audit(inputs, auditProof);

            Ledger.set_audit(y, auditedBalance);
            Ledger.overwrite_audit_hint(y, hint);

            //TODO: emit event
        }


        fn _handle_relayed_withdraw(
            self: @ContractState, amount: u128, to: ContractAddress, fee_to_sender: u128,
        ) {
            assert!(fee_to_sender <= amount, "Fee Amount to high");
            let amount_after_fee = amount - fee_to_sender;
            self._transfer_to(to, self._unwrap_tongo_amount(amount_after_fee));
            self._transfer_to(get_caller_address(), self._unwrap_tongo_amount(fee_to_sender));
        }

        /// Verifies the given Audit with the zk proof are valid.
        ///
        /// Emits TransferDeclared Event
        fn _handle_audit_transfer(
            ref self: ContractState,
            ledger: ContractAddress,
            from: PubKey,
            nonce: u64,
            to: PubKey,
            transferBalance: CipherBalance,
            audit: Option<Audit>,
        ) {
            let Ledger = ILedgerDispatcher {contract_address: ledger};
            assert!(audit.is_some(), "You must declare your balance");
            let Audit { auditedBalance, proof, hint: _ } = audit.unwrap();
            let auditorPubKey = Ledger.get_auditor_key().unwrap();
            let prefix_data = self._get_general_prefix_data(ledger);
            let inputs: InputsAudit = InputsAudit {
                y: from, auditorPubKey, storedBalance: transferBalance, auditedBalance, prefix_data,
            };
            verify_audit(inputs, proof);

            //TODO: Emit Event
        }
    }
}
