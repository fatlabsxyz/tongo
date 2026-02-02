pub mod prover {
    pub mod functions;
    pub mod utils;
}

pub mod tongo {
    pub mod setup;
    pub mod fund;
    pub mod withdraw;
    pub mod transfer;
    pub mod audit;
    pub mod full;
    pub mod validation;
    pub mod operations;
    pub mod relay;
}

pub mod verifier {
    pub mod fund;
    pub mod withdraw;
    pub mod ragequit;
    pub mod transfer;
}

pub mod consts;
