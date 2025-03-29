
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
pub struct Proof {
    pub nonce: [felt252;2],
    pub A_n: [felt252;2],
    pub A_x: [felt252;2],
    pub s_x: felt252,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct Inputs {
    pub y: [felt252;2],
    pub epoch: u64,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsWithdraw {
    pub y: [felt252;2],
    pub epoch: u64,
    pub amount: felt252,
    pub L:[felt252;2], 
    pub R:[felt252;2], 
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfWithdraw {
    pub nonce:[felt252;2] ,
    pub A_n:[felt252;2] ,
    pub A_x:[felt252;2] , 
    pub A_cr:[felt252;2] , 
    pub s_x:felt252 ,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsTransfer {
    pub y: [felt252;2],
    pub y_bar: [felt252;2],
    pub epoch: u64,
    pub CL:[felt252;2], 
    pub CR:[felt252;2], 
    pub R:[felt252;2], 
    pub L:[felt252;2], 
    pub L_bar:[felt252;2], 
    pub V:[felt252;2], 
    pub V2:[felt252;2], 
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfTransfer {
    pub nonce: [felt252;2],
    pub A_x: [felt252;2], 
    pub A_n: [felt252;2],
    pub A_r: [felt252;2], 
    pub A_b: [felt252;2],
    pub A_b2: [felt252;2],
    pub A_v: [felt252;2],
    pub A_v2:[felt252;2],
    pub A_bar: [felt252;2],
    pub s_x: felt252,
    pub s_r: felt252,
    pub s_b: felt252,
    pub s_b2: felt252,
    pub s_r2: felt252,
    pub range: Span<ProofOfBit>,
    pub range2: Span<ProofOfBit>,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfCipher {
    pub L:[felt252;2], 
    pub L_bar:[felt252;2], 
    pub R:[felt252;2], 
    pub A_r:[felt252;2], 
    pub A_b:[felt252;2], 
    pub s_r:felt252,
    pub s_b:felt252,
}
