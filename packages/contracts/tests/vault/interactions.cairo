use snforge_std::start_cheat_caller_address;
use starknet::ContractAddress;
use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use tongo::tongo::IVault::{IVaultDispatcher, IVaultDispatcherTrait};
use crate::consts::{OWNER_ADDRESS, USER_ADDRESS};
use crate::tongo::setup::setup_tongo;


#[test]
#[should_panic(expected: "Caller is not the Owner")]
fn test_not_owner() {
    let (_, Tongo) = setup_tongo();

    start_cheat_caller_address(Tongo.contract_address, USER_ADDRESS);

    let fake_tongo_address: ContractAddress = 'FAKE'.try_into().unwrap();
    Tongo.approveTongo(fake_tongo_address);
}

#[test]
#[should_panic(expected: "Target is not a valid Tongo contract")]
fn test_owner() {
    let (_, Tongo) = setup_tongo();

    start_cheat_caller_address(Tongo.contract_address, OWNER_ADDRESS);

    let fake_tongo_address: ContractAddress = 'FAKE'.try_into().unwrap();
    Tongo.approveTongo(fake_tongo_address);
}

#[test]
fn test_approve() {
    let (_, Tongo) = setup_tongo();
    let Vault = IVaultDispatcher { contract_address: Tongo.get_vault() };
    let Tongo2 = ITongoDispatcher {
        contract_address: Vault.deploy_tongo(OWNER_ADDRESS, 'TAG2', Option::None),
    };

    start_cheat_caller_address(Tongo.contract_address, OWNER_ADDRESS);
    Tongo.approveTongo(Tongo2.contract_address);
}


#[test]
#[should_panic(expected: "Contract allready white-listed")]
fn test_double_approve() {
    let (_, Tongo) = setup_tongo();
    let Vault = IVaultDispatcher { contract_address: Tongo.get_vault() };
    let Tongo2 = ITongoDispatcher {
        contract_address: Vault.deploy_tongo(OWNER_ADDRESS, 'TAG2', Option::None),
    };

    start_cheat_caller_address(Tongo.contract_address, OWNER_ADDRESS);
    Tongo.approveTongo(Tongo2.contract_address);

    Tongo.approveTongo(Tongo2.contract_address);
}
