//use core::pedersen::PedersenTrait;
//use core::hash::HashStateTrait;
use core::ec::stark_curve::{GEN_X,GEN_Y};
use core::ec::EcPointTrait;
use tongo::verifier::utils::{challenge_commits2, compute_prefix};
use tongo::verifier::structs::StarkPoint;
use crate::prover::utils::generate_random;
use crate::prover::functions::prove_fund;
use tongo::verifier::utils::generator_h;
use tongo::verifier::utils::view_key;

use crate::prover::functions::{prove_withdraw};
use tongo::verifier::verifier::{verify_withdraw};
use tongo::verifier::structs::PubKeyTrait;
use tongo::verifier::structs::{CipherBalanceTrait};
use crate::prover::functions::{prove_transfer};
use tongo::verifier::verifier::verify_transfer;


//#[test]
fn test_challenge_commits2() {
    let g = StarkPoint{x:GEN_X, y:GEN_Y};
    let mut commits = array![g,g];
    let c =challenge_commits2('transfer', ref commits);
    println!("Hash: {:?}",c);
}

//#[test]
fn test_compute_prefix() {
    let mut seq = array![1,2];
    let prefix = compute_prefix(ref seq);
    println!("Prefix: {:?}",prefix);
}

//#[test]
fn selectors() {
    println!("fund: {:?}", 'fund');
    println!("withdraw: {:?}", 'withdraw');
    println!("withdraw_all: {:?}", 'withdraw_all');
    println!("transfer: {:?}", 'transfer');
}

//#[test]
fn random() {
    let c = generate_random(123,456);
    println!("Random: {:?}",c);
}

//#[test]
fn prove_fund_test() {
    let x = 1234;
    let nonce = 10;
    let seed = 89898989;
    let (_intpus, proof) = prove_fund(x, nonce,seed);
    println!("Ax {:?}", proof.Ax.x);
    println!("Ay {:?}", proof.Ax.y);
    println!("sx {:?}", proof.sx);
}

//#[test]
fn show_H(){
    println!("Gx: {:?}", GEN_X);
    println!("Gy: {:?}", GEN_Y);
    let H = generator_h();
    println!("Hx: {:?}", H.x());
    println!("Hy: {:?}", H.y());
    let view = view_key();
    println!("view.x: {:?}", view.x);
    println!("view.y: {:?}", view.y);
}

//#[test]
fn cipher_balance_ts() {
    let x = 888;
    let y = PubKeyTrait::from_secret(x);
    let amount = 100;
    let random = 99;
    let balance = CipherBalanceTrait::new(y, amount,random);
    println!("Cipher: {:?}", balance);
}

//#[test]
fn ts_withdraw() {
    let x = 888;
    let y = PubKeyTrait::from_secret(x);
    let initial_balance = 100;
    let transfer_addres = 555;

    let balance = CipherBalanceTrait::new(y, initial_balance, 99);

    let amount = 10;
    let nonce = 2;
    let (inputs, proof) = prove_withdraw(
        x,
        initial_balance,
        amount,
        transfer_addres.try_into().unwrap(),
        balance.CL,
        balance.CR,
        nonce,
        12,
    );
    verify_withdraw(inputs, proof);
}

#[test]
fn test_transfer_ts() {
    let x = 4444;
    let y = PubKeyTrait::from_secret(x);
    let x_bar = 7777;
    let y_bar = PubKeyTrait::from_secret(x_bar);

    // balance stored
    let b0 = 100;
    let r0 = 999;
    let balance = CipherBalanceTrait::new(y, b0, r0);
    // end of setup

    let b = 10;
    let nonce = 82;

    let seed = 5;
    let (inputs, proof) = prove_transfer( x, y_bar, b0, b, balance.CL, balance.CR, nonce,seed);

    verify_transfer(inputs, proof);
}
