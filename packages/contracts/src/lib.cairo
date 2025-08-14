pub mod verifier {
    pub mod utils;
    pub mod verifier;
    //contract
    pub mod she;

}
pub mod structs {
    pub mod traits;
    pub mod errors;
    pub mod events;

    pub mod common {
        pub mod pubkey;
        pub mod starkpoint;
        pub mod cipherbalance;
        pub mod state;
    }

    pub mod operations {
        pub mod fund;
        pub mod withdraw;
        pub mod transfer;
        pub mod rollover;
        pub mod ragequit;
        pub mod audit;
    }

    pub mod aecipher;

    pub mod proofbit;
}


pub mod tongo {
    pub mod ITongo; 
    pub mod Tongo;
}

//OZ interface
pub mod erc20;
