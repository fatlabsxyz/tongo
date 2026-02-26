use tongo::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClass, ContractClassTrait, DeclareResultTrait, Token, declare, set_balance,
    start_cheat_caller_address, stop_cheat_caller_address, start_cheat_chain_id_global,
};
use starknet::{ContractAddress, ClassHash};
use core::ec::{NonZeroEcPoint, EcPointTrait};

use tongo::tongo::IGlobal::{IGlobalDispatcher, IGlobalDispatcherTrait};
use tongo::tongo::ILedger::{ILedgerDispatcher, ILedgerDispatcherTrait};

use crate::consts::{GLOBAL_ADDRESS,STRK_ADDRESS,USER_ADDRESS,RELAYER_ADDRESS, RATE, CHAIN_ID, BIT_SIZE, AUDITOR_KEY, OWNER_ADDRESS};
use tongo::structs::{
    aecipher::AEBalance,
};

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

fn declare_ledger() -> ClassHash {
    let (_, class_hash)  = declare_class("Ledger");
    class_hash.try_into().unwrap()
}

fn setup_erc20() {
    let dispatcher = IERC20Dispatcher { contract_address: STRK_ADDRESS };
    set_balance(USER_ADDRESS, 100000000000000_u256, Token::STRK);
    set_balance(RELAYER_ADDRESS, 100000000000000_u256, Token::STRK);

    start_cheat_caller_address(STRK_ADDRESS, RELAYER_ADDRESS);
    dispatcher.approve(GLOBAL_ADDRESS.try_into().unwrap(), 10000000_u256);
    start_cheat_caller_address(STRK_ADDRESS, USER_ADDRESS);
    dispatcher.approve(GLOBAL_ADDRESS.try_into().unwrap(), 10000000_u256);

    stop_cheat_caller_address(STRK_ADDRESS);
}



pub fn setup_global() -> (ContractAddress, IGlobalDispatcher) {
    setup_erc20();
    let ledger_class_hash = declare_ledger();
    let (global_contract, _) = declare_class("Global");

    // Option<PubKey> se serializa como [0, x, y] si es un some o [1] si es un none
    let constructor_calldata: Array<felt252> = array![
        STRK_ADDRESS.into(),
        RATE.low.into(),
        RATE.high.into(),
        BIT_SIZE.into(),
        ledger_class_hash.into()
    ];
    let global_address = deploy_contract(
        global_contract, GLOBAL_ADDRESS.try_into().unwrap(), constructor_calldata,
    );

    let global_dispatcher = IGlobalDispatcher { contract_address: global_address };

    start_cheat_chain_id_global(CHAIN_ID);
    (global_address, global_dispatcher)
}

pub fn full_setup() -> (IGlobalDispatcher, ContractAddress, ILedgerDispatcher) {
    let ( _, Global) = setup_global();
    let auditor_key = AUDITOR_KEY();
    let salt = 'SALT';
    let ledger_address = Global.deploy_ledger(OWNER_ADDRESS, Some(auditor_key), salt);
    let Ledger = ILedgerDispatcher {contract_address: ledger_address};
    (Global, ledger_address, Ledger) 
}


#[test]
fn test_basic_setup() {
    let (_, Global) = setup_global();
    assert!(Global.get_rate() == RATE, "Wrong rate");
    assert!(Global.ERC20() == STRK_ADDRESS, "Wrong erc20 wrapped");
    assert!(Global.get_bit_size() == BIT_SIZE, "Wrong bit_size");
}


#[test]
fn fn_deploy_ledger() {
    let ( global_address, Global) = setup_global();

    let auditor_key = AUDITOR_KEY();
    let salt = 'SALT';
    let ledger_address = Global.deploy_ledger(OWNER_ADDRESS, Some(auditor_key), salt);
    let Ledger = ILedgerDispatcher {contract_address: ledger_address};

    assert!(global_address == Ledger.get_global_tongo(), "Wrong global tongo");
    assert!(OWNER_ADDRESS == Ledger.get_owner(), "Wrong ledger owner");

    let stored_auditor:NonZeroEcPoint = (Ledger.get_auditor_key().unwrap()).try_into().unwrap();
    assert!(stored_auditor.coordinates() == auditor_key.try_into().unwrap().coordinates(), "Wrong auditor stored");
    assert!(Global.is_known_ledger(ledger_address), "Ledger not register in Global");
}

#[test]
fn fn_2deploys_ledger() {
    let ( _ , Global) = setup_global();

    let auditor_key = AUDITOR_KEY();
    let salt_1 = 'SALT1';
    let salt_2 = 'SALT2';

    let ledger_address_1 = Global.deploy_ledger(OWNER_ADDRESS, Some(auditor_key),salt_1);
    let ledger_address_2 = Global.deploy_ledger(OWNER_ADDRESS, Some(auditor_key),salt_2);

    assert!(ledger_address_1 != ledger_address_2, "2 Ledgers resolver to the same address");

    assert!(Global.is_known_ledger(ledger_address_1), "Ledger1 not register in Global");
    assert!(Global.is_known_ledger(ledger_address_2), "Ledger2 not register in Global");
}

