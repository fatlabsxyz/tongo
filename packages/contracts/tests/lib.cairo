pub mod prover {
    pub mod functions;
    pub mod utils;
}


pub mod verifier {
    pub mod fund;
    pub mod withdraw;
    pub mod ragequit;
    pub mod transfer;
}

pub mod global {
    pub mod setup;
    pub mod operations;
    pub mod fund;
    pub mod withdraw;
    pub mod transfer;
    pub mod rollover;
    pub mod full;
    pub mod audit;
    pub mod validation;
    pub mod relay;
}

pub mod consts;
