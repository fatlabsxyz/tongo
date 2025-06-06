use tongo::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClass, ContractClassTrait, DeclareResultTrait, Token, declare, set_balance,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use tongo::constants::STRK_ADDRESS as STRK_ADDRESS_FELT;
use tongo::main::ITongoDispatcher;
use tongo::verifier::structs::AEHints;

pub const TONGO_ADDRESS: ContractAddress = 'TONGO'.try_into().unwrap();
pub const STRK_ADDRESS: ContractAddress = STRK_ADDRESS_FELT.try_into().unwrap();
pub const GLOBAL_CALLER: ContractAddress = (0x1111111).try_into().unwrap();
pub const USER_CALLER: ContractAddress = (0x2222222).try_into().unwrap();

pub fn empty_ae_hint() -> AEHints {
    AEHints { ae_balance: Default::default(), ae_audit_balance: Default::default() }
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
    let tongo_address = deploy_contract(
        tongo_contract, TONGO_ADDRESS.try_into().unwrap(), array![],
    );
    let tongo_dispatcher = ITongoDispatcher { contract_address: tongo_address };
    start_cheat_caller_address(TONGO_ADDRESS, USER_CALLER);

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
