#[starknet::contract]
pub mod Ledger {
    use core::ec::NonZeroEcPoint;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_tx_info, get_contract_address};
    use crate::structs::aecipher::{AEBalance, IntoOptionAEBalance};
    use crate::structs::common::cipherbalance::{CipherBalance, CipherBalanceTrait};
    use crate::structs::common::pubkey::PubKey;
    use crate::structs::common::state::State;
    use crate::structs::events::{ AuditorPubKeySet };
    use crate::structs::traits::GeneralPrefixData;
    use crate::tongo::ILedger::ILedger;


    #[storage]
    struct Storage {
        /// The contract address that is owner of the Tongo instance.
        owner: ContractAddress,
        /// The Tongo Global contract this ledger is part of.
        global_tongo: ContractAddress,
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
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        auditor_key: Option<PubKey>,
    ) {
        self.owner.write(owner);
        
        self.global_tongo.write(get_caller_address());

        if let Some(key) = auditor_key {
            self._set_auditor_key(key);
        }
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        AuditorPubKeySet: AuditorPubKeySet,
    }


    #[abi(embed_v0)]
    impl LedgerImpl of ILedger<ContractState> {
        /// Returns the contract address of the owner of the Tongo account.
        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
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

        fn get_global_tongo(self: @ContractState) -> ContractAddress {
            self.global_tongo.read()
        }

        /// Returns the current auditor public key.
        fn get_auditor_key(self: @ContractState) -> Option<PubKey> {
            self.auditor_key.read()
        }

        /// Rotates the current auditor public key.
        fn change_auditor_key(ref self: ContractState, new_auditor_key: PubKey) {
            assert!(get_caller_address() == self.owner.read(), "Caller is not owner");
            assert!(
                self.auditor_key.read().is_some(), "This contract was deployed without an auditor",
            );
            self._set_auditor_key(new_auditor_key);
        }

        fn add_to_account_balance(ref self: ContractState, to: PubKey, new_balance: CipherBalance) {
            //only global
            self._add_balance(to, new_balance);
        }

        fn subtract_from_account_balance(ref self: ContractState, to: PubKey, new_balance: CipherBalance) {
            //only global
            self._subtract_balance(to, new_balance);
        }

        fn reset_account_balance(ref self: ContractState, to: PubKey) {
            //only global
            let zero_balance: CipherBalance = CipherBalanceTrait::new(to, 0, 1);
            self.balance.entry(to).write(zero_balance.into());
        }

        fn pending_to_balance(ref self: ContractState, to:PubKey) {
            //only global
            self._pending_to_balance(to);
        }

        fn add_to_account_pending(ref self: ContractState, to: PubKey, new_balance: CipherBalance) {
            //only global
            self._add_pending(to, new_balance);
        }

        fn overwrite_hint(ref self: ContractState, to: PubKey, hint: AEBalance) {
            //only global
            self._overwrite_hint(to,hint);
        }

        fn increase_nonce(ref self: ContractState, to: PubKey) {
            //only global
            self._increase_nonce(to);
        }

        fn set_audit(ref self: ContractState, y: PubKey, new_audit: CipherBalance) {
            //only global
            self._set_audit(y, new_audit);
        }

        fn overwrite_audit_hint(ref self: ContractState, y: PubKey, hint: AEBalance) {
            //only global
            self._overwrite_audit_hint(y, hint);
        }
    }

    #[generate_trait]
    pub impl PrivateImpl of IPrivate {
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

        fn _overwrite_hint(ref self: ContractState, to: PubKey, hint: AEBalance) {
            self.ae_balance.entry(to).write(hint);
        }

        /// Overwrite the AE hint for the auditor of the given account for the given one.
        fn _overwrite_audit_hint(ref self: ContractState, y: PubKey, hint: AEBalance) {
            self.ae_audit_balance.entry(y).write(hint);
        }

        fn _get_general_prefix_data(self: @ContractState) -> GeneralPrefixData {
            let chain_id = get_tx_info().unbox().chain_id;
            let ledger_address = get_contract_address();
            let sender_address = get_caller_address();

            GeneralPrefixData { chain_id, tongo_address: ledger_address, sender_address }
        }
    }
}
