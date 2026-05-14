use starknet::account::Call;
use starknet::ContractAddress;

use crate::structs::common::pubkey::PubKey;

#[derive(Copy, Drop, Serde)]
pub struct RelayStatus {
    pub asset: Option<ContractAddress>,
    pub target: Option<ContractAddress>,
    pub pubkey: Option<PubKey>,
    pub to_add: u256,
    pub to_subtract: u256,
}

#[generate_trait]
pub impl RelayStatusImpl of RelayStatusTrait {
    fn add(ref self: RelayStatus, amount: u256) {
        self.to_add += amount
    }

    fn subtract(ref self: RelayStatus, amount: u256) {
        self.to_subtract += amount
    }

    fn compare_and_set_asset(ref self: RelayStatus, asset: ContractAddress) {
        match self.asset {
            None => { self.asset = Some(asset) },
            Some(stored) => assert!(stored == asset, "FEE ASSET MISMATCH"),
        }
    }

    fn compare_and_set_target(ref self: RelayStatus, target: ContractAddress) {
        match self.target {
            None => { self.target = Some(target) },
            Some(stored) => assert!(stored == target, "MULTIPLE TONGO TARGETS"),
        }
    }

    fn compare_and_set_pubkey(ref self: RelayStatus, pubkey: PubKey) {
        match self.pubkey {
            None => { self.pubkey = Some(pubkey) },
            Some(stored) => assert!(stored == pubkey, "MULTIPLE TONGO PUBKEYS"),
        }
    }

    fn new() -> RelayStatus {
        RelayStatus {
            asset: None,
            target: None,
            pubkey: None,
            to_add: 0,
            to_subtract: 0,
        }
    }
}


#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct TargetConfig {
    pub erc20: starknet::ContractAddress,
    pub rate: u256,
}

#[derive(Copy, Drop, Serde)]
pub struct OutsideExecution {
    pub caller: ContractAddress,
    pub nonce: felt252,
    pub execute_after: u64,
    pub execute_before: u64,
    pub calls: Span<Call>,
}


