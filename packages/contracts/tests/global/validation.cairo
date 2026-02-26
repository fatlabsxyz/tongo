use crate::global::setup::{full_setup};
use tongo::tongo::IGlobal::{IGlobalDispatcherTrait};
use crate::consts::{USER_ADDRESS, GLOBAL_ADDRESS};
use tongo::structs::operations::fund::Fund;
use tongo::structs::common::pubkey::PubKey;

use crate::global::operations::{fundOperation};
use snforge_std::{start_cheat_caller_address};

#[test]
#[should_panic(expected: "PubKey is not an EcPoint")]
fn tamperPubKey() {
    let x = 12398109328;

    let (Global, ledger_address, _Ledger) = full_setup();
    let tongoAmount = 250;
    let sender = USER_ADDRESS;
    let fee_to_sender =  0;

    let operation = fundOperation(x, 0, tongoAmount, sender, fee_to_sender, ledger_address);
    let operation2 = fundOperation(x, 0, tongoAmount, sender, fee_to_sender, ledger_address);

    start_cheat_caller_address(GLOBAL_ADDRESS,sender);
    Global.fund(operation);


    let tamperTo =  PubKey {x: operation2.to.x, y: operation2.to.y + 1 };
    let tamperOperation = Fund { to: tamperTo, ..operation2};
    Global.fund(tamperOperation);
}
