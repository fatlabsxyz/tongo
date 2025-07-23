use sncast_std::{DeclareResultTrait, FeeSettingsTrait, declare, deploy, get_nonce};
use tongo::verifier::structs::PubKeyTrait;
use starknet::ContractAddress;

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


    let STRK_ADDRESS: ContractAddress = 0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D.try_into().unwrap();
    let AUDITOR_PRIVATE: felt252 = 'CURIOSITY';
    let audit_key = PubKeyTrait::from_secret(AUDITOR_PRIVATE);
    let OWNER_ADDRESS: ContractAddress = 'OWNER'.try_into().unwrap();

    let constructor_calldata: Array<felt252> = array![OWNER_ADDRESS.into(), audit_key.x, audit_key.y, STRK_ADDRESS.into()];
    let deploy_result = deploy(
        class_hash,
        constructor_calldata,
        Option::Some(salt),
        true,
        FeeSettingsTrait::estimate(),
        Option::Some(get_nonce('pending'))
    )
        .expect('map deploy failed');
    println!("=======================================================");
    println!("Contract address [salt={:x}] 0x{:x}", salt, deploy_result.contract_address);
}
