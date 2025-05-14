use tongo::main::{ITongoDispatcher};
use tongo::constants::STRK_ADDRESS;
use erc20::IERC20Dispatcher;

use core::starknet::{ContractAddress};
use core::starknet::{
    syscalls,
    SyscallResultTrait,
};


use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, ContractClass,};

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
    let (tongo_contract, _tongo_class_hash) = declare_class("Tongo");
    let tongo_address = deploy_contract(
        tongo_contract, TONGO_ADDRESS.try_into().unwrap(), array![]
    );
    let tongo_dispatcher = ITongoDispatcher { contract_address: tongo_address };
    (tongo_address, tongo_dispatcher)
}


pub fn setup_erc20() -> (ContractAddress, IERC20Dispatcher) {
    let (_erc20_contract, address ) = declare_class("ERC20Contract");
    let _ = _erc20_contract
        .deploy_at( @array![], STRK_ADDRESS.try_into().unwrap())
        .expect('Couldnt deploy');
    let dispatcher = IERC20Dispatcher {contract_address: address.try_into().unwrap()};
    return (address.try_into().unwrap(), dispatcher);
}

pub fn print(address: ContractAddress)  {
    syscalls::call_contract_syscall(
               STRK_ADDRESS.try_into().unwrap(),
               selector!("print"),
               array![].span()
            ).unwrap_syscall();
}
