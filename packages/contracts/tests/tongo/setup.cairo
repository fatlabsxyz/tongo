use tongo::main::{ITongoDispatcher};

use core::starknet::{ContractAddress,};

pub const TONGO_ADDRESS: felt252 = 'TONGO';

use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, ContractClass,};

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
