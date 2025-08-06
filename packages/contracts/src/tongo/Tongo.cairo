
#[starknet::contract]
pub mod Tongo {
    //TODO: Decidir en donde meter STate
    use crate::tongo::ITongo::{ITongo, State};
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::structs::aecipher::{AEBalance, IntoOptionAEBalance, AEHints};
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::structs::common::{
        cipherbalance::{CipherBalance, CipherBalanceTrait},
        pubkey::PubKey,
    };
    use crate::structs::operations::{
        fund::{InputsFund, Fund},
        withdraw::{InputsWithdraw, Withdraw},
        transfer::{InputsTransfer, Transfer},
        ragequit::{InputsRagequit, Ragequit},
        rollover::{InputsRollOver, Rollover},
    };
    use crate::verifier::verifier::{
        verify_fund, verify_transfer, verify_withdraw, verify_ragequit,verify_rollover
    };
    use crate::structs::events::{TransferEvent, FundEvent, RolloverEvent, WithdrawEvent, RagequitEvent};

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
        auditor_key:PubKey,
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
        RagequitEvent: RagequitEvent,
    }


    #[abi(embed_v0)]
    impl TongoImpl of ITongo<ContractState> {
        //TODO: update the rolloverproof to emit audit 
        fn rollover(ref self: ContractState, rollover: Rollover) {
            let Rollover { to, proof } = rollover;
            let nonce = self.get_nonce(to);
            let inputs: InputsRollOver = InputsRollOver { y: to, nonce: nonce };
            verify_rollover(inputs, proof);
            self.pending_to_balance(to);
            self.increase_nonce(to);
            self.emit(RolloverEvent { to, nonce });
        }

        /// Transfer some STARK to Tongo contract and assing some Tongo to account y
        fn fund(ref self: ContractState, fund: Fund) {
            let Fund { to, amount, proof, ae_hints, auditedBalance, auxBalance} = fund;
            let nonce = self.get_nonce(to);
            let currentBalance = self.get_balance(to);
            let auditorPubKey = self.auditor_key();

            let inputs: InputsFund = InputsFund { y: to, nonce, amount, auxBalance, currentBalance, auditedBalance, auditorPubKey: auditorPubKey.try_into().unwrap() };
            verify_fund(inputs, proof);

            //get the transfer amount from the sender
            //TODO: Check Allowance
            self.get_transfer(amount);

            let cipher = CipherBalanceTrait::new(to, amount, 'fund');
            self.add_balance(to, cipher);

            self.set_audit(to, auditedBalance);

            self.overwrite_ae_balances(to, ae_hints);
            self.increase_nonce(to);
            self.emit(FundEvent { to, amount: amount.try_into().unwrap(), nonce , auditorPubKey, auditedBalanceLeft: auditedBalance});
        }

        /// Withdraw some tongo from acount and send the stark to the recipient
        fn withdraw(ref self: ContractState, withdraw: Withdraw) {
            let Withdraw { from, amount, auditedBalance, to, proof, ae_hints } = withdraw;

            let currentBalance = self.get_balance(from);
            let nonce = self.get_nonce(from);
            let auditorPubKey = self.auditor_key();
            
            let inputs: InputsWithdraw = InputsWithdraw { y: from, amount, nonce, to, currentBalance, auditedBalance, auditorPubKey};
            verify_withdraw(inputs, proof);

            let cipher = CipherBalanceTrait::new(from, amount, 'withdraw');
            self.remove_balance(from, cipher);

            self.set_audit(from, auditedBalance);
            self.increase_nonce(from);

            self.transfer_to(to, amount);
            self.overwrite_ae_balances(from, ae_hints);
            self.emit(WithdrawEvent { from, amount: amount.try_into().unwrap(), to, nonce , auditorPubKey, auditedBalanceLeft: auditedBalance});
        }

        /// Withdraw ALL tongo from acount and send the stark to the recipient
        fn ragequit(ref self: ContractState, ragequit: Ragequit) {
            let Ragequit { from, amount, to, proof, ae_hints } = ragequit;
            //TODO: add validations
            let currentBalance = self.get_balance(from);
            let nonce = self.get_nonce(from);
            let auditorPubKey = self.auditor_key();
            let inputs: InputsRagequit = InputsRagequit { y: from, amount, nonce, to, currentBalance };
            verify_ragequit(inputs, proof);

            let auditedZeroBalance = CipherBalanceTrait::new(auditorPubKey, 0, 1);
            self.set_audit(from, auditedZeroBalance);

            let zeroBalance: CipherBalance  = CipherBalanceTrait::new(from, 0, 1);
            self.balance.entry(from).write(zeroBalance.into());

            self.increase_nonce(from);

            self.overwrite_ae_balances(from, ae_hints);

            self.transfer_to(to, amount);
            self.emit(RagequitEvent { from, amount: amount.try_into().unwrap(), to, nonce });
        }

        /// Transfer the amount encoded in L, L_bar from "from" to "to". The proof has to be done
        /// w.r.t the balance stored in Balance plus Pending and to the nonce stored in the
        /// contract.
        fn transfer(ref self: ContractState, transfer: Transfer) {
            let Transfer { from, to, transferBalance, transferBalanceSelf, auditedBalance, auditedBalanceSelf, proof, ae_hints} = transfer;

            let currentBalance= self.get_balance(from);
            let nonce = self.get_nonce(from);
            let auditorPubKey = self.auditor_key.read();

            let inputs: InputsTransfer = InputsTransfer {
                y: from,
                y_bar: to,
                nonce,
                auditorPubKey,
                currentBalance,
                transferBalance,
                transferBalanceSelf,
                auditedBalance,
                auditedBalanceSelf,
            };

            verify_transfer(inputs, proof);

            // verificar la prueva with respect to balance + pending

            self.remove_balance(from, transferBalanceSelf);

            //TODO: Acomodar el audit
            self.set_audit(from, auditedBalanceSelf);

            self.add_pending(to, transferBalance);
            self.increase_nonce(from);
            self.overwrite_ae_balances(from, ae_hints);
            self .emit(
                TransferEvent {
                        to, from, nonce, auditorPubKey, auditedBalanceLeft: auditedBalanceSelf, auditedBalanceSend: transferBalance
                    },
                )
        }

        fn ERC20(self: @ContractState) -> ContractAddress {
            self.ERC20.read()
        }

        fn get_nonce(self: @ContractState, y: PubKey) -> u64 {
//            y.validate();
            self.nonce.entry(y).read()
        }

        /// Returns the cipher balance of the given public key y. The cipher balance consist in two
        /// points of the stark curve. (L,R) = ((Lx, Ly), (Rx, Ry )) = (g**b y**r , g**r) for some
        /// random r.
        fn get_balance(self: @ContractState, y: PubKey) -> CipherBalance {
            self.balance.entry(y).read().handle_null(y).into()
        }

        fn get_audit(self: @ContractState, y: PubKey) -> CipherBalance {
            self.audit_balance.entry(y).read().handle_null(self.auditor_key()).into()
        }

        fn get_pending(self: @ContractState, y: PubKey) -> CipherBalance {
            self.pending.entry(y).read().handle_null(y).into()
        }

        fn get_state(self: @ContractState, y: PubKey) -> State {
            let balance = self.balance.entry(y).read().handle_null(y).into();
            let pending = self.pending.entry(y).read().handle_null(y).into();
            let audit = self.audit_balance.entry(y).read().handle_null(self.auditor_key.read()).into();
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
            if old_balance.is_null() {
                self.balance.entry(y).write(new_balance.into());
            } else {
                let sum = old_balance.add(new_balance.into());
                self.balance.entry(y).write(sum);
            }
        }

        fn remove_balance(ref self: ContractState, y: PubKey, new_balance: CipherBalance) {
            let old_balance = self.balance.entry(y).read();
            if old_balance.is_null() {
                self.balance.entry(y).write(new_balance.into());
            } else {
                let sum = old_balance.subtract(new_balance.into());
                self.balance.entry(y).write(sum);
            }
        }

        fn add_pending(ref self: ContractState, y: PubKey, new_pending: CipherBalance) {
            let old_pending = self.pending.entry(y).read();
            if old_pending.is_null() {
                self.pending.entry(y).write(new_pending.into());
            } else {
                let sum = old_pending.add(new_pending.into());
                self.pending.entry(y).write(sum);
            }
        }

        fn pending_to_balance(ref self: ContractState, y: PubKey) {
            let pending = self.pending.entry(y).read();
            if pending.is_null() {
                return;
            }
            self.add_balance(y, pending.into());
            self
                .pending
                .entry(y.into())
                .write(
                    CipherBalanceTrait::null()
                );
        }

        fn set_audit(ref self: ContractState, y:PubKey, new_audit: CipherBalance) {
            self.audit_balance.entry(y).write(new_audit.into());
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
