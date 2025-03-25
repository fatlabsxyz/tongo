use core::starknet::ContractAddress;
// the calldata for any transaction calling a selector should be: selector_calldata, proof_necesary, replay_protection.
// the replay_protection should have an inner nounce to verify against the nounce of y and a inner signature 
// of the private key x of y = g**x signing the nounce, the selector_calldata and posiblly the proof itself.

#[starknet::interface]
pub trait ITongo<TContractState> {
    fn fund(ref self: TContractState, to: [felt252;2],  amount: felt252, nonce: felt252 ); 
    fn get_balance(self: @TContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252));
    fn get_nonce(self: @TContractState, y: [felt252;2]) -> u128;
    fn withdraw(ref self: TContractState, from: [felt252;2], amount: felt252, to: ContractAddress, nonce:felt252);
    fn transfer(ref self: TContractState,
        from:[felt252;2],
        to: [felt252;2],
        L:[felt252;2],
        L_bar:[felt252;2],
        R: [felt252;2],
        nonce:felt252,
    );
}

#[starknet::contract]
pub mod Tongo {
    pub const STRK_ADDRESS: felt252= 0x49D36570D4E46F48E99674BD3FCC84644DDD6B96F7C741B1562B82F9E004DC7;
    use core::ec::EcStateTrait;
    use core::ec::EcPointTrait;
    use core::ec::{EcPoint};
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
    
    use crate::utils::{in_range};
//    use crate::utils::{on_curve};
    const BLOCKS_IN_EPOCH: u64 = 100;

    #[storage]
    // The storage of the balance is a map: G --> G\timesG with y --> (L,R). The curve points are stored
    // in the form (x,y). Reading an empty y gives a default value of ((0,0), (0,0)) wich are not curve points
    // TODO: it would be nice to set te default value to curve points like  (y,g)
    struct Storage {
        balance: Map<(felt252,felt252), ((felt252,felt252) , (felt252, felt252)) >,
        pending: Map<(felt252,felt252), ((felt252,felt252) , (felt252, felt252)) >,
        buffer: Map<(felt252,felt252), ((felt252,felt252) , (felt252, felt252)) >,
        last_update: Map<(felt252,felt252), u64 >,
        buffer_epoch: Map<(felt252,felt252), u64 >,
        pending_epoch: Map<(felt252,felt252), u64 >,
        nonce: Map<(felt252,felt252), u128 >,
    }


    #[abi(embed_v0)]
    impl TongoImpl of super::ITongo<ContractState> {
    

    /// Transfer some STARK to Zether contract and assing some Zether to account y
    fn fund(ref self: ContractState, to: [felt252;2], amount: felt252, nonce:felt252) {
        in_range(amount);
        self.validate_nonce(to, nonce);
        // Hay que ver el tema del transfer
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

        let Cipher = self.cipher(amount.try_into().unwrap(), to);
        self.to_buffer(to, Cipher);
        let this_epoch = get_block_number() / BLOCKS_IN_EPOCH;
        self.buffer_epoch.entry((*to.span()[0], *to.span()[1])).write(this_epoch);
    } 

    /// Withdraw ALL zether from acount and send the stark to the recipient
    fn withdraw(ref self: ContractState, from: [felt252;2], amount: felt252, to: ContractAddress, nonce:felt252) {
        //Verificar la proof
        self.validate_nonce(from, nonce);

        self.balance.entry((*from.span()[0], *from.span()[1])).write(((0,0), (0,0)));

        let amount: u256 = amount.try_into().unwrap();
        let calldata = array![
            to.into(),
            amount.low.into(),
            amount.high.into(),];
        syscalls::call_contract_syscall(
           STRK_ADDRESS.try_into().unwrap(),
           selector!("transfer"),
           calldata.span()
        ).unwrap_syscall();
    }

    /// Transfer the amount encoded in L, L_bar from "from" to "to". The proof has to be done w.r.t the
    /// balance stored in Balance plus Pending and to the nonce stored in the contract. 
    fn transfer(ref self: ContractState,
        from:[felt252;2],
        to: [felt252;2],
        L:[felt252;2],
        L_bar:[felt252;2],
        R: [felt252;2],
        nonce: felt252,
    ) {
        
        self.validate_nonce(from, nonce);
        self.rollover(from);

        // verificar la prueva with respect to balance + pending

        let L = EcPointTrait::new(*L.span()[0],*L.span()[1]).unwrap();
        let R = EcPointTrait::new(*R.span()[0],*R.span()[1]).unwrap();
        let L_bar = EcPointTrait::new(*L_bar.span()[0],*L_bar.span()[1]).unwrap();
        self.to_buffer(from,(L,R));
        self.to_buffer(to, (-L_bar,-R));
    }
    
    /// Returns the cipher balance of the given public key y. The cipher balance consist in two points
    /// of the stark curve. (L,R) = ((Lx, Ly), (Rx, Ry )) = (g**b y**r , g**r) for some random r.
    fn get_balance(self: @ContractState, y: [felt252;2]) -> ((felt252,felt252), (felt252,felt252)) {
        self.balance.entry((*y.span()[0], *y.span()[1])).read()
    }
    
    /// Returns the nonce of the given public key y.
    fn get_nonce(self: @ContractState, y:[felt252;2]) -> u128 {
        self.nonce.entry((*y.span()[0], *y.span()[1])).read()
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
    
    /// Increment the nonce of the given public key y.
    fn increment_nonce(ref self: ContractState, y:[felt252;2]) {
        let nonce = self.nonce.entry((*y.span()[0], *y.span()[1])).read();
        let nonce = nonce + 1;
        self.nonce.entry((*y.span()[0], *y.span()[1])).write(nonce);
    }

    /// Adds the cipher balance (g**b y**r , g**r) to the balance of the account y
    /// Warning! the proof that the cipher (L, R) is actually of the form (g**b y**r, g**r) has to be done
    /// before increasing the balace otherwise the balance of the account y will be broken forever.
    fn to_balance(ref self: ContractState, y:[felt252;2], Cipher: (EcPoint,EcPoint)) {
        let balance = self.read_balance(y);
        if balance.is_none() {
            self.write_balance(y, Cipher);
            return;
        } else {
            let (L_balance,R_balance) = balance.unwrap();
            let (CL,CR) = Cipher;
            let L = L_balance + CL;
            let R = R_balance + CR;
            self.write_balance(y,(L,R));
        };
    }

    fn to_pending(ref self: ContractState, y:[felt252;2], Cipher: (EcPoint,EcPoint)) {
        let pending = self.read_pending(y);
        if pending.is_none() {
            self.write_pending(y, Cipher);
            return;
        } else {
            let (L_pending,R_pending) = pending.unwrap();
            let (CL,CR) = Cipher;
            let L = CL + L_pending;
            let R = CR + R_pending;
            self.write_balance(y,(L,R));
        };
    }

    fn to_buffer(ref self: ContractState, y:[felt252;2], Cipher: (EcPoint,EcPoint)) {
        let pending = self.read_pending(y);
        if pending.is_none() {
            self.write_pending(y, Cipher);
            return;
        } else {
            let (L_pending,R_pending) = pending.unwrap();
            let (CL,CR) = Cipher;
            let L = CL + L_pending;
            let R = CR + R_pending;
            self.write_balance(y,(L,R));
        };
    }

    fn this_epoch(ref self : @ContractState) -> u64 {
        let block = get_block_number();
        block/ BLOCKS_IN_EPOCH
    }

    fn buffer_to_pending(ref self: ContractState, y:[felt252;2]) {
        let buffer = self.read_buffer(y);
        let pending = self.read_pending(y);
        if buffer.is_none() { return ;}
        if pending.is_none() {
            self.write_pending(y, buffer.unwrap());
            return;
        } else {
            let (L_buffer,R_buffer) = buffer.unwrap();
            let (L_pending,R_pending) = pending.unwrap();
            let L = L_buffer + L_pending;
            let R = R_buffer + R_pending;
            self.write_buffer(y,(L,R));
        };
    }

    fn buffer_to_balance(ref self: ContractState, y:[felt252;2]) {
        let buffer = self.read_buffer(y);
        let balance = self.read_balance(y);
        if buffer.is_none() { return ;}
        if balance.is_none() {
            self.write_balance(y, buffer.unwrap());
            return;
        } else {
            let (L_buffer,R_buffer) = buffer.unwrap();
            let (L_balance,R_balance) = balance.unwrap();
            let L = L_buffer + L_balance;
            let R = R_buffer + R_balance;
            self.write_buffer(y,(L,R));
        };
    }

    fn pending_to_balance(ref self: ContractState, y:[felt252;2]) {
        let pending = self.read_pending(y);
        let balance = self.read_balance(y);
        if pending.is_none() { return ;}
        if balance.is_none() {
            self.write_balance(y, pending.unwrap());
            return;
        } else {
            let (L_pending,R_pending) = pending.unwrap();
            let (L_balance,R_balance) = balance.unwrap();
            let L = L_pending + L_balance;
            let R = R_pending + R_balance;
            self.write_buffer(y,(L,R));
        };
    }
    
    fn validate_nonce(ref self: ContractState, from:[felt252;2], nonce:felt252) {
        //TODO: Check the ECDSA of the nonce
        assert!(nonce.try_into().unwrap() == self.get_nonce(from), "Invalid nonce");
    }

    fn read_balance(ref self: ContractState, y:[felt252;2])  -> Option<(EcPoint, EcPoint)> {
        let balance = self.balance.entry((*y.span()[0], *y.span()[1])).read();
        if balance != ((0,0),(0,0)) {
            let ((Lx, Ly), (Rx,Ry)) = balance;
            let L = EcPointTrait::new(Lx,Ly).unwrap();
            let R = EcPointTrait::new(Rx,Ry).unwrap();
            return Option::Some((L,R));
        } else {
            return Option::None;
        }
    }

    fn read_pending(ref self: ContractState, y:[felt252;2])  -> Option<(EcPoint, EcPoint)> {
        let balance = self.pending.entry((*y.span()[0], *y.span()[1])).read();
        if balance != ((0,0),(0,0)) {
            let ((Lx, Ly), (Rx,Ry)) = balance;
            let L = EcPointTrait::new(Lx,Ly).unwrap();
            let R = EcPointTrait::new(Rx,Ry).unwrap();
            return Option::Some((L,R));
        } else {
            return Option::None;
        }
    }

    fn read_buffer(ref self: ContractState, y:[felt252;2])  -> Option<(EcPoint, EcPoint)> {
        let balance = self.buffer.entry((*y.span()[0], *y.span()[1])).read();
        if balance != ((0,0),(0,0)) {
            let ((Lx, Ly), (Rx,Ry)) = balance;
            let L = EcPointTrait::new(Lx,Ly).unwrap();
            let R = EcPointTrait::new(Rx,Ry).unwrap();
            return Option::Some((L,R));
        } else {
            return Option::None;
        }
    }

    fn write_balance(ref self: ContractState, y:[felt252;2], Cipher:(EcPoint,EcPoint)){
        let (L,R) = Cipher;
        //TODO: Unwrap to NonZero and handle the Zero case
        self.balance.entry((*y.span()[0], *y.span()[1])).write((
            L.try_into().unwrap().coordinates(),
            R.try_into().unwrap().coordinates(),
        ));
    }

    fn write_pending(ref self: ContractState, y:[felt252;2], Cipher:(EcPoint,EcPoint)){
        let (L,R) = Cipher;
        //TODO: Unwrap to NonZero and handle the Zero case
        self.pending.entry((*y.span()[0], *y.span()[1])).write((
            L.try_into().unwrap().coordinates(),
            R.try_into().unwrap().coordinates(),
        ));
    }

    fn write_buffer(ref self: ContractState, y:[felt252;2], Cipher:(EcPoint,EcPoint)){
        let (L,R) = Cipher;
        //TODO: Unwrap to NonZero and handle the Zero case
        self.pending.entry((*y.span()[0], *y.span()[1])).write((
            L.try_into().unwrap().coordinates(),
            R.try_into().unwrap().coordinates(),
        ));
    }

    fn rollover(ref self: ContractState, y:[felt252;2]) {
        let this_epoch = get_block_number() / BLOCKS_IN_EPOCH;
        let pending_epoch = self.pending_epoch.entry((*y.span()[0], *y.span()[1])).read();
        // if pending is to old then:
        // pending_to_balance
        // clean pending
        // set pending_epoch 

        if pending_epoch >= this_epoch -1 {return ;}; 
        self.pending_to_balance(y);
        self.pending.entry((*y.span()[0],  *y.span()[1])).write( ((0,0),(0,0)) );
        self.pending_epoch.entry((*y.span()[0], *y.span()[1])).write(0);
        //TODO: Should be reseted to 0 or to this_epoch?
        

        let buffer_epoch = self.buffer_epoch.entry((*y.span()[0], *y.span()[1])).read();
        if buffer_epoch == this_epoch {return;};
        if buffer_epoch == this_epoch -1 {
            //buffer to pending
            //clear buffer
            //update pending
            self.buffer_to_pending(y);
            self.buffer.entry((*y.span()[0],  *y.span()[1])).write( ((0,0),(0,0)) );
            self.pending_epoch.entry((*y.span()[0], *y.span()[1])).write(buffer_epoch);
            
        } else {
            self.buffer_to_pending(y);
            self.buffer.entry((*y.span()[0],  *y.span()[1])).write( ((0,0),(0,0)) );
            //buffer_to_balance
            //clear buffer
        }
    }

    }
}
