use core::starknet::ContractAddress;
use crate::verifier::structs::{ProofOfTransfer, ProofOfWithdraw};
// the calldata for any transaction calling a selector should be: selector_calldata, proof_necesary, replay_protection.
// the replay_protection should have the epoch in which the tx was generated (it is the same to the epoch in which the
// tx is expected to pass) signed by the private key x of y = g**x, with  the selector_calldata and posiblly the proof itself.

#[starknet::interface]
pub trait ITongo<TContractState> {
    fn fund(ref self: TContractState, to: [felt252;2],  amount: felt252); 
    fn current_epoch(ref self: TContractState) -> u64;
    fn get_balance(self: @TContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252));
    fn audit_balance(self: @TContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252));
    fn get_buffer(self: @TContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252), felt252);
    fn withdraw(ref self: TContractState, from: [felt252;2], amount: felt252, to: ContractAddress, proof: ProofOfWithdraw);
    fn transfer(ref self: TContractState,
        from:[felt252;2],
        to: [felt252;2],
        L:[felt252;2],
        L_bar:[felt252;2],
        L_audit:[felt252;2],
        R: [felt252;2],
        proof: ProofOfTransfer,
    );
}

#[starknet::contract]
pub mod Tongo {
    use core::ec::{EcPoint, EcPointTrait,  EcStateTrait};
    use core::ec::stark_curve::{GEN_X, GEN_Y};
    use core::starknet::{
        storage::StoragePointerReadAccess,
        storage::StoragePointerWriteAccess,
        storage::StoragePathEntry,
        storage::Map,
        syscalls,
        SyscallResultTrait,
        ContractAddress,
        get_caller_address,
        get_contract_address,
        get_block_number,
    };
    
    use crate::verifier::structs::{ InputsTransfer, ProofOfTransfer, InputsWithdraw, ProofOfWithdraw};
    use crate::verifier::verifier::{verify_withdraw, verify_transfer};
    use crate::verifier::utils::{in_range, view_key};
    use crate::constants::{STRK_ADDRESS, BLOCKS_IN_EPOCH};

    #[storage]
    // The storage of the balance is a map: G --> G\timesG with y --> (L,R). The curve points are stored
    // in the form (x,y). Reading an empty y gives a default value of ((0,0), (0,0)) wich are not curve points
    // TODO: it would be nice to set te default value to curve points like  (y,g)
    struct Storage {
        balance: Map<(felt252,felt252), ((felt252,felt252) , (felt252, felt252)) >,
        audit_balance: Map<(felt252,felt252), ((felt252,felt252) , (felt252, felt252)) >,
        buffer: Map<(felt252,felt252), ((felt252,felt252) , (felt252, felt252)) >,
        buffer_epoch: Map<(felt252,felt252), u64 >,
        nonce: Map<felt252, bool>,
    }


    #[abi(embed_v0)]
    impl TongoImpl of super::ITongo<ContractState> {
    

    /// Transfer some STARK to Tongo contract and assing some Tongo to account y
    fn fund(ref self: ContractState, to: [felt252;2], amount: felt252) {
        in_range(amount);
//        self.get_transfer(amount);

        let Cipher = self.cipher(amount, to);
        self.to_buffer(to, Cipher);

        let Cipher_audit = self.cipher(amount, view_key());
        self.write_audit(to, Cipher_audit);
        let this_epoch = self.current_epoch();
        self.buffer_epoch.entry((*to.span()[0], *to.span()[1])).write(this_epoch);
    } 

    /// Withdraw ALL tongo from acount and send the stark to the recipient
    fn withdraw(ref self: ContractState, from: [felt252;2], amount: felt252, to: ContractAddress, proof:  ProofOfWithdraw) {
        //TODO: The recipient ContractAddress has to be signed by x otherwhise the proof can be frontruned.
        self.rollover(from);
        let this_epoch = self.current_epoch();
        let ((Lx,Ly), (Rx,Ry)) = self.get_balance(from);
        let inputs:InputsWithdraw = InputsWithdraw { y : from , epoch: this_epoch, amount, L:[Lx,Ly], R: [Rx,Ry]};
        self.validate_nonce(proof.nonce);
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


        self.balance.entry((*from.span()[0], *from.span()[1])).write(((0,0), (0,0)));
        //TODO: mejorar el audit_balance
        self.audit_balance.entry((*from.span()[0], *from.span()[1])).write(((0,0), (0,0)));
        self.buffer_epoch.entry((*from.span()[0], *from.span()[1])).write(this_epoch);
        self.update_nonce(proof.nonce)
    }

    /// Transfer the amount encoded in L, L_bar from "from" to "to". The proof has to be done w.r.t the
    /// balance stored in Balance plus Pending and to the nonce stored in the contract. 
    fn transfer(ref self: ContractState,
        from:[felt252;2],
        to: [felt252;2],
        L:[felt252;2],
        L_bar:[felt252;2],
        L_audit:[felt252;2],
        R: [felt252;2],
        proof: ProofOfTransfer,
    ) {
        self.rollover(from);
        let ((CLx,CLy), (CRx,CRy)) = self.get_balance(from);
        
        let this_epoch = self.current_epoch();
        let inputs:InputsTransfer = InputsTransfer {
            y: from ,
            y_bar: to,
            epoch: this_epoch,
            CL: [CLx,CLy],
            CR: [CRx,CRy],
            R: R,
            L: L,
            L_bar:L_bar,
            L_audit: L_audit,
        };
        
        self.validate_nonce(proof.nonce);
        verify_transfer(inputs, proof);


        // verificar la prueva with respect to balance + pending

        let L = EcPointTrait::new(*L.span()[0],*L.span()[1]).unwrap();
        let R = EcPointTrait::new(*R.span()[0],*R.span()[1]).unwrap();
        let L_bar = EcPointTrait::new(*L_bar.span()[0],*L_bar.span()[1]).unwrap();
        let L_audit = EcPointTrait::new(*L_audit.span()[0],*L_audit.span()[1]).unwrap();
        self.to_buffer(from,(-L,-R));

        //TODO: Acomodar el audit
        self.write_audit(from,(-L_audit,-R));

        self.to_buffer(to, (L_bar,R));
        //TODO: Acomodar el audit
        self.write_audit(to,(L_audit,R));

        self.buffer_epoch.entry((*to.span()[0], *to.span()[1])).write(this_epoch);
        self.buffer_epoch.entry((*from.span()[0], *from.span()[1])).write(this_epoch);
        self.update_nonce(proof.nonce)
    }
    
    /// Returns the cipher balance of the given public key y. The cipher balance consist in two points
    /// of the stark curve. (L,R) = ((Lx, Ly), (Rx, Ry )) = (g**b y**r , g**r) for some random r.
    /// TODO: return also the buffer balance if correspond to an old epoch
    fn get_balance(self: @ContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252)) {
        self.balance.entry((*y.span()[0], *y.span()[1])).read()
    }
    
    fn audit_balance(self: @ContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252)) {
        self.audit_balance.entry((*y.span()[0], *y.span()[1])).read()
    }

    fn get_buffer(self: @ContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252), felt252) {
        let (L,R) = self.buffer.entry((*y.span()[0], *y.span()[1])).read();
        let last_epoch:felt252 = self.buffer_epoch.entry((*y.span()[0], *y.span()[1])).read().try_into().unwrap();
        return (L,R, last_epoch);
    }
    
    fn current_epoch(ref self: ContractState) -> u64 {
        let this_epoch = get_block_number() / BLOCKS_IN_EPOCH;
        return this_epoch;
    }

    }

    #[generate_trait]
    pub impl PrivateImpl of IPrivate {
    /// Cipher the balance b under the y key with a fixed randomnes. The fixed randomness should
    /// not be a problem because b is known here. This only is performed on fund transactions
    fn cipher(self: @ContractState, b:felt252, y:[felt252;2]) -> (EcPoint, EcPoint) {
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let y = EcPointTrait::new_nz(*y.span()[0],*y.span()[1]).unwrap();
        
        let mut state1 = EcStateTrait::init();
            state1.add_mul(b, g.try_into().unwrap());
            state1.add_mul(1, y);
        let CL = state1.finalize();
        return (CL,g);
    }
    
    fn to_buffer(ref self: ContractState, y:[felt252;2], Cipher: (EcPoint,EcPoint)) {
        let buffer = self.read_buffer(y);
        if buffer.is_none() {
            self.write_buffer(y, Cipher);
        } else {
            let (L_buffer,R_buffer) = buffer.unwrap();
            let (CL,CR) = Cipher;
            let L = CL + L_buffer;
            let R = CR + R_buffer;
            self.write_balance(y,(L,R));
        };
    }

    fn buffer_to_balance(ref self: ContractState, y:[felt252;2]) {
        let buffer = self.read_buffer(y);
        if buffer.is_none() { return ;}
        let balance = self.read_balance(y);
        if balance.is_none() {
            self.write_balance(y, buffer.unwrap());
        } else {
            let (L_buffer,R_buffer) = buffer.unwrap();
            let (L_balance,R_balance) = balance.unwrap();
            let L = L_buffer + L_balance;
            let R = R_buffer + R_balance;
            self.write_buffer(y,(L,R));
        };
    }


    fn read_balance(ref self: ContractState, y:[felt252;2])  -> Option<(EcPoint, EcPoint)> {
        let balance = self.balance.entry((*y.span()[0], *y.span()[1])).read();
        if balance == ((0,0),(0,0)) { return Option::None ; }

        let ((Lx, Ly), (Rx,Ry)) = balance;
        let L = EcPointTrait::new(Lx,Ly).unwrap();
        let R = EcPointTrait::new(Rx,Ry).unwrap();
        return Option::Some((L,R));
    }

    fn read_audit(ref self: ContractState, y:[felt252;2])  -> Option<(EcPoint, EcPoint)> {
        let balance = self.audit_balance.entry((*y.span()[0], *y.span()[1])).read();
        if balance == ((0,0),(0,0)) { return Option::None ; }

        let ((Lx, Ly), (Rx,Ry)) = balance;
        let L = EcPointTrait::new(Lx,Ly).unwrap();
        let R = EcPointTrait::new(Rx,Ry).unwrap();
        return Option::Some((L,R));
    }

    fn read_buffer(ref self: ContractState, y:[felt252;2])  -> Option<(EcPoint, EcPoint)> {
        let balance = self.buffer.entry((*y.span()[0], *y.span()[1])).read();
        if balance == ((0,0),(0,0)) { return Option::None; }

        let ((Lx, Ly), (Rx,Ry)) = balance;
        let L = EcPointTrait::new(Lx,Ly).unwrap();
        let R = EcPointTrait::new(Rx,Ry).unwrap();
        return Option::Some((L,R));
    }

    fn write_balance(ref self: ContractState, y:[felt252;2], Cipher:(EcPoint,EcPoint)){
        let (L,R) = Cipher;
        //TODO: Unwrap to NonZero and handle the Zero case
        self.balance.entry((*y.span()[0], *y.span()[1])).write((
            L.try_into().unwrap().coordinates(),
            R.try_into().unwrap().coordinates(),
        ));
    }

    fn write_audit(ref self: ContractState, y:[felt252;2], Cipher:(EcPoint, EcPoint)) {
        let balance = self.read_audit(y);
        let (L,R) = Cipher;
        if balance.is_none() {
            self.audit_balance.entry((*y.span()[0], *y.span()[1])).write((
                L.try_into().unwrap().coordinates(),
                R.try_into().unwrap().coordinates(),
            ));
        } else {
            let (L_old, R_old) = balance.unwrap();
            let L = L + L_old;
            let R = R + R_old;

            self.audit_balance.entry((*y.span()[0], *y.span()[1])).write((
                L.try_into().unwrap().coordinates(),
                R.try_into().unwrap().coordinates(),
            ));
        }
    }

    fn write_buffer(ref self: ContractState, y:[felt252;2], Cipher:(EcPoint,EcPoint)){
        let (L,R) = Cipher;
        //TODO: Unwrap to NonZero and handle the Zero case
        self.buffer.entry((*y.span()[0], *y.span()[1])).write((
            L.try_into().unwrap().coordinates(),
            R.try_into().unwrap().coordinates(),
        ));
    }

    fn rollover(ref self: ContractState, y:[felt252;2]) {
        let this_epoch = self.current_epoch();
        let buffer_epoch = self.buffer_epoch.entry((*y.span()[0], *y.span()[1])).read();

        if buffer_epoch == this_epoch {return ;}; 
        self.buffer_to_balance(y);

        //TODO: These write is reduntand in the transfer and withdraw
        self.buffer.entry((*y.span()[0],  *y.span()[1])).write( ((0,0),(0,0)) );
        self.buffer_epoch.entry((*y.span()[0], *y.span()[1])).write(this_epoch);
    }

    fn get_transfer(self: @ContractState, amount: felt252) {
        let amount: u256 = amount.try_into().unwrap();
        let calldata: Array<felt252> = array![
            get_caller_address().try_into().unwrap(),
            get_contract_address().try_into().unwrap(),
            amount.low.into(),
            amount.high.into(),];

        syscalls::call_contract_syscall(
           STRK_ADDRESS.try_into().unwrap(),
           selector!("transfer_from"),
           calldata.span()
        ).unwrap_syscall();
    }

    fn validate_nonce(ref self: ContractState, nonce: [felt252;2]) {
        assert(self.nonce.entry(*nonce.span()[0]).read() == false, 'Tx already used in epoch');
    }

    fn update_nonce(ref self: ContractState, nonce: [felt252;2]) {
        self.nonce.entry(*nonce.span()[0]).write(true);
    }

    }
}
