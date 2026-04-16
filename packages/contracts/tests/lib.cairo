pub mod prover {
    pub mod functions;
    pub mod utils;
}

pub mod tongo {
    pub mod audit;
    pub mod external_transfer;
    pub mod full;
    pub mod fund;
    pub mod operations;
    pub mod relay;
    pub mod setup;
    pub mod transfer;
    pub mod validation;
    pub mod withdraw;
}

pub mod verifier {
    pub mod fund;
    pub mod ragequit;
    pub mod transfer;
    pub mod withdraw;
}

pub mod vault {
    pub mod interactions;
}

pub mod consts;

pub mod serde;
