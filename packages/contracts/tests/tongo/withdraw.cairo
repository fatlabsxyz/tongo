use starknet::ContractAddress;
use crate::tongo::setup::{setup_tongo};

use crate::prover::functions::{prove_withdraw_all, prove_withdraw, prove_fund};
use crate::prover::utils::generate_random;
use tongo::main::ITongoDispatcherTrait;
use tongo::verifier::structs::{Fund, Withdraw, WithdrawAll};

use tongo::verifier::structs::{PubKeyTrait};
use tongo::verifier::structs::{CipherBalanceTrait};


#[test]
fn test_withdraw_all() {
    let seed = 12931238;
    let (_address, dispatcher) = setup_tongo();
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));
    let b = 250;
    dispatcher.fund(Fund { to: y, amount: b, proof: fund_proof });

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs, proof) = prove_withdraw_all(
        x, b, tranfer_address, balance.CL, balance.CR, nonce, seed
    );

    dispatcher.withdraw_all(WithdrawAll { from: y, amount: b, to: tranfer_address, proof });
    let balance = dispatcher.get_balance(y);
    assert!(balance.is_zero(), "fail");

   let pending = dispatcher.get_pending(y);
    assert!(pending.is_zero(), "fail")
}

#[test]
fn test_withdraw() {
    let seed = 8309218;
    let (_address, dispatcher) = setup_tongo();
    let tranfer_address: ContractAddress = 'asdf'.try_into().unwrap();

    let x = generate_random(seed, 1);
    let y = PubKeyTrait::from_secret(x);
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof) = prove_fund(x, nonce, generate_random(seed + 1, 1));

    let initial_balance = 250;
    let amount = 50;
    dispatcher.fund(Fund { to: y, amount: initial_balance, proof: fund_proof });

    let balance = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs, proof) = prove_withdraw(
        x, initial_balance, amount, tranfer_address, balance.CL, balance.CR, nonce, seed
    );

    dispatcher.withdraw(Withdraw { from: y, amount, to: tranfer_address, proof });
}
