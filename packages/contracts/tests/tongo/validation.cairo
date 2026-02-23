use tongo::tongo::ITongo::{ITongoDispatcherTrait};
use tongo::structs::common::pubkey::PubKey;
use tongo::structs::operations::fund::Fund;

use crate::tongo::operations::fundOperation;

use crate::tongo::setup::{setup_tongo};
use crate::consts::USER_ADDRESS;

#[test]
#[should_panic(expected: "PubKey is not an EcPoint")]
fn tamperPubKey() {
    let (_tongo_address, dispatcher) = setup_tongo();

    let x = 1234;

    let initial_balance = 0;
    let initial_fund = 250;

    let sender = USER_ADDRESS;
    let fee_to_sender =  0;
    let operation = fundOperation(x, initial_balance,initial_fund,sender, fee_to_sender,dispatcher);


    let tamperTo =  PubKey {x: operation.to.x, y: operation.to.y + 1 };
    let tamperOperation = Fund { to: tamperTo, ..operation};
    dispatcher.fund(tamperOperation);
}

