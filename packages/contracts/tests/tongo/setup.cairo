use tongo::main::{ITongoDispatcher};
use tongo::constants::STRK_ADDRESS;
use erc20::IERC20Dispatcher;
use erc20::IERC20DispatcherTrait;


use core::starknet::{ContractAddress};


use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, ContractClass };

pub const TONGO_ADDRESS: felt252 = 'TONGO';


fn declare_class(contract_name: ByteArray) -> (ContractClass, felt252) {
    let contract = declare(contract_name.clone()).unwrap().contract_class();
    let class_hash: felt252 = (*contract.class_hash).into();
    (*contract, class_hash)
}

fn deploy_contract(
    contract_class: ContractClass, address: felt252, calldata: Array<felt252>
) -> ContractAddress {
    let (deployed_address, _) = contract_class
        .deploy_at(@calldata, address.try_into().unwrap())
        .expect('Couldnt deploy');
    deployed_address
}


pub fn setup_tongo() -> (ContractAddress, ITongoDispatcher) {
    setup_erc20();
    let (tongo_contract, _tongo_class_hash) = declare_class("Tongo");
    let tongo_address = deploy_contract(
        tongo_contract, TONGO_ADDRESS.try_into().unwrap(), array![]
    );
    let tongo_dispatcher = ITongoDispatcher { contract_address: tongo_address };

    (tongo_address, tongo_dispatcher)
}


fn setup_erc20() -> (ContractAddress, IERC20Dispatcher) {
    let (_erc20_contract, _erc20_class_hash ) = declare_class("ERC20Contract");
    let (erc20_address, _) = _erc20_contract
        .deploy_at( @array![], STRK_ADDRESS.try_into().unwrap())
        .expect('Couldnt deploy');
    let dispatcher = IERC20Dispatcher {contract_address: erc20_address.try_into().unwrap()};
    
    dispatcher.print();
    dispatcher.approve(TONGO_ADDRESS.try_into().unwrap(), 10000000_u256);
    return (erc20_address, dispatcher);
}

