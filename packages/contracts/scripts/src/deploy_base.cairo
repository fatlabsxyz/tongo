use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};
use sncast_std::{DeclareResultTrait, FeeSettingsTrait, declare, deploy, get_nonce};
use starknet::ContractAddress;
use tongo::structs::common::pubkey::PubKey;

pub fn pubkey_from_secret(x: felt252) -> PubKey {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let key: NonZeroEcPoint = g.mul(x).try_into().unwrap();
    key.into()
}

trait NonceHandler<T> {
    fn current(self: @T) -> felt252;
    fn next(ref self: T) -> felt252;
    fn new(value: felt252) -> T;
}

#[derive(Drop)]
struct Nonce {
    _value: felt252,
}

impl NonceImpl of NonceHandler<Nonce> {
    fn new(value: core::felt252) -> Nonce {
        Nonce { _value: value }
    }
    fn next(ref self: Nonce) -> felt252 {
        self._value += 1;
        self._value.clone()
    }
    fn current(self: @Nonce) -> felt252 {
        self._value.clone()
    }
}

pub fn base() {
    let salt = 0x3;

    let mut nonce = NonceImpl::new(get_nonce('latest'));

    let declare_result = declare(
        "Tongo", FeeSettingsTrait::estimate(), Option::Some(nonce.current()),
    );

    let class_hash = *match (declare_result) {
        Result::Ok(ok_result) => ok_result.class_hash(),
        Result::Err(err_result) => {
            panic!("{:?}", err_result);
            @(0x0).try_into().unwrap()
        },
    };
    println!("Class hash 0x{:x}", class_hash);

    let STRK_ADDRESS: ContractAddress =
        0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D
        .try_into()
        .unwrap();
    let AUDITOR_PRIVATE: felt252 = 'CURIOSITY';
    let audit_key = pubkey_from_secret(AUDITOR_PRIVATE);
    let OWNER_ADDRESS: ContractAddress = 'OWNER'.try_into().unwrap();
    let RATE = 1_u256;

    let constructor_calldata: Array<felt252> = array![
        OWNER_ADDRESS.into(),
        audit_key.x,
        audit_key.y,
        STRK_ADDRESS.into(),
        RATE.low.into(),
        RATE.high.into(),
    ];
    let deploy_result = deploy(
        class_hash,
        constructor_calldata,
        Option::Some(salt),
        true,
        FeeSettingsTrait::estimate(),
        Option::Some(nonce.next()),
    )
        .expect('deploy failed');

    println!("=======================================================");
    println!("Contract address [salt={:x}] 0x{:x}", salt, deploy_result.contract_address);
}
