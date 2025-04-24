use crate::tongo::setup::{setup_tongo};
use tongo::prover::utils::{generate_random};
use tongo::prover::prover::{prove_transfer, prove_fund};

use tongo::main::ITongoDispatcherTrait;
use tongo::verifier::structs::{PubKeyTrait};

#[test]
fn test_transfer() {
    let seed = 1293123841;
    let (_address,dispatcher) = setup_tongo();
    
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    let x_bar = generate_random(seed,2);
    let y_bar = PubKeyTrait::from_secret(x_bar);

    let nonce = dispatcher.get_nonce(y);
    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    
    let b0 = 3124;
    dispatcher.fund(y, b0, fund_proof);

    let ((CLx,CLy),(CRx,CRy)) = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);
    
    let b = 100; 
    let (inputs, proof) = prove_transfer(x, y_bar, b0,b, [CLx,CLy], [CRx,CRy],nonce, seed + 1);
    dispatcher.transfer(
        inputs.y,
        inputs.y_bar,
        inputs.L,
        inputs.L_bar,
        inputs.L_audit,
        inputs.R,
        proof,
    );

}

#[test]
fn test_benchmark_prover() {
    let seed = 1293123841;
    let (_address,dispatcher) = setup_tongo();
    
    let x = generate_random(seed,1);
    let y = PubKeyTrait::from_secret(x);
    let x_bar = generate_random(seed,2);
    let y_bar = PubKeyTrait::from_secret(x_bar);
    let nonce = dispatcher.get_nonce(y);

    let (_fund_inputs, fund_proof ) = prove_fund(x, nonce, generate_random(seed+1,1));
    
    let b0 = 3124;
    dispatcher.fund(y, b0, fund_proof);

    let ((CLx,CLy),(CRx,CRy)) = dispatcher.get_balance(y);
    let nonce = dispatcher.get_nonce(y);
    
    let b = 100; 
    let (_inputs, _proof) = prove_transfer(x, y_bar, b0,b, [CLx,CLy], [CRx,CRy],nonce, seed + 1);
}
