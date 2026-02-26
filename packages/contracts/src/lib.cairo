pub mod verifier {
    pub mod audit;
    pub mod fund;
    pub mod ragequit;
    pub mod range;
    pub mod rollover;
    pub mod transfer;
    pub mod utils;
    pub mod withdraw;
}
pub mod structs {
    pub mod events;
    pub mod traits;

    pub mod common {
        pub mod cipherbalance;
        pub mod pubkey;
        pub mod relayer;
        pub mod starkpoint;
        pub mod state;
    }

    pub mod operations {
        pub mod audit;
        pub mod fund;
        pub mod ragequit;
        pub mod rollover;
        pub mod transfer;
        pub mod withdraw;
    }

    pub mod aecipher;
}


pub mod tongo {
    pub mod ILedger;
    pub mod Ledger;
    pub mod IGlobal;
    pub mod Global;
}

//OZ interface
pub mod erc20;
