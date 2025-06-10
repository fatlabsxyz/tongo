use sncast_std::{DeclareResultTrait, FeeSettingsTrait, declare, deploy, get_nonce};

pub fn base() {
    let salt = 0x3;

    let declare_result = declare(
        "Tongo", FeeSettingsTrait::estimate(), Option::Some(get_nonce('latest')),
    );

    let class_hash = *match (declare_result) {
        Result::Ok(ok_result) => ok_result.class_hash(),
        Result::Err(err_result) => {
            panic!("{:?}", err_result);
            @(0x0).try_into().unwrap()
        }
    };
    println!("Class hash 0x{:x}", class_hash);

    let deploy_result = deploy(
        class_hash,
        ArrayTrait::new(),
        Option::Some(salt),
        true,
        FeeSettingsTrait::estimate(),
        Option::Some(get_nonce('pending'))
    )
        .expect('map deploy failed');
    println!("=======================================================");
    println!("Contract address [salt={:x}] 0x{:x}", salt, deploy_result.contract_address);
}
