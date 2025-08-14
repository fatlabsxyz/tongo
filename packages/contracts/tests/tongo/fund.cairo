use crate::tongo::setup::{setup_tongo};
use tongo::tongo::ITongo::{ITongoDispatcherTrait};
use tongo::erc20::{IERC20DispatcherTrait, IERC20Dispatcher};
use crate::consts::{USER_CALLER, STRK_ADDRESS};

use crate::tongo::operations::{fundOperation};

#[test]
fn test_fund() {
    let x = 12398109328;

    let (_tongo_address, dispatcher) = setup_tongo();
    let erc20dispatcher = IERC20Dispatcher {contract_address: STRK_ADDRESS};
    let initialErc20 = erc20dispatcher.balance_of(USER_CALLER);
    let tongoAmount = 250;

    let operation = fundOperation(x,0, tongoAmount,dispatcher);
    dispatcher.fund(operation);

    let finalErc20 = erc20dispatcher.balance_of(USER_CALLER);
    let rate = dispatcher.get_rate();
    assert(initialErc20 - finalErc20 == rate*tongoAmount.into(), 'nope');
}

