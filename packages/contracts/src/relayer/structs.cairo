use starknet::account::Call;
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
pub struct FeeStatus {
    pub asset: Option<ContractAddress>,
    pub to_add: u256,
    pub to_subtract: u256,
}

#[generate_trait]
pub impl FeeStatusImpl of FeeStatusTrait{
    fn add(ref self: FeeStatus, amount: u256) {
        self.to_add += amount 
    }

    fn subtract(ref self: FeeStatus, amount: u256) {
        self.to_subtract += amount
    }

    fn compare_and_set_asset(ref self: FeeStatus, asset: ContractAddress) {
        match self.asset {
            None => { self.asset = Some(asset) },
            Some(stored) => {
                assert!(stored == asset, "FEE ASSET MISMATCH")
            }
        }
    }

    fn new() -> FeeStatus {
        FeeStatus {
            asset: None,
            to_add: 0,
            to_subtract: 0
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


