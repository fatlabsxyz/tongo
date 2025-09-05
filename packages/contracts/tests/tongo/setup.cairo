use tongo::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClass, ContractClassTrait, DeclareResultTrait, Token, declare, set_balance,
    start_cheat_caller_address, stop_cheat_caller_address, start_cheat_chain_id_global,
};
use starknet::ContractAddress;
use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use tongo::structs::{
    aecipher::AEBalance,
};

use crate::consts::{TONGO_ADDRESS,STRK_ADDRESS,USER_CALLER, AUDITOR_PRIVATE, OWNER_ADDRESS, RATE, CHAIN_ID, BIT_SIZE};
use crate::prover::utils::pubkey_from_secret;

pub fn empty_ae_hint() -> AEBalance {
    Default::default()
}

fn declare_class(contract_name: ByteArray) -> (ContractClass, felt252) {
    let contract = declare(contract_name.clone()).unwrap().contract_class();
    let class_hash: felt252 = (*contract.class_hash).into();
    (*contract, class_hash)
}

fn deploy_contract(
    contract_class: ContractClass, address: felt252, calldata: Array<felt252>,
) -> ContractAddress {
    let (deployed_address, _) = contract_class
        .deploy_at(@calldata, address.try_into().unwrap())
        .expect('Couldnt deploy');
    deployed_address
}


pub fn setup_tongo() -> (ContractAddress, ITongoDispatcher) {
    let _erc20 = setup_erc20();
    let (tongo_contract, _tongo_class_hash) = declare_class("Tongo");

    let audit_key = pubkey_from_secret(AUDITOR_PRIVATE);
    // Option<PubKey> se serializa como [0, x, y] si es un some o [1] si es un none
    let constructor_calldata: Array<felt252> = array![
        OWNER_ADDRESS.into(),
        STRK_ADDRESS.into(),
        RATE.low.into(),
        RATE.high.into(),
        BIT_SIZE.into(),
        0,
        audit_key.x,
        audit_key.y
    ];
    let tongo_address = deploy_contract(
        tongo_contract, TONGO_ADDRESS.try_into().unwrap(), constructor_calldata,
    );
    let tongo_dispatcher = ITongoDispatcher { contract_address: tongo_address };
    start_cheat_caller_address(TONGO_ADDRESS, USER_CALLER);
    start_cheat_chain_id_global(CHAIN_ID);

    (tongo_address, tongo_dispatcher)
}


fn setup_erc20() -> IERC20Dispatcher {
    let dispatcher = IERC20Dispatcher { contract_address: STRK_ADDRESS };
    set_balance(USER_CALLER, 100000000000000_u256, Token::STRK);
    start_cheat_caller_address(STRK_ADDRESS, USER_CALLER);
    dispatcher.approve(TONGO_ADDRESS.try_into().unwrap(), 10000000_u256);
    stop_cheat_caller_address(STRK_ADDRESS);
    return dispatcher;
}

#[test]
fn test_owner() {
    let (_address, dispatcher) = setup_tongo();
    let onwer = dispatcher.get_owner();
    assert(onwer == OWNER_ADDRESS, 'nope');
}

#[test]
fn test_asset() {
    let (_address, dispatcher) = setup_tongo();
    let asset = dispatcher.ERC20();
    assert(asset== STRK_ADDRESS, 'nope');
}

#[test]
fn test_rate() {
    let (_address, dispatcher) = setup_tongo();
    let rate= dispatcher.get_rate();
    assert(rate == RATE, 'nope');
}
