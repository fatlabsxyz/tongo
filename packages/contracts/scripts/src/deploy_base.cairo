use sncast_std::{DeclareResult, FeeSettingsTrait, declare, deploy, get_nonce};


pub fn base() {
    let salt = 0x3;

    let declare_result = declare(
        "Tongo", FeeSettingsTrait::estimate(), Option::Some(get_nonce('latest')),
    )
        .expect('map declare failed');

    let class_hash = match (declare_result) {
        DeclareResult::AlreadyDeclared(already_declared) => already_declared.class_hash,
        DeclareResult::Success(tx_result) => tx_result.class_hash,
    };
    println!("Class hash 0x{:x}", class_hash);

    let deploy_result = deploy(
        class_hash,
        ArrayTrait::new(),
        Option::Some(salt),
        true,
        FeeSettingsTrait::estimate(),
        Option::Some(get_nonce('pending')),
    )
        .expect('map deploy failed');
    println!("=======================================================");
    println!("Salt {:?}", salt);
    println!("Contract address 0x{:x}", deploy_result.contract_address);
}
