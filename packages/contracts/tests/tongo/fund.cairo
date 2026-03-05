use crate::tongo::setup::{setup_tongo};
use tongo::tongo::ITongo::{ITongoDispatcherTrait};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use crate::consts::{USER_ADDRESS, STRK_ADDRESS};
use tongo::structs::operations::fund::OutsideFund;

use crate::tongo::operations::{fundOperation};
use crate::prover::utils::{decipher_balance, pubkey_from_secret};

#[test]
fn test_fund() {
    let x = 12398109328;

    let (_tongo_address, dispatcher) = setup_tongo();
    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let tongoAmount = 250;
    let sender = USER_ADDRESS;
    let fee_to_sender =  0;

    let operation = fundOperation(x, 0, tongoAmount, sender, fee_to_sender,dispatcher);
    dispatcher.fund(operation);

    let finalErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let rate = dispatcher.get_rate();
    assert(initialErc20 - finalErc20 == rate*tongoAmount.into(), 'nope');
}

#[test]
fn test_outside_fund() {
    let x = 1192032130921;
    let to = pubkey_from_secret(x);

    let (_tongo_address, dispatcher) = setup_tongo();
    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let tongoAmount = 250;
    
    let outsideFund = OutsideFund {to, amount: tongoAmount};

    dispatcher.outside_fund(outsideFund);

    let finalErc20 = erc20dispatcher.balance_of(USER_ADDRESS);
    let rate = dispatcher.get_rate();
    assert(initialErc20 - finalErc20 == rate*tongoAmount.into(), 'nope');

    let pending = dispatcher.get_pending(to);
    decipher_balance(tongoAmount.into(), x.into(), pending);
}
