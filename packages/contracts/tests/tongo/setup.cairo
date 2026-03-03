use tongo::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClass, ContractClassTrait, DeclareResultTrait, Token, declare, set_balance,
    start_cheat_caller_address, stop_cheat_caller_address, start_cheat_chain_id_global,
};
use starknet::ContractAddress;
use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use tongo::tongo::IVault::{IVaultDispatcher, IVaultDispatcherTrait};
use tongo::structs::{
    aecipher::AEBalance,
};

use crate::consts::{VAULT_ADDRESS,STRK_ADDRESS,USER_ADDRESS,RELAYER_ADDRESS, AUDITOR_PRIVATE, OWNER_ADDRESS, RATE, CHAIN_ID, BIT_SIZE};
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

pub fn setup_vault() -> (ContractAddress, IVaultDispatcher) {
    let ( _, tongo_class_hash) = declare_class("Tongo");
    let (vault_contract, _vaul__class_hash) = declare_class("Vault");
    let constructor_calldata: Array<felt252> = array![
        STRK_ADDRESS.into(),
        RATE.low.into(),
        RATE.high.into(),
        BIT_SIZE.into(),
        tongo_class_hash,
    ];

    let vault_address = deploy_contract(
        vault_contract, VAULT_ADDRESS.try_into().unwrap(), constructor_calldata,
    );

    let dispatcher = IVaultDispatcher {contract_address: vault_address};
    (vault_address, dispatcher)
}


pub fn setup_tongo() -> (ContractAddress, ITongoDispatcher) {
    start_cheat_chain_id_global(CHAIN_ID);
    let (_vault_address, Vault) = setup_vault();

    let tag = 'TAG_VAULT';

    let audit_key = pubkey_from_secret(AUDITOR_PRIVATE);

    let tongo_address = Vault.deploy_tongo(OWNER_ADDRESS, tag, Some(audit_key));
    start_cheat_caller_address(tongo_address, USER_ADDRESS);

    let tongo_dispatcher = ITongoDispatcher {contract_address: tongo_address};
    setup_erc20(tongo_address);

    (tongo_address, tongo_dispatcher)
}


fn setup_erc20(tongo_address: ContractAddress) -> IERC20Dispatcher {
    let dispatcher = IERC20Dispatcher { contract_address: STRK_ADDRESS };
    set_balance(USER_ADDRESS, 100000000000000_u256, Token::STRK);
    set_balance(RELAYER_ADDRESS, 100000000000000_u256, Token::STRK);

    start_cheat_caller_address(STRK_ADDRESS, RELAYER_ADDRESS);
    dispatcher.approve(tongo_address.try_into().unwrap(), 10000000_u256);
    start_cheat_caller_address(STRK_ADDRESS, USER_ADDRESS);
    dispatcher.approve(tongo_address.try_into().unwrap(), 10000000_u256);

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
    assert(asset == STRK_ADDRESS, 'nope');
}

#[test]
fn test_rate() {
    let (_address, dispatcher) = setup_tongo();
    let rate= dispatcher.get_rate();
    assert(rate == RATE, 'nope');
}
