use crate::tongo::setup::{setup_tongo};
use tongo::tongo::ITongo::ITongoDispatcherTrait;
use crate::prover::utils::pubkey_from_secret;
use crate::consts::{USER_CALLER};


use crate::tongo::operations::{fundOperation, transferOperation};

#[test]
fn test_transfer() {
    let (_address, dispatcher) = setup_tongo();

    let x = 2384230948239;
    let x_bar = 2190381209380321;
    let y_bar = pubkey_from_secret(x_bar);

    let initial_balance = 0;
    let initial_fund = 250;
    let operation = fundOperation(x,USER_CALLER, initial_balance,initial_fund,dispatcher);
    dispatcher.fund(operation);


    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund,dispatcher);
    dispatcher.transfer(operation);
}

