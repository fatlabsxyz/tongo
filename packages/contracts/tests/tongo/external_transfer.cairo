use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use tongo::tongo::IVault::{IVaultDispatcher, IVaultDispatcherTrait};
use crate::consts::{OWNER_ADDRESS, USER_ADDRESS};
use crate::prover::utils::{decipher_balance, pubkey_from_secret};
use crate::tongo::operations::{fundOperation, transferOperation};
use crate::tongo::setup::setup_tongo;

#[test]
fn test_external_transfer() {
    let (tongo_address, dispatcher) = setup_tongo();
    let vault_address = dispatcher.get_vault();

    let Vault = IVaultDispatcher { contract_address: vault_address };
    let auditor2 = pubkey_from_secret('12344213332323');
    let tongo_address2 = Vault.deploy_tongo(OWNER_ADDRESS, 'TAG2', Option::Some(auditor2));
    let dispatcher2 = ITongoDispatcher { contract_address: tongo_address2 };

    start_cheat_caller_address(tongo_address, OWNER_ADDRESS);
    start_cheat_caller_address(tongo_address2, OWNER_ADDRESS);
    dispatcher.approveTongo(tongo_address2);
    dispatcher2.approveTongo(tongo_address);

    stop_cheat_caller_address(tongo_address2);
    start_cheat_caller_address(tongo_address, USER_ADDRESS);

    let x = 2384230948239;
    let y = pubkey_from_secret(x);
    let x_bar = 2190381209380321;
    let y_bar = pubkey_from_secret(x_bar);

    let initial_balance = 0;
    let initial_fund = 250;

    let sender = USER_ADDRESS;
    let operation = fundOperation(x, initial_balance, initial_fund, sender, dispatcher);
    dispatcher.fund(operation);

    let fee_to_sender = 0;
    let transfer_amount = 100;
    let (operation, transfer_options) = transferOperation(
        x,
        y_bar,
        transfer_amount,
        initial_fund,
        USER_ADDRESS,
        fee_to_sender,
        tongo_address2,
        dispatcher,
    );
    dispatcher.transfer(operation, transfer_options);

    let balance = dispatcher.get_balance(y);
    decipher_balance((initial_fund - transfer_amount).into(), x, balance);

    let pending_from = dispatcher.get_pending(y_bar);
    decipher_balance(0, x_bar, pending_from);

    let pending_target = dispatcher2.get_pending(y_bar);
    decipher_balance(transfer_amount.into(), x_bar, pending_target);
}

