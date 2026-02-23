use crate::tongo::setup::{setup_tongo};
use tongo::tongo::ITongo::ITongoDispatcherTrait;
use crate::prover::utils::pubkey_from_secret;
use crate::consts::{USER_ADDRESS};


use crate::tongo::operations::{fundOperation, transferOperation};

#[test]
fn test_transfer() {
    let (_address, dispatcher) = setup_tongo();

    let x = 2384230948239;
    let x_bar = 2190381209380321;
    let y_bar = pubkey_from_secret(x_bar);

    let initial_balance = 0;
    let initial_fund = 250;

    let sender = USER_ADDRESS;
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,dispatcher);
    dispatcher.fund(operation);


    let transfer_amount = 100;
    let operation = transferOperation(x, y_bar,transfer_amount,initial_fund, USER_ADDRESS, fee_to_sender,dispatcher);
    dispatcher.transfer(operation);
}

