use crate::verifier::structs::{ProofOfWithdraw, InputsWithdraw};
use crate::verifier::utils::{g_epoch, challenge_commits};
use crate::prover::utils::{generate_random, compute_s };

use core::ec::stark_curve::{GEN_X,GEN_Y};
use core::ec::{NonZeroEcPoint, EcPointTrait};


pub fn prove_withdraw(inputs: InputsWithdraw, x:felt252, seed:felt252) -> ProofOfWithdraw {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let R = EcPointTrait::new_nz(*inputs.R.span()[0],  *inputs.R.span()[1]).unwrap();
    let [g_x,g_y] = g_epoch(inputs.epoch);
    let g_epoch = EcPointTrait::new(g_x,g_y).unwrap();
    let nonce: NonZeroEcPoint  = g_epoch.mul(x).try_into().unwrap();

    //poe for y = g**x and L/g**b = R**x
    let k = generate_random(seed+1,1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    let A_cr: NonZeroEcPoint = EcPointTrait::mul(R.try_into().unwrap(), k).try_into().unwrap();
    let A_u: NonZeroEcPoint = EcPointTrait::mul(g_epoch.try_into().unwrap(), k).try_into().unwrap();
    let mut commits = array![
        [A_x.x(),A_x.y()],
        [A_u.x(),A_u.y()],
        [A_cr.x(),A_cr.y()],
    ];
    let c = challenge_commits(ref commits);
    let s = compute_s(c, x, k);

    let proof: ProofOfWithdraw = ProofOfWithdraw {
        nonce: [nonce.x(), nonce.y()],
        A_n: [A_u.x(), A_u.y()],
        A_x: [A_x.x(), A_x.y()],
        A_cr: [A_cr.x(), A_cr.y()],
        s_x: s,
    };
    return proof;
}


