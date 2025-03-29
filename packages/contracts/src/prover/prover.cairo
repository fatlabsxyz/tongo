use crate::verifier::structs::{ProofOfWithdraw, InputsWithdraw};
//use crate::verifier::structs::{ InputsTransfer };
use crate::verifier::structs::{ ProofOfBit };

use crate::verifier::utils::{g_epoch, challenge_commits, generator_h, feltXOR};
use crate::prover::utils::{generate_random, compute_s, simPOE};

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

//pub fn prove_transfer(inputs: InputsTransfer, x:felt252, b0:felt252, b:felt252, seed:felt252) {
//    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
//    let [g_x,g_y] = g_epoch(inputs.epoch);
//    let g_epoch = EcPointTrait::new(g_x,g_y).unwrap();
//    let nonce: NonZeroEcPoint  = g_epoch.mul(x).try_into().unwrap();
//
//    let b_bin = to_binary(b.try_into().unwrap());
//    let mut proof = array![];
//    let mut R = array![];
//    let mut i:u32 = 0;
//    while i < 32 {
//        let r = generate_random(seed, i.try_into().unwrap()+1);
//        let pi = prove_bit(*b_bin[i],r);
//        R.append(r);
//        proof.append(pi);
//        i = i + 1;
//    };
//}


/// Generate the proof that assert that V = g**b h**r encodes a bit b that is either 0 or 1.
pub fn prove_bit(b:u8, r:felt252) -> ProofOfBit {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let [hx,hy] = generator_h();
    let h = EcPointTrait::new(hx,hy).unwrap();
    //if b == 0 we follow the standar poe for 0 and simulate for 1
    if b== 0 {
        let V = h.mul(r);
        let V_1:NonZeroEcPoint = (V - g).try_into().unwrap();
        let k : felt252 = generate_random(r,1);
        let A0:NonZeroEcPoint = h.mul(k).try_into().unwrap();

        let (A1, c_1, s_1) = simPOE([V_1.x(), V_1.y()], [hx,hy], r);
        let mut commits = array![[A0.x(), A0.y()],A1];
        let c = challenge_commits(ref commits);
        let c_0 = feltXOR(c, c_1);
        let s_0 = compute_s(c_0, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V:[V.try_into().unwrap().x(),V.try_into().unwrap().y()],
            A0: [A0.x(), A0.y()],
            A1,
            c0:c_0,
            s0:s_0,
            s1:s_1
        };
        return pi;
    // if b == 1 we follow the standar poe for 1 and simulate for 0
    } else {
        //TODO: throw an error if b is not 0 nor 1.
        let V:NonZeroEcPoint = (g + h.mul(r)).try_into().unwrap();
        let (A0,c_0,s_0) = simPOE([V.x(), V.y()],generator_h(),r);

//        let V_1 = V - g;
        let k = generate_random(r,2);
        let A1:NonZeroEcPoint = h.mul(k).try_into().unwrap();
        let mut commits = array![A0, [A1.x(), A1.y()]];
        let c = challenge_commits(ref commits);
        let c_1 = feltXOR(c, c_0);
        let s_1 = compute_s(c_1, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V:[V.try_into().unwrap().x(),V.try_into().unwrap().y()],
            A0,
            A1:[A1.x(),A1.y()],
            c0:c_0,
            s0:s_0,
            s1:s_1};
        return pi;
    }
}
