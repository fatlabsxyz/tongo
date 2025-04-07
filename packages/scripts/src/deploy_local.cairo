use sncast_std::{
    declare, deploy, get_nonce, FeeSettings, EthFeeSettings, // StrkFeeSettings,
};


// The example below uses a contract deployed to the Sepolia testnet
fn main() {
    let MAX_FEE = 1000000000000000000; // 1 ETH

    let fee_settings = FeeSettings::Eth(EthFeeSettings { max_fee: Option::Some(MAX_FEE), });

    let salt = 0x3;

    let declare_nonce = get_nonce('latest');

    let declare_result = declare("Tongo", fee_settings, Option::Some(declare_nonce))
        .expect('map declare failed');

    let class_hash = declare_result.class_hash;
    println!("class hash {:?}", class_hash);

    let deploy_nonce = get_nonce('pending');

    let deploy_result = deploy(
        class_hash,
        ArrayTrait::new(),
        Option::Some(salt),
        true,
        fee_settings,
        Option::Some(deploy_nonce)
    )
        .expect('map deploy failed');
    println!("contract address {:?}", deploy_result.contract_address);

}
