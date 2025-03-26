
#[derive(Serde, Drop, Debug, Copy)]
/// Proof that V = g**b h**r with b either one or zero is well formed. The proof use a OR protocol to assert 
/// that one of the two is valid without revealing which one.
pub struct ProofOfBit {
    pub V:[felt252;2],
    pub A0:[felt252;2],
    pub A1:[felt252;2],
    pub h:[felt252;2],
    pub c0:felt252,
    pub s0: felt252,
    pub s1: felt252,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct Nonce {
    pub u: [felt252;2],
    pub A_n: [felt252;2],
    pub s_n: felt252,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfBalance {
    pub L:[felt252;2], 
    pub R:[felt252;2], 
    pub A_x:[felt252;2], 
    pub A_cr:[felt252;2], 
    pub s_x:felt252,
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

