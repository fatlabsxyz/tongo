use starknet::ContractAddress;
use crate::deploy_base::base;
use crate::shared::BaseParams;
use crate::utils::pubkey_from_secret;

pub const SALT_OFFSET: felt252 = 0x100000000000000000000000000000000;

fn main() {
    let USDC_ADDRESS: ContractAddress =
        0x053C91253BC9682c04929cA02ED00b3E423f6710D2ee7e0D5EBB06F3eCF368A8
        .try_into()
        .unwrap();
    //XXX: yes, this is the auditor private key. Remove when ready
    let auditor_pubkey = pubkey_from_secret('CURIOSITY');
    base(
        BaseParams {
            ERC20_ADDRESS: USDC_ADDRESS,
            AUDITOR_PUBKEY: auditor_pubkey,
            OWNER_ADDRESS: 0x6d20b301802c9b2d91807d9f04ea493700e61ee652020ac0bf0ce0ad3109fcb
                .try_into()
                .unwrap(),
            salt: SALT_OFFSET + 0x1,
            rate: 1,
            bit_size: 32,
        },
    );
}
