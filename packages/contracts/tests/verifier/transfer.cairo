use core::ec::{EcPointTrait};
use core::ec::{NonZeroEcPoint, EcStateTrait};
use core::ec::stark_curve::{GEN_X,GEN_Y};
use crate::verifier::utils::{cipher_balance};

use tongo::verifier::structs::{InputsTransfer, ProofOfTransfer};
use tongo::verifier::utils::{challenge_commits, g_epoch, generator_h};
use tongo::prover::utils::{generate_random, compute_s};
use tongo::prover::prover::{prove_range};
use tongo::verifier::verifier::verify_transfer;


#[test]
fn test_transfer() {
    // setup
    let [hx,hy] = generator_h();
    let h = EcPointTrait::new_nz(hx,hy).unwrap();
    let g:NonZeroEcPoint = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();

    let seed = 47198274198273;
    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x_bar).try_into().unwrap();
    
    // balance stored
    let b0 = 100;
    let r0 = generate_random(seed,3);
    let (CL, CR) = cipher_balance(b0, [y.x(), y.y()], r0);
    // end of setup

    //balance to transfer
    let b = 30;
    let (r, V, proof ) = prove_range(b.try_into().unwrap(), generate_random(seed+1, 1));
    
    let (L,R) = cipher_balance(b, [y.x(), y.y()], r);
    let (L_bar,_R_bar) = cipher_balance(b, [y_bar.x(), y_bar.y()], r);

    let b_left = b0-b;
    let (r2, V2, proof2 ) = prove_range(b_left.try_into().unwrap(), generate_random(seed+2, 1));

    let CR = EcPointTrait::new(*CR.span()[0], *CR.span()[1]).unwrap();
    let R = EcPointTrait::new(*R.span()[0], *R.span()[1]).unwrap();
    let G:NonZeroEcPoint = (CR - R).try_into().unwrap();

    let CL = EcPointTrait::new(*CL.span()[0], *CL.span()[1]).unwrap();
    let L = EcPointTrait::new(*L.span()[0], *L.span()[1]).unwrap();
//    let Y:NonZeroEcPoint = (CL - L).try_into().unwrap();
    
    let this_epoch:u64 = 123456 ;
    let [g_x, g_y] = g_epoch(this_epoch);
    let g_epoch = EcPointTrait::new(g_x,g_y).unwrap();
    let u = g_epoch.mul(x);

    let kx = generate_random(seed+1 ,0);
    let kb = generate_random(seed+1 ,1);
    let kr = generate_random(seed+1 ,2);
    let kb2 = generate_random(seed+1 ,3);
    let kr2 = generate_random(seed+1 ,4);

    let A_x:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kx).try_into().unwrap();
    let A_n:NonZeroEcPoint = EcPointTrait::mul(g_epoch.try_into().unwrap(), kx).try_into().unwrap();
    let A_r:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kr).try_into().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, y);
    let A_b = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, y_bar);
    let A_bar = state.finalize_nz().unwrap();
    
    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, h);
    let A_v = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb2, g);
        state.add_mul(kx, G);
    let A_b2 = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb2, g);
        state.add_mul(kr2, h);
    let A_v2 = state.finalize_nz().unwrap();

    let mut commits = array![
         [A_x.x() , A_x.y()],
         [A_n.x() , A_n.y()],
         [A_r.x() , A_r.y()],
         [A_b.x() , A_b.y()],
         [A_b2.x() , A_b2.y()],
         [A_v.x() , A_v.y()],
         [A_v2.x() , A_v2.y()],
         [A_bar.x() , A_bar.y()],
    ];
    let c = challenge_commits(ref commits);

    let s_x = compute_s(c,x, kx);
    let s_b = compute_s(c,b, kb);
    let s_r = compute_s(c,r, kr);
    let s_b2 = compute_s(c, b_left, kb2);
    let s_r2 = compute_s(c,r2, kr2);

    let inputs: InputsTransfer = InputsTransfer {
        y:[y.x(), y.y()],
        y_bar:[y_bar.x(), y_bar.y()],
        epoch:this_epoch,
        CR:[CR.try_into().unwrap().x(), CR.try_into().unwrap().y()],
        CL:[CL.try_into().unwrap().x(), CL.try_into().unwrap().y()],
        R:[R.try_into().unwrap().x(), R.try_into().unwrap().y()],
        L:[L.try_into().unwrap().x(), L.try_into().unwrap().y()],
        L_bar,
        V:V,
        V2:V2,
    };

    let proof: ProofOfTransfer = ProofOfTransfer {
        nonce: [u.try_into().unwrap().x(), u.try_into().unwrap().y()],
        A_x:[A_x.x() , A_x.y()],
        A_n:[A_n.x() , A_n.y()],
        A_r:[A_r.x() , A_r.y()],
        A_b:[A_b.x() , A_b.y()],
        A_b2:[A_b2.x() , A_b2.y()],
        A_v:[A_v.x() , A_v.y()],
        A_v2:[A_v2.x() , A_v2.y()],
        A_bar:[A_bar.x() , A_bar.y()],
        s_x,
        s_r,
        s_b,
        s_b2,
        s_r2,
        range: proof,
        range2: proof2,
    };

    verify_transfer(inputs,proof);
}
