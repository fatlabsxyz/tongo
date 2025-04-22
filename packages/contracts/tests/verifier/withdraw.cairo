use tongo::prover::utils::{cipher_balance,generate_random};
use tongo::prover::prover::{prove_withdraw};
use tongo::verifier::verifier::{verify_withdraw};
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::NonZeroEcPoint;
use core::ec::EcPointTrait;


#[test]
fn test_withdraw(){
    let seed = 21389321;
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();

    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = EcPointTrait::mul(g, x).try_into().unwrap();
    
    // balance stored
    let initial_balance = 100;
    let r0 = generate_random(seed,2);
    let (CL, CR) = cipher_balance(initial_balance, [y.x(), y.y()], r0);
    // end of setup

    let amount = 10;

    let (inputs, proof) = prove_withdraw(x, initial_balance, amount, CL, CR,generate_random(seed, 3));
    verify_withdraw(inputs, proof);
}

