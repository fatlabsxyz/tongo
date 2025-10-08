use sncast_std::{DeclareResultTrait, FeeSettingsTrait, declare, deploy, get_nonce};
use crate::shared::BaseParams;


pub fn base(params: BaseParams) {
    let BaseParams { salt, OWNER_ADDRESS, AUDITOR_PUBKEY, ERC20_ADDRESS, rate, bit_size } = params;

    let declare_result = declare(
        "Tongo", FeeSettingsTrait::estimate(), Option::Some(get_nonce('latest')),
    );

    let class_hash = *match (declare_result) {
        Result::Ok(ok_result) => ok_result.class_hash(),
        Result::Err(err_result) => {
            panic!("{:?}", err_result);
        },
    };
    println!("Class hash 0x{:x}", class_hash);

    let constructor_calldata: Array<felt252> = array![
        OWNER_ADDRESS.into(),
        ERC20_ADDRESS.into(),
        rate.low.into(),
        rate.high.into(),
        bit_size,
        0,
        AUDITOR_PUBKEY.x,
        AUDITOR_PUBKEY.y,
    ];
    println!("Constructor calldata [salt={:x}] {:?}", salt, constructor_calldata);
    let deploy_result = deploy(
        class_hash,
        constructor_calldata,
        Option::Some(salt),
        true,
        FeeSettingsTrait::estimate(),
        Option::Some(get_nonce('latest')),
    )
        .expect('deploy failed');

    println!("=======================================================");
    println!("Contract address [salt={:x}] 0x{:x}", salt, deploy_result.contract_address);
}
