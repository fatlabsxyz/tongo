use starknet::ContractAddress;
use crate::deploy_base::base;
use crate::shared::BaseParams;
use crate::utils::pubkey_from_secret;

fn main() {
    let STARK_ADDRESS: ContractAddress =
        0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D
        .try_into()
        .unwrap();
    let auditor_pubkey = pubkey_from_secret('CURIOSITY');
    base(
        BaseParams {
            salt: 0x3,
            OWNER_ADDRESS: 'OWNER'.try_into().unwrap(),
            ERC20_ADDRESS: STARK_ADDRESS,
            rate: 1_u256,
            bit_size: 32,
            AUDITOR_PUBKEY: auditor_pubkey,
        },
    );
}
