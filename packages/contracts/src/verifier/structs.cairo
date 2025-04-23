use core::starknet::ContractAddress;

#[derive(Serde, Drop, Debug, Copy)]
/// Proof that V = g**b h**r with b either one or zero is well formed. The proof use a OR protocol to assert 
/// that one of the two is valid without revealing which one.
pub struct ProofOfBit {
    pub V:[felt252;2],
    pub A0:[felt252;2],
    pub A1:[felt252;2],
    pub c0:felt252,
    pub s0: felt252,
    pub s1: felt252,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsFund {
    pub y:[felt252;2],
    pub nonce: u64,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfFund {
    pub Ax:[felt252;2],
    pub sx: felt252,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfBit2 {
    pub V:[felt252;2],
    pub A:[felt252;2],
    pub B:[felt252;2],
    pub sb: felt252,
    pub sr: felt252,
    pub z: felt252,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsWithdraw {
    pub y: [felt252;2],
    pub nonce: u64,
    pub to: ContractAddress,
    pub amount: felt252,
    pub L:[felt252;2], 
    pub R:[felt252;2], 
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfWitdhrawAll {
    pub A_x:[felt252;2] , 
    pub A_cr:[felt252;2] , 
    pub s_x:felt252 ,
}


#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfWithdraw {
    pub A_x:[felt252;2] , 
    pub A:[felt252;2] , 
    pub A_v:[felt252;2] , 
    pub sx: felt252,
    pub sb: felt252,
    pub sr: felt252,
    pub range: Span<ProofOfBit>,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsTransfer {
    pub nonce:u64,
    pub y: [felt252;2],
    pub y_bar: [felt252;2],
    pub CL:[felt252;2], 
    pub CR:[felt252;2], 
    pub R:[felt252;2], 
    pub L:[felt252;2], 
    pub L_bar:[felt252;2], 
    pub L_audit:[felt252;2],
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfTransfer {
    pub A_x: [felt252;2], 
    pub A_r: [felt252;2], 
    pub A_b: [felt252;2],
    pub A_b2: [felt252;2],
    pub A_v: [felt252;2],
    pub A_v2:[felt252;2],
    pub A_bar: [felt252;2],
    pub A_audit: [felt252;2],
    pub s_x: felt252,
    pub s_r: felt252,
    pub s_b: felt252,
    pub s_b2: felt252,
    pub s_r2: felt252,
    pub range: Span<ProofOfBit>,
    pub range2: Span<ProofOfBit>,
}

