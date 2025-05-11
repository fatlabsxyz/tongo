use core::starknet::ContractAddress;
use crate::verifier::structs::{ProofOfTransfer, ProofOfWitdhrawAll, ProofOfWithdraw, ProofOfFund};
use crate::verifier::structs::{PubKey};
use crate::verifier::structs::{CipherBalance};
use crate::verifier::structs::{StarkPoint};
// the calldata for any transaction calling a selector should be: selector_calldata, proof_necesary,
// replay_protection.

#[starknet::interface]
pub trait ITongo<TContractState> {
    fn fund(ref self: TContractState, to: PubKey, amount: felt252, proof: ProofOfFund);
    fn rollover(ref self: TContractState, to: PubKey, proof: ProofOfFund);
    fn get_balance(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_audit(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_buffer(self: @TContractState, y: PubKey) -> CipherBalance;
    fn get_nonce(self: @TContractState, y: PubKey) -> u64;
    fn withdraw_all(
        ref self: TContractState,
        from: PubKey,
        amount: felt252,
        to: ContractAddress,
        proof: ProofOfWitdhrawAll
    );
    fn withdraw(
        ref self: TContractState,
        from: PubKey,
        amount: felt252,
        to: ContractAddress,
        proof: ProofOfWithdraw
    );
    fn transfer(
        ref self: TContractState,
        from: PubKey,
        to: PubKey,
        L: StarkPoint,
        L_bar: StarkPoint,
        L_audit: StarkPoint,
        R: StarkPoint,
        proof: ProofOfTransfer,
    );
}

#[starknet::contract]
pub mod Tongo {
    use core::starknet::{
        storage::StoragePointerReadAccess, storage::StoragePointerWriteAccess,
        storage::StoragePathEntry, storage::Map, syscalls, SyscallResultTrait, ContractAddress,
        get_caller_address, get_contract_address,
    };

    use crate::verifier::structs::{
        InputsTransfer, ProofOfTransfer, ProofOfWitdhrawAll, ProofOfWithdraw, InputsFund,
        ProofOfFund, InputsWithdraw, CipherBalance, CipherBalanceTrait, StarkPoint,
    };
    use crate::verifier::structs::PubKey;
    use crate::verifier::structs::PubKeyTrait;
    use crate::verifier::verifier::{
        verify_withdraw, verify_withdraw_all, verify_transfer, verify_fund
    };
    use crate::verifier::utils::{in_range, view_key};
    use crate::constants::{STRK_ADDRESS};

    #[storage]
    // The storage of the balance is a map: G --> G\timesG with y --> (L,R). The curve points are
    // stored in the form (x,y). Reading an empty y gives a default value of ((0,0), (0,0)) wich are
    // not curve points TODO: it would be nice to set te default value to curve points like  (y,g)
    struct Storage {
        balance: Map<PubKey, CipherBalance>,
        audit_balance: Map<PubKey, CipherBalance>,
        buffer: Map<PubKey, CipherBalance>,
        nonce: Map<PubKey, u64>,
    }


    #[abi(embed_v0)]
    impl TongoImpl of super::ITongo<ContractState> {
        fn rollover(ref self: ContractState, to: PubKey, proof: ProofOfFund) {
            let nonce = self.get_nonce(to);
            let inputs: InputsFund = InputsFund { y: to, nonce: nonce };
            verify_fund(inputs, proof);
            self.buffer_to_balance(to);
            self.increase_nonce(to);
        }

        /// Transfer some STARK to Tongo contract and assing some Tongo to account y
        fn fund(ref self: ContractState, to: PubKey, amount: felt252, proof: ProofOfFund) {
            to.assert_on_curve();
            in_range(amount);
            let nonce = self.get_nonce(to);
            //        self.get_transfer(amount);

            let inputs: InputsFund = InputsFund { y: to, nonce: nonce };
            verify_fund(inputs, proof);

            let cipher = CipherBalanceTrait::new(to, amount, 'fund');
            self.add_balance(to, cipher);

            let cipher_audit = CipherBalanceTrait::new(view_key(), amount, 'fund');
            self.add_audit(to, cipher_audit);
            self.increase_nonce(to);
        }

        /// Withdraw some tongo from acount and send the stark to the recipient
        fn withdraw(
            ref self: ContractState,
            from: PubKey,
            amount: felt252,
            to: ContractAddress,
            proof: ProofOfWithdraw
        ) {
            //        //TODO: The recipient ContractAddress has to be signed by x otherwhise the
            //        proof can be frontruned.
            let balance = self.get_balance(from);

            let nonce = self.get_nonce(from);
            let inputs: InputsWithdraw = InputsWithdraw {
                y: from, amount, nonce, to, L: balance.CL, R: balance.CR
            };
            verify_withdraw(inputs, proof);

            //        let amount: u256 = amount.try_into().unwrap();
            //        let calldata = array![
            //            to.into(),
            //            amount.low.into(),
            //            amount.high.into(),];
            //        syscalls::call_contract_syscall(
            //           STRK_ADDRESS.try_into().unwrap(),
            //           selector!("transfer"),
            //           calldata.span()
            //        ).unwrap_syscall();

            //TODO: mejorar el audit_balance
            let cipher = CipherBalanceTrait::new(from, amount, 'withdraw');
            self.remove_balance(from, cipher);

            let cipher = CipherBalanceTrait::new(view_key(), amount, 'withdraw');
            self.remove_audit(from, cipher);
            self.increase_nonce(from);
        }

        /// Withdraw ALL tongo from acount and send the stark to the recipient
        fn withdraw_all(
            ref self: ContractState,
            from: PubKey,
            amount: felt252,
            to: ContractAddress,
            proof: ProofOfWitdhrawAll
        ) {
            //TODO: The recipient ContractAddress has to be signed by x otherwhise the proof can be
            //frontruned.
            let balance = self.get_balance(from);
            let nonce = self.get_nonce(from);
            let inputs: InputsWithdraw = InputsWithdraw {
                y: from, amount, nonce, to, L: balance.CL, R: balance.CR
            };
            verify_withdraw_all(inputs, proof);

            //        let amount: u256 = amount.try_into().unwrap();
            //        let calldata = array![
            //            to.into(),
            //            amount.low.into(),
            //            amount.high.into(),];
            //        syscalls::call_contract_syscall(
            //           STRK_ADDRESS.try_into().unwrap(),
            //           selector!("transfer"),
            //           calldata.span()
            //        ).unwrap_syscall();

            //        self.balance.entry((from.x, from.y)).write(((0,0), (0,0)));
            let cipher = CipherBalanceTrait::new(view_key(), amount, 'withdraw');
            self.remove_audit(from, cipher);
            self.increase_nonce(from);

            //TODO: Revisar esto
            self
                .balance
                .entry(from)
                .write(
                    CipherBalance { CL: StarkPoint { x: 0, y: 0 }, CR: StarkPoint { x: 0, y: 0 } }
                );
        }

        /// Transfer the amount encoded in L, L_bar from "from" to "to". The proof has to be done
        /// w.r.t the balance stored in Balance plus Pending and to the nonce stored in the
        /// contract.
        fn transfer(
            ref self: ContractState,
            from: PubKey,
            to: PubKey,
            L: StarkPoint,
            L_bar: StarkPoint,
            L_audit: StarkPoint,
            R: StarkPoint,
            proof: ProofOfTransfer,
        ) {
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
            };

            verify_transfer(inputs, proof);

            // verificar la prueva with respect to balance + pending

            self.remove_balance(from, CipherBalance { CL: L, CR: R });

            //TODO: Acomodar el audit
            self.remove_audit(from, CipherBalance { CL: L_audit, CR: R });

            self.add_buffer(to, CipherBalance { CL: L_bar, CR: R });
            //TODO: Acomodar el audit
            self.add_audit(to, CipherBalance { CL: L_audit, CR: R });
            self.increase_nonce(from);
        }

        fn get_nonce(self: @ContractState, y: PubKey) -> u64 {
            y.assert_on_curve();
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

        fn get_buffer(self: @ContractState, y: PubKey) -> CipherBalance {
            self.buffer.entry(y).read()
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

        fn add_buffer(ref self: ContractState, y: PubKey, new_buffer: CipherBalance) {
            let old_buffer = self.buffer.entry(y).read();
            if old_buffer.is_zero() {
                self.buffer.entry(y).write(new_buffer);
            } else {
                let sum = old_buffer.add(new_buffer);
                self.buffer.entry(y).write(sum);
            }
        }

        fn buffer_to_balance(ref self: ContractState, y: PubKey) {
            let buffer = self.buffer.entry(y).read();
            if buffer.is_zero() {
                return;
            }
            self.add_balance(y, buffer);
            self
                .buffer
                .entry(y)
                .write(
                    CipherBalance { CL: StarkPoint { x: 0, y: 0 }, CR: StarkPoint { x: 0, y: 0 } }
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
            let amount: u256 = amount.try_into().unwrap();
            let calldata: Array<felt252> = array![
                get_caller_address().try_into().unwrap(),
                get_contract_address().try_into().unwrap(),
                amount.low.into(),
                amount.high.into(),
            ];

            syscalls::call_contract_syscall(
                STRK_ADDRESS.try_into().unwrap(), selector!("transfer_from"), calldata.span()
            )
                .unwrap_syscall();
        }

        fn increase_nonce(ref self: ContractState, y: PubKey) {
            let mut nonce = self.nonce.entry(y).read();
            nonce = nonce + 1;
            self.nonce.entry(y).write(nonce);
        }
    }
}
