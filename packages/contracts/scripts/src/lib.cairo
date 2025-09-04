mod deploy_base;
mod deploy_local;
mod deploy_mainnet;
mod utils;

mod shared {
    use starknet::ContractAddress;
    use tongo::structs::common::pubkey::PubKey;
    pub struct BaseParams {
        pub salt: felt252,
        pub OWNER_ADDRESS: ContractAddress,
        pub AUDITOR_PUBKEY: PubKey,
        pub ERC20_ADDRESS: ContractAddress,
        pub rate: u256,
    }
}
