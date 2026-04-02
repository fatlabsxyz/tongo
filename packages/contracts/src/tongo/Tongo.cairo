#[starknet::contract]
pub mod Tongo {
    use core::{ec::NonZeroEcPoint, num::traits::Bounded};
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_tx_info};
    use crate::structs::{
        aecipher::{AEBalance, IntoOptionAEBalance},
        common::{
            cipherbalance::{CipherBalance, CipherBalanceTrait},
            pubkey::PubKey,
            state::{State, TongoConfig},
        },
    };
    use crate::structs::events::{
        AuditorPubKeySet, BalanceDeclared, FundEvent, OutsideFundEvent, RagequitEvent,
        RolloverEvent, TransferDeclared, TransferEvent, WithdrawEvent, ReceivedExternalTransfer,
    };
    use crate::structs::operations::{
        audit::{Audit, InputsAudit},
        fund::{Fund, InputsFund, OutsideFund},
        ragequit::{InputsRagequit, Ragequit, RagequitOptions, SerializeRagequitOptions},
        rollover::{InputsRollOver, Rollover},
        transfer::{InputsTransfer, Transfer, ExternalTransfer, ExternalData, TransferOptions, SerializeTransferOptions},
        withdraw::{InputsWithdraw, Withdraw, WithdrawOptions, SerializeWithdrawOptions},
    };
    use crate::structs::traits::GeneralPrefixData;
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::tongo::{
        ITongo::{ITongo, ITongoDispatcher, ITongoDispatcherTrait},
        IVault::{IVaultDispatcher, IVaultDispatcherTrait},
    };
    use crate::verifier::{
        audit::verify_audit,
        fund::verify_fund,
        ragequit::verify_ragequit,
        rollover::verify_rollover,
        transfer::verify_transfer,
        withdraw::verify_withdraw,
    };

    #[storage]
    struct Storage {
        /// The contract address that is owner of the Tongo instance.
        owner: ContractAddress,
        /// The Vault contract this Tongo instantes is going to interact with.
        vault: ContractAddress,
        /// The tag this contract is registered with.
        tag: felt252,
        /// The contract address of the ERC20 that Tongo is wrapping.
        ERC20: ContractAddress,
        /// The conversion  rage between the wrapped ERC20 and tongo:
        ///
        /// ERC20_amount = Tongo_amount*rate
        rate: u256,
        /// The bit size this contract will work with. This limites the values that cant be proven
        /// by a range proof. If is set to 32 that means that range proof will only work for values
        /// between 0 and 2**32-1.
        /// Note: The computational cost of verifying a tranfers operation (the most expensive one)
        /// is about (30 + 10*n) ec_muls and (20 + 8n) ec_adds, where n is the bit_size
        bit_size: u32,
        /// The encrypted balance for the given pubkey.
        balance: Map<PubKey, CipherBalance>,
        /// The encrypted pending balance for the given pubkey. The pending balance is the sum of
        /// incoming transfer. User has to execute a rollover operation to convert this to usable
        /// balance.
        pending: Map<PubKey, CipherBalance>,
        /// The nonce of the given pubkey. Nonce is increased in every user operation.
        nonce: Map<PubKey, u64>,
        /// Hint to fast decrypt the balance of the given pubkey. This encrypts the same amount that
        /// is stored in `balance`. It is neither check nor enforced by the protocol, only the the
        /// user can decrypt it with knowledge of the private key and it is only usefull for
        /// attempting a fast decryption of `balance.
        ae_balance: Map<PubKey, AEBalance>,
        /// The balance of the given pubkey enrypted for the auditor key.
        ///
        /// If the contract was deployed witouth an auditor, the map is empty and all keys return
        /// the Default CipherBalance {L: {x:0, y:0}, R:{x:0,y:0}};
        audit_balance: Map<PubKey, CipherBalance>,
        /// Hint to fast decrypt the audited balance of the given pubkey. This encrypts the same
        /// amount that is stored in `audit_balance`. It is neither check nor enforced by the
        /// protocol, only the auditor can decrypt it with knowledge of the auditor private key and
        /// it is only usefull for attempting a fast decryption of `audit_balance`.
        ae_audit_balance: Map<PubKey, AEBalance>,
        /// The auditor pubkey. If the contract was deployed without auditor this will be an
        /// Option::None without a way to change it.
        auditor_key: Option<PubKey>,
        /// The increasing number that identifies the public key
        key_number: u128,
        /// A whitelist of Tongo instances (deployed by the same vault) allowed to interact with this contract
        /// with the external_transfer mechanism. Only the owner of this contract can approve or revoke Tongo instances.
        approvedTongo: Map<ContractAddress, bool>
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        tag: felt252,
        ERC20: ContractAddress,
        rate: u256,
        bit_size: u32,
        auditor_key: Option<PubKey>,
    ) {
        let vault = get_caller_address();
        self.owner.write(owner);
        self.ERC20.write(ERC20);
        self.vault.write(vault);
        self.rate.write(rate);
        self.tag.write(tag);

        assert!(bit_size <= 128_u32, "Bit size should be 128 at max");
        self.bit_size.write(bit_size);

        if let Some(key) = auditor_key {
            self._set_auditor_key(key);
        }

        let ERC20 = IERC20Dispatcher { contract_address: ERC20 };
        ERC20.approve(vault, Bounded::<u256>::MAX);
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TransferEvent: TransferEvent,
        FundEvent: FundEvent,
        OutsideFundEvent: OutsideFundEvent,
        RolloverEvent: RolloverEvent,
        WithdrawEvent: WithdrawEvent,
        RagequitEvent: RagequitEvent,
        BalanceDeclared: BalanceDeclared,
        TransferDeclared: TransferDeclared,
        AuditorPubKeySet: AuditorPubKeySet,
        ReceivedExternalTransfer: ReceivedExternalTransfer,
    }

    #[abi(embed_v0)]
    impl TongoImpl of ITongo<ContractState> {
        /// Returns the complete Setup of this Tongo instance
        fn get_tongo_config(self: @ContractState) -> TongoConfig {
            TongoConfig {
                tag: self.get_tag(),
                address: get_contract_address(),
                ERC20: self.ERC20(),
                owner: self.get_owner(),
                vault: self.get_vault(),
                rate: self.get_rate(),
                bit_size: self.get_bit_size(), 
                auditor_key: self.auditor_key(),
            }
        }

        /// Returns the address of the Vault that deployed this Tongo instance
        fn get_vault(self: @ContractState) -> ContractAddress {
            self.vault.read()
        }

        /// Returns the Tag this contract is registered with.
        fn get_tag(self: @ContractState) -> felt252 {
            self.tag.read()
        }

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

        /// Returns the contract address of the owner of the Tongo account.
        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        /// Funds a tongo account. Callable only by the account owner
        ///
        /// Emits FundEvent
        fn fund(ref self: ContractState, fund: Fund) {
            let Fund { to, amount, proof,  auditPart, hint } = fund;
            let nonce = self.get_nonce(to);
            let prefix_data = _get_general_prefix_data();

            let inputs: InputsFund = InputsFund { 
                y: to,
                nonce,
                amount,
                prefix_data
            };

            verify_fund(inputs, proof);

            self._transfer_from_caller(self._unwrap_tongo_amount(amount));
            self._send_to_vault(self._unwrap_tongo_amount(amount));

            let cipher = CipherBalanceTrait::new(to, amount.into(), 'fund');
            self._add_balance(to, cipher);
            self._overwrite_hint(to, hint);
            self
                .emit(
                    FundEvent {
                        to, amount: amount.try_into().unwrap(), from: get_caller_address(), nonce,
                    },
                );

            if let Some(auditorKey) = self.auditor_key.read() {
                self._handle_audit_balance(to, nonce, auditorKey, auditPart, prefix_data);
            }

            self._increase_nonce(to);
        }

        /// Funds a tongo acount. Can be called without knowledge of the pk.
        ///
        /// Emits OutsideFundEvent
        fn outside_fund(ref self: ContractState, outsideFund: OutsideFund) {
            let OutsideFund { to, amount } = outsideFund;

            self._transfer_from_caller(self._unwrap_tongo_amount(amount));
            self._send_to_vault(self._unwrap_tongo_amount(amount));

            let cipher = CipherBalanceTrait::new(to, amount.into(), 'outsideFund');
            self._add_pending(to, cipher);
            self.emit(OutsideFundEvent { to, amount, from: get_caller_address() });
        }

        /// Withdraw Tongos and send the ERC20 to a starknet address.
        ///
        /// Emits WithdrawEvent
        fn withdraw(ref self: ContractState, withdraw: Withdraw, withdraw_options: Option<WithdrawOptions>) {
            let Withdraw {
                from, amount, to, proof, auditPart, hint, auxiliarCipher,
            } = withdraw;

            let data = withdraw_options.serialize_data();

            let  relayData = match withdraw_options {
                None => None,
                Some(o) => o.relayData,
            };

            if let Some(relay) = relayData {
                self._withdraw_from_vault(self._unwrap_tongo_amount(relay.fee_to_sender));
                self._transfer_to(get_caller_address(), self._unwrap_tongo_amount(relay.fee_to_sender));
                let cipher = CipherBalanceTrait::new(from, relay.fee_to_sender.into(), 'fee');
                self._subtract_balance(from, cipher);
            }

            let currentBalance = self.get_balance(from);
            let nonce = self.get_nonce(from);
            let prefix_data = _get_general_prefix_data();
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
                data,
            };
            verify_withdraw(inputs, proof);

            let mut cipher = CipherBalanceTrait::new(from, amount.into(), 'withdraw');
            self._subtract_balance(from, cipher);
            self._overwrite_hint(from, hint);

            self._withdraw_from_vault(self._unwrap_tongo_amount(amount));
            self._transfer_to(to, self._unwrap_tongo_amount(amount));

            self.emit(WithdrawEvent { from, amount: amount.try_into().unwrap(), to, nonce });

            if let Some(auditorKey) = self.auditor_key.read() {
                self._handle_audit_balance(from, nonce, auditorKey, auditPart, prefix_data);
            }

            self._increase_nonce(from);
        }

        /// Withdraw all the balance of an account and send the ERC20 to a starknet address. This
        /// proof avoids the limitations of the range prove that are present in the regular
        /// withdraw.
        ///
        /// Emits RagequitEvent
        fn ragequit(ref self: ContractState, ragequit: Ragequit, ragequit_options: Option<RagequitOptions>) {
            let Ragequit { from, amount, to, proof, hint, auditPart} = ragequit;

            let data = ragequit_options.serialize_data();

            let  relayData = match ragequit_options {
                None => None,
                Some(o) => o.relayData,
            };

            if let Some(relay) = relayData {
                self._withdraw_from_vault(self._unwrap_tongo_amount(relay.fee_to_sender));
                self._transfer_to(get_caller_address(), self._unwrap_tongo_amount(relay.fee_to_sender));
                let cipher = CipherBalanceTrait::new(from, relay.fee_to_sender.into(), 'fee');
                self._subtract_balance(from, cipher);
            }

            let currentBalance = self.get_balance(from);
            let nonce = self.get_nonce(from);
            let prefix_data = _get_general_prefix_data();

            let inputs: InputsRagequit = InputsRagequit {
                y: from, amount, nonce, to, currentBalance, prefix_data, data,
            };

            verify_ragequit(inputs, proof);

            let zero_balance: CipherBalance = CipherBalanceTrait::new(from, 0, 1);
            self.balance.entry(from).write(zero_balance.into());
            self._overwrite_hint(from, hint);

            self._withdraw_from_vault(self._unwrap_tongo_amount(amount));
            self._transfer_to(to, self._unwrap_tongo_amount(amount));

            self.emit(RagequitEvent { from, amount: amount.try_into().unwrap(), to, nonce });

            if let Some(auditorKey) = self.auditor_key.read() {
                self._handle_audit_balance(from, nonce, auditorKey, auditPart, prefix_data);
            }

            self._increase_nonce(from);
        }

        /// Transfer Tongos from the balance of the sender to the pending of the receiver
        ///
        /// Emits TransferEvent
        fn transfer(ref self: ContractState, transfer: Transfer, transfer_options: Option<TransferOptions>) {
            let Transfer {
                from,
                to,
                transferBalance,
                transferBalanceSelf,
                auxiliarCipher,
                auxiliarCipher2,
                proof,
                auditPart,
                auditPartTransfer,
                hintTransfer,
                hintLeftover,
            } = transfer;

            let data = transfer_options.serialize_data();

            let (relayData, externalData) = match transfer_options {
                Some(opts) => (opts.relayData, opts.externalData),
                None => (None, None),
            };

            if let Some(relay) = relayData {
                self._withdraw_from_vault(self._unwrap_tongo_amount(relay.fee_to_sender));
                self._transfer_to(get_caller_address(), self._unwrap_tongo_amount(relay.fee_to_sender));
                let cipher = CipherBalanceTrait::new(from, relay.fee_to_sender.into(), 'fee');
                self._subtract_balance(from, cipher);
            }

            let mut currentBalance = self.get_balance(from);
            let nonce = self.get_nonce(from);
            let bit_size = self.get_bit_size();
            let prefix_data = _get_general_prefix_data();

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
                data,
            };
            
            verify_transfer(inputs, proof);
            
            self._subtract_balance(from, transferBalanceSelf);
            self._overwrite_hint(from, hintLeftover);

            let mut toTongo = prefix_data.tongo_address;
            match externalData {
                None => {
                    self._add_pending(to, transferBalance);
                },
                Some(external) => {
                    toTongo = external.toTongo;
                    self._send_external_transfer(from, to, nonce, transferBalance, transferBalanceSelf, hintTransfer, external, prefix_data);
                }
            }

            if let Some(auditor) = self.auditor_key.read() {
                self._handle_audit_balance(from, nonce,auditor, auditPart, prefix_data);
                self._handle_audit_transfer( from, nonce, to,auditor, transferBalanceSelf, auditPartTransfer, prefix_data);
            }

            self.emit(
                TransferEvent {
                    to,
                    from,
                    nonce,
                    toTongo,
                    transferBalance,
                    transferBalanceSelf,
                    hintTransfer,
                    hintLeftover,
                }
            );

            self._increase_nonce(from);
        }

        /// Receive an encrypted transfer from another Tongo contract deployed by the same Vault.
        /// The interaction between these contract has to be approved by the owners.
        ///
        /// Emits ReceivedExternalTransfer
        fn receive_external_transfer(ref self: ContractState, external: ExternalTransfer) {
            let caller = get_caller_address();    
            assert!(self._vault().is_known_tongo(caller), "Caller is not a valid Tongo contract");
            assert!(self.approvedTongo.entry(caller).read(), "Caller is not approved to operate");
            
            let ExternalTransfer {
                fromTongo,
                from,
                nonce,
                to,
                transferBalance,
                hintTransfer,
            } = external;

            self._add_pending(to, transferBalance);
            self.emit(
                ReceivedExternalTransfer {
                    to,
                    from,
                    nonce,
                    fromTongo,
                    transferBalance,
                    hintTransfer,
                }
            );
        }

        /// Moves to the balance the amount stored in the pending. Callable only by the account
        /// owner.
        ///
        /// Emits RolloverEvent
        fn rollover(ref self: ContractState, rollover: Rollover) {
            let Rollover { to, proof, hint } = rollover;
            let nonce = self.get_nonce(to);
            let prefix_data = _get_general_prefix_data();

            let inputs: InputsRollOver = InputsRollOver { y: to, nonce, prefix_data };
            verify_rollover(inputs, proof);
            let rollovered = self.pending.entry(to).read();

            self._pending_to_balance(to);
            self._increase_nonce(to);
            self._overwrite_hint(to, hint);
            self.emit(RolloverEvent { to, nonce, rollovered });
        }

        /// Returns the curretn stored balance of a Tongo account
        fn get_balance(self: @ContractState, y: PubKey) -> CipherBalance {
            self.balance.entry(y).read().handle_null(y).into()
        }

        /// Returns the current pending balance of a Tongo account
        fn get_pending(self: @ContractState, y: PubKey) -> CipherBalance {
            self.pending.entry(y).read().handle_null(y).into()
        }

        /// Return, if the Tongo instance allows, the current declared balance of a Tongo account
        /// for the auditor
        fn get_audit(self: @ContractState, y: PubKey) -> Option<CipherBalance> {
            if self.auditor_key.read().is_none() {
                return Option::<CipherBalance>::None;
            }
            let auditorPubKey = self.auditor_key.read().unwrap();
            Option::Some(self.audit_balance.entry(y).read().handle_null(auditorPubKey).into())
        }

        /// Returns the current nonce of a Tongo account
        fn get_nonce(self: @ContractState, y: PubKey) -> u64 {
            self.nonce.entry(y).read()
        }

        /// Returns the current state of a Tongo account.
        fn get_state(self: @ContractState, y: PubKey) -> State {
            let balance = self.balance.entry(y).read().handle_null(y).into();
            let pending = self.pending.entry(y).read().handle_null(y).into();
            let nonce = self.nonce.entry(y).read();

            let audit = self.get_audit(y);
            let ae_balance = IntoOptionAEBalance::into(self.ae_balance.entry(y).read());
            let ae_audit_balance = IntoOptionAEBalance::into(self.ae_audit_balance.entry(y).read());
            return State { balance, pending, audit, nonce, ae_balance, ae_audit_balance };
        }

        /// Returns the current auditor public key.
        fn auditor_key(self: @ContractState) -> Option<PubKey> {
            self.auditor_key.read()
        }

        /// Rotates the current auditor public key.
        fn change_auditor_key(ref self: ContractState, new_auditor_key: PubKey) {
            self._caller_is_owner();
            assert!(
                self.auditor_key.read().is_some(), "This contract was deployed without an auditor",
            );
            self._set_auditor_key(new_auditor_key);
        }

        /// Approve a Tongo instance deployed by the same Vault to interact with
        /// this contract with the External Transfer mechanism.
        fn approveTongo(ref self: ContractState, address: ContractAddress) {
            self._caller_is_owner();    
            assert!(!self.approvedTongo.entry(address).read(), "Contract allready white-listed");
            assert!(self._vault().is_known_tongo(address), "Target is not a valid Tongo contract");
            self.approvedTongo.entry(address).write(true);
        }

        /// Revoke a previously approved Tongo instance  to interact with
        /// this contract with the External Transfer mechanism.
        fn revokeTongo(ref self: ContractState, address: ContractAddress) {
            self._caller_is_owner();    
            assert!(self.approvedTongo.entry(address).read(), "Contract is not white-listed");
            self.approvedTongo.entry(address).write(false);
        }
    }

    /// Returns the general prefix data. It is only used to compute the prefix and bind this
    /// data to the ZK proof.
    ///TODO: Remove from contract
    fn _get_general_prefix_data() -> GeneralPrefixData {
        let chain_id = get_tx_info().unbox().chain_id;
        let tongo_address = get_contract_address();
        let sender_address = get_caller_address();

        GeneralPrefixData { chain_id, tongo_address, sender_address }
    }


    #[generate_trait]
    impl PrivateImpl of IPrivate {
        /// Adds the given balance to the current balance of the given tongo Account.
        fn _add_balance(ref self: ContractState, y: PubKey, new_balance: CipherBalance) {
            let old_balance = self.get_balance(y);
            let sum = old_balance.add(new_balance.into());
            self.balance.entry(y).write(sum);
        }

        /// Subtract the given balance to the current balance of the given Tongo account.
        fn _subtract_balance(ref self: ContractState, y: PubKey, new_balance: CipherBalance) {
            let old_balance = self.get_balance(y);
            let sum = old_balance.subtract(new_balance.into());
            self.balance.entry(y).write(sum);
        }

        /// Adds the given balance to the current pending state of the given Tongo account.
        fn _add_pending(ref self: ContractState, y: PubKey, new_pending: CipherBalance) {
            let old_pending = self.get_pending(y);
            let sum = old_pending.add(new_pending.into());
            let balance = self.get_balance(y);

            self._assert_is_rollovereable(balance, sum);

            self.pending.entry(y).write(sum);
        }

        /// Assert the pending balance can be safely add to the balance. This is to avoid a tipe of
        /// attack in which a malicious actor who knows the random of the cipherbalance (usually
        /// after a fund/ragequit)
        /// can transfer with a randomness constructed to temporally block a rollover.
        fn _assert_is_rollovereable(
            self: @ContractState, balance: CipherBalance, pending: CipherBalance,
        ) {
            let (L_pending, R_pending) = pending.points();
            let (L_balance, R_balance) = balance.points();
            let R_sum: Option<NonZeroEcPoint> = (R_pending + R_balance).try_into();
            let L_sum: Option<NonZeroEcPoint> = (L_pending + L_balance).try_into();
            assert!(R_sum.is_some(), "R not Rollovereable");
            assert!(L_sum.is_some(), "L not Rollovereable");
        }

        /// Adds the pending balance to the current balance of the given Tongo account
        /// sets the pending to 0.
        fn _pending_to_balance(ref self: ContractState, y: PubKey) {
            let pending = self.pending.entry(y).read();
            if pending.is_null() {
                return;
            }
            self._add_balance(y, pending.into());
            self.pending.entry(y.into()).write(CipherBalanceTrait::null());
        }

        /// Overwrites the current audited cipherBalance to the the given one.
        fn _set_audit(ref self: ContractState, y: PubKey, new_audit: CipherBalance) {
            self.audit_balance.entry(y).write(new_audit.into());
        }

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

        /// Sends ERC20 to the Vault
        fn _send_to_vault(self: @ContractState, amount: u256) {
            self._vault().deposit(amount)
        }
        
        fn _withdraw_from_vault(self: @ContractState, amount: u256) {
            self._vault().withdraw(amount)
        }

        /// Increases the nonce of the given Tongo account.
        fn _increase_nonce(ref self: ContractState, y: PubKey) {
            let mut nonce = self.nonce.entry(y).read();
            nonce = nonce + 1;
            self.nonce.entry(y).write(nonce);
        }

        /// Overwrites the auditor pub key and increases key_number
        fn _set_auditor_key(ref self: ContractState, newAuditorKey: PubKey) {
            let keyNumber = self.key_number.read() + 1_u128;
            self.auditor_key.write(Option::Some(newAuditorKey));
            self.emit(AuditorPubKeySet { keyNumber, AuditorPubKey: newAuditorKey });
            self.key_number.write(keyNumber);
        }

        /// Overwrite the AE hint of the given account for the given one.
        fn _overwrite_hint(ref self: ContractState, y: PubKey, hint: AEBalance) {
            self.ae_balance.entry(y).write(hint);
        }

        /// Overwrite the AE hint for the auditor of the given account for the given one.
        fn _overwrite_audit_hint(ref self: ContractState, y: PubKey, hint: AEBalance) {
            self.ae_audit_balance.entry(y).write(hint);
        }

        /// Asserts the calles is the owner of the contract
        fn _caller_is_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert!(caller == self.owner.read(), "Caller is not the Owner");
        }

        /// Returns the ERC20 equivalent of the given Tongo amount.
        ///
        /// ERC20_amount = Tongo_amount*rate
        fn _unwrap_tongo_amount(self: @ContractState, amount: u128) -> u256 {
            let rate = self.rate.read();
            return (amount.into() * rate);
        }

        /// Verifies the given Audit with the zk proof are valid. Overwrites the audit Balance
        /// and emits BalanceDeclared Event
        fn _handle_audit_balance(
            ref self: ContractState,
            y:PubKey,
            nonce:u64,
            auditorPubKey:PubKey,
            audit: Option<Audit>,
            prefix_data: GeneralPrefixData,
        ) {
            assert!(audit.is_some(), "You must declare your balance");
            let Audit { auditedBalance, proof: auditProof, hint } = audit.unwrap();

            let storedBalance = self.get_balance(y);
            let inputs: InputsAudit = InputsAudit {
                y, auditorPubKey, storedBalance, auditedBalance, prefix_data,
            };
            verify_audit(inputs, auditProof);

            self._set_audit(y, auditedBalance);
            self._overwrite_audit_hint(y, hint);
            self
                .emit(
                    BalanceDeclared {
                        from: y, nonce, auditorPubKey, declaredCipherBalance: auditedBalance, hint,
                    },
                );
        }

        /// Verifies the given Audit with the zk proof are valid.
        ///
        /// Emits TransferDeclared Event
        fn _handle_audit_transfer(
            ref self: ContractState,
            from: PubKey,
            nonce: u64,
            to: PubKey,
            auditorPubKey: PubKey,
            transferBalance: CipherBalance,
            audit: Option<Audit>,
            prefix_data: GeneralPrefixData,
        ) {
            assert!(audit.is_some(), "You must declare your balance");
            let Audit { auditedBalance, proof, hint } = audit.unwrap();
            let inputs: InputsAudit = InputsAudit {
                y: from, auditorPubKey, storedBalance: transferBalance, auditedBalance, prefix_data,
            };
            verify_audit(inputs, proof);

            self
                .emit(
                    TransferDeclared {
                        from, to, nonce, auditorPubKey, declaredCipherBalance: auditedBalance, hint,
                    },
                );
        }

        /// Verifies that, in an external transfer, the given Audit proof is valid for the 
        /// auditor of the target Tongo instance.
        fn _handle_external_transfer_audit(
            self: @ContractState,
            from: PubKey,
            nonce: u64,
            to: PubKey,
            auditorPubKey: PubKey,
            transferBalance: CipherBalance,
            audit: Option<Audit>,
            prefix_data: GeneralPrefixData,
        ) {
            assert!(audit.is_some(), "You must declare your balance");
            let Audit { auditedBalance, proof, hint: _ } = audit.unwrap();
            let inputs: InputsAudit = InputsAudit {
                y: from, auditorPubKey, storedBalance: transferBalance, auditedBalance, prefix_data,
            };
            verify_audit(inputs, proof);
        }


        /// Handles the withdraw (and ragequit) asset transfers. 
        fn _handle_relayed_withdraw(
            self: @ContractState, amount: u128, to: ContractAddress, fee_to_sender: u128,
        ) {
            assert!(fee_to_sender <= amount, "Fee Amount to high");
            let amount_after_fee = amount - fee_to_sender;
            self._transfer_to(to, self._unwrap_tongo_amount(amount_after_fee));
            self._transfer_to(get_caller_address(), self._unwrap_tongo_amount(fee_to_sender));
        }

        /// Sends the external transfer operation to another Tongo instance
        fn _send_external_transfer(
            ref self: ContractState,
            from: PubKey,
            to: PubKey,
            nonce: u64,
            transferBalance: CipherBalance,
            transferBalanceSelf: CipherBalance,
            hintTransfer: AEBalance,
            externalData: ExternalData,
            prefix_data: GeneralPrefixData,
        ) {
            let ExternalData {toTongo,  auditPart} = externalData;
            assert!( toTongo != get_contract_address(), "External tranfer to same instances are not allowed")
            assert!(self.approvedTongo.entry(toTongo).read(), "Target Tongo instance is not approved");
            let targetTongo = ITongoDispatcher {contract_address: toTongo};

            let target_prefix_data = GeneralPrefixData {
                tongo_address: toTongo, 
                ..prefix_data,
            };

            if let Some(targetAuditor) = targetTongo.auditor_key() {
                self._handle_external_transfer_audit(from, nonce, to, targetAuditor,transferBalanceSelf,auditPart, target_prefix_data )    
            }

            let external = ExternalTransfer {
                fromTongo: get_contract_address(),
                from,
                nonce,
                to,
                transferBalance,
                hintTransfer,
            };

            targetTongo.receive_external_transfer(external);
        }

        fn _vault(self: @ContractState) -> IVaultDispatcher {
            return IVaultDispatcher {contract_address: self.vault.read()};
        }
    }
}
