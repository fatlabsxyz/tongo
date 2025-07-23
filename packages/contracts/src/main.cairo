use starknet::ContractAddress;
use crate::ae_balance::AEBalance;
use crate::verifier::structs::{
    AEHints, CipherBalance, Fund, PubKey, Rollover, Transfer, Withdraw, WithdrawAll,
};

#[derive(Serde, Drop, Debug, Copy)]
pub struct State {
    balance: Option<CipherBalance>,
    pending: Option<CipherBalance>,
    audit: Option<CipherBalance>,
    nonce: u64,
    ae_balance: Option<AEBalance>,
    ae_audit_balance: Option<AEBalance>,
}

#[starknet::interface]
pub trait ITongo<TContractState> {
    fn fund(ref self: TContractState, fund: Fund);
    fn rollover(ref self: TContractState, rollover: Rollover);
    fn withdraw_all(ref self: TContractState, withdraw_all: WithdrawAll);
    fn withdraw(ref self: TContractState, withdraw: Withdraw);
    fn transfer(ref self: TContractState, transfer: Transfer);
    fn get_balance(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_audit(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_pending(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_nonce(self: @TContractState, y: PubKey) -> u64;
    fn ERC20(self: @TContractState) -> ContractAddress;
    fn get_state(self: @TContractState, y: PubKey) -> State;
    fn change_auditor_key(ref self: TContractState, new_auditor_key:PubKey);
    fn auditor_key(self: @TContractState) -> PubKey;
}

#[starknet::contract]
pub mod Tongo {
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::ae_balance::{AEBalance, IntoOptionAEBalance};
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::verifier::structs::{
        CipherBalance, CipherBalanceTrait, InputsFund, InputsTransfer, InputsWithdraw,
        IntoOptionCipherBalance, PubKey, StarkPoint, Validate,
    };
    use crate::verifier::verifier::{
        verify_fund, verify_transfer, verify_withdraw, verify_withdraw_all,
    };
    use super::{AEHints, Fund, Rollover, State, Transfer, Withdraw, WithdrawAll};

    #[storage]
    // The storage of the balance is a map: G --> G\timesG with y --> (L,R). The curve points are
    // stored in the form (x,y). Reading an empty y gives a default value of ((0,0), (0,0)) wich are
    // not curve points TODO: it would be nice to set te default value to curve points like  (y,g)
    struct Storage {
        balance: Map<PubKey, CipherBalance>,
        audit_balance: Map<PubKey, CipherBalance>,
        ae_balance: Map<PubKey, AEBalance>,
        ae_audit_balance: Map<PubKey, AEBalance>,
        pending: Map<PubKey, CipherBalance>,
        nonce: Map<PubKey, u64>,
        auditor_key: PubKey,
        owner: ContractAddress,
        ERC20: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, auditor_key: PubKey, ERC20:ContractAddress) {
        self.owner.write(owner);
        self.auditor_key.write(auditor_key);
        self.ERC20.write(ERC20);
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TransferEvent: TransferEvent,
        FundEvent: FundEvent,
        RolloverEvent: RolloverEvent,
        WithdrawEvent: WithdrawEvent,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransferEvent {
        #[key]
        pub to: PubKey,
        #[key]
        pub from: PubKey,
        #[key]
        pub nonce: u64,
        pub cipherbalance: CipherBalance,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FundEvent {
        #[key]
        pub to: PubKey,
        #[key]
        pub nonce: u64,
        pub amount: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RolloverEvent {
        #[key]
        pub to: PubKey,
        #[key]
        pub nonce: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawEvent {
        #[key]
        pub from: PubKey,
        #[key]
        pub nonce: u64,
        pub amount: u64,
        pub to: ContractAddress,
    }

    #[abi(embed_v0)]
    impl TongoImpl of super::ITongo<ContractState> {
        fn rollover(ref self: ContractState, rollover: Rollover) {
            rollover.validate();
            let Rollover { to, proof } = rollover;
            let nonce = self.get_nonce(to);
            let inputs: InputsFund = InputsFund { y: to, nonce: nonce };
            verify_fund(inputs, proof);
            self.pending_to_balance(to);
            self.increase_nonce(to);
            self.emit(RolloverEvent { to, nonce });
        }

        /// Transfer some STARK to Tongo contract and assing some Tongo to account y
        fn fund(ref self: ContractState, fund: Fund) {
            fund.validate();
            let Fund { to, amount, proof, ae_hints } = fund;
            let nonce = self.get_nonce(to);

            let inputs: InputsFund = InputsFund { y: to, nonce: nonce };
            verify_fund(inputs, proof);

            //get the transfer amount from the sender
            //TODO: Check Allowance
            self.get_transfer(amount);

            let cipher = CipherBalanceTrait::new(to, amount, 'fund');
            self.add_balance(to, cipher);

            let cipher_audit = CipherBalanceTrait::new(self.auditor_key.read(), amount, 'fund');
            self.add_audit(to, cipher_audit);

            self.overwrite_ae_balances(to, ae_hints);
            self.increase_nonce(to);
            self.emit(FundEvent { to, amount: amount.try_into().unwrap(), nonce });
        }

        /// Withdraw some tongo from acount and send the stark to the recipient
        fn withdraw(ref self: ContractState, withdraw: Withdraw) {
            withdraw.validate();
            let Withdraw { from, amount, to, proof, ae_hints } = withdraw;

            let balance = self.get_balance(from);

            let nonce = self.get_nonce(from);
            let inputs: InputsWithdraw = InputsWithdraw {
                y: from, amount, nonce, to, L: balance.CL, R: balance.CR,
            };
            verify_withdraw(inputs, proof);

            let cipher = CipherBalanceTrait::new(from, amount, 'withdraw');
            self.remove_balance(from, cipher);

            let cipher = CipherBalanceTrait::new(self.auditor_key.read(), amount, 'withdraw');
            self.remove_audit(from, cipher);
            self.increase_nonce(from);

            self.transfer_to(to, amount);
            self.overwrite_ae_balances(from, ae_hints);
            self.emit(WithdrawEvent { from, amount: amount.try_into().unwrap(), to, nonce });
        }

        /// Withdraw ALL tongo from acount and send the stark to the recipient
        fn withdraw_all(ref self: ContractState, withdraw_all: WithdrawAll) {
            withdraw_all.validate();
            let WithdrawAll { from, amount, to, proof, ae_hints } = withdraw_all;

            //TODO: The recipient ContractAddress has to be signed by x otherwhise the proof can be
            //frontruned.
            let balance = self.get_balance(from);
            let nonce = self.get_nonce(from);
            let inputs: InputsWithdraw = InputsWithdraw {
                y: from, amount, nonce, to, L: balance.CL, R: balance.CR,
            };
            verify_withdraw_all(inputs, proof);

            let cipher = CipherBalanceTrait::new(self.auditor_key.read(), amount, 'withdraw');
            self.remove_audit(from, cipher);
            self.increase_nonce(from);

            //TODO: Revisar esto
            self
                .balance
                .entry(from)
                .write(
                    CipherBalance { CL: StarkPoint { x: 0, y: 0 }, CR: StarkPoint { x: 0, y: 0 } },
                );
            self.overwrite_ae_balances(from, ae_hints);

            self.transfer_to(to, amount);
            self.emit(WithdrawEvent { from, amount: amount.try_into().unwrap(), to, nonce });
        }

        /// Transfer the amount encoded in L, L_bar from "from" to "to". The proof has to be done
        /// w.r.t the balance stored in Balance plus Pending and to the nonce stored in the
        /// contract.
        fn transfer(ref self: ContractState, transfer: Transfer) {
            transfer.validate();
            let Transfer { from, to, L, L_bar, L_audit, R, proof, ae_hints } = transfer;

            let balance = self.get_balance(from);
            let nonce = self.get_nonce(from);

            let inputs: InputsTransfer = InputsTransfer {
                y: from,
                y_bar: to,
                nonce: nonce,
                CL: balance.CL,
                CR: balance.CR,
                R: R,
                L: L,
                L_bar: L_bar,
                L_audit: L_audit,
                y_audit: self.auditor_key(),
            };

            verify_transfer(inputs, proof);

            // verificar la prueva with respect to balance + pending

            self.remove_balance(from, CipherBalance { CL: L, CR: R });

            //TODO: Acomodar el audit
            self.remove_audit(from, CipherBalance { CL: L_audit, CR: R });

            self.add_pending(to, CipherBalance { CL: L_bar, CR: R });
            //TODO: Acomodar el audit
            self.add_audit(to, CipherBalance { CL: L_audit, CR: R });
            self.increase_nonce(from);
            self.overwrite_ae_balances(from, ae_hints);
            self
                .emit(
                    TransferEvent {
                        to, from, nonce, cipherbalance: CipherBalance { CL: L, CR: R },
                    },
                )
        }

        fn ERC20(self: @ContractState) -> ContractAddress {
            self.ERC20.read()
        }

        fn get_nonce(self: @ContractState, y: PubKey) -> u64 {
            y.validate();
            self.nonce.entry(y).read()
        }

        /// Returns the cipher balance of the given public key y. The cipher balance consist in two
        /// points of the stark curve. (L,R) = ((Lx, Ly), (Rx, Ry )) = (g**b y**r , g**r) for some
        /// random r.
        fn get_balance(self: @ContractState, y: PubKey) -> CipherBalance {
            self.balance.entry(y).read()
        }

        fn get_audit(self: @ContractState, y: PubKey) -> CipherBalance {
            self.audit_balance.entry(y).read()
        }

        fn get_pending(self: @ContractState, y: PubKey) -> CipherBalance {
            self.pending.entry(y).read()
        }

        fn get_state(self: @ContractState, y: PubKey) -> State {
            let balance = IntoOptionCipherBalance::into(self.balance.entry(y).read());
            let pending = IntoOptionCipherBalance::into(self.pending.entry(y).read());
            let audit = IntoOptionCipherBalance::into(self.audit_balance.entry(y).read());
            let nonce = self.nonce.entry(y).read();
            let ae_balance = IntoOptionAEBalance::into(self.ae_balance.entry(y).read());
            let ae_audit_balance = IntoOptionAEBalance::into(self.ae_audit_balance.entry(y).read());
            return State { balance, pending, audit, nonce, ae_balance, ae_audit_balance };
        }

        fn change_auditor_key(ref self: ContractState, new_auditor_key:PubKey) {
            assert!(get_caller_address() == self.owner.read(), "Caller not owner");
            self.auditor_key.write(new_auditor_key);
        }

        fn auditor_key(self: @ContractState) -> PubKey {
            self.auditor_key.read()
        }
    }

    #[generate_trait]
    pub impl PrivateImpl of IPrivate {
        fn add_balance(ref self: ContractState, y: PubKey, new_balance: CipherBalance) {
            let old_balance = self.balance.entry(y).read();
            if old_balance.is_zero() {
                self.balance.entry(y).write(new_balance);
            } else {
                let sum = old_balance.add(new_balance);
                self.balance.entry(y).write(sum);
            }
        }

        fn remove_balance(ref self: ContractState, y: PubKey, new_balance: CipherBalance) {
            let old_balance = self.balance.entry(y).read();
            if old_balance.is_zero() {
                self.balance.entry(y).write(new_balance);
            } else {
                let sum = old_balance.remove(new_balance);
                self.balance.entry(y).write(sum);
            }
        }

        fn add_pending(ref self: ContractState, y: PubKey, new_pending: CipherBalance) {
            let old_pending = self.pending.entry(y).read();
            if old_pending.is_zero() {
                self.pending.entry(y).write(new_pending);
            } else {
                let sum = old_pending.add(new_pending);
                self.pending.entry(y).write(sum);
            }
        }

        fn pending_to_balance(ref self: ContractState, y: PubKey) {
            let pending = self.pending.entry(y).read();
            if pending.is_zero() {
                return;
            }
            self.add_balance(y, pending);
            self
                .pending
                .entry(y)
                .write(
                    CipherBalance { CL: StarkPoint { x: 0, y: 0 }, CR: StarkPoint { x: 0, y: 0 } },
                );
        }


        fn add_audit(ref self: ContractState, y: PubKey, new_audit: CipherBalance) {
            let old_audit = self.audit_balance.entry(y).read();
            if old_audit.is_zero() {
                self.audit_balance.entry(y).write(new_audit);
            } else {
                let sum = old_audit.add(new_audit);
                self.audit_balance.entry(y).write(sum);
            }
        }

        fn remove_audit(ref self: ContractState, y: PubKey, new_audit: CipherBalance) {
            let old_audit = self.audit_balance.entry(y).read();
            if old_audit.is_zero() {
                self.audit_balance.entry(y).write(new_audit);
            } else {
                let sum = old_audit.remove(new_audit);
                self.audit_balance.entry(y).write(sum);
            }
        }

        fn get_transfer(self: @ContractState, amount: felt252) {
            let asset_address =  self.ERC20.read();
            let ERC20 = IERC20Dispatcher { contract_address: asset_address};
            ERC20.transfer_from(get_caller_address(), get_contract_address(), amount.into());
        }

        fn transfer_to(self: @ContractState, to: ContractAddress, amount: felt252) {
            let asset_address =  self.ERC20.read();
            let ERC20 = IERC20Dispatcher { contract_address: asset_address};
            ERC20.transfer(to, amount.into());
        }

        fn increase_nonce(ref self: ContractState, y: PubKey) {
            let mut nonce = self.nonce.entry(y).read();
            nonce = nonce + 1;
            self.nonce.entry(y).write(nonce);
        }

        fn overwrite_ae_balances(ref self: ContractState, y: PubKey, ae_hints: AEHints) {
            self.ae_balance.entry(y).write(ae_hints.ae_balance);
            self.ae_audit_balance.entry(y).write(ae_hints.ae_audit_balance);
        }
    }
}
