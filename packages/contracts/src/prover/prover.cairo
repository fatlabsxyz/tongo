use crate::verifier::structs::{ProofOfWitdhrawAll,InputswithdrawAll};
use crate::verifier::structs::{ProofOfWithdraw, Inputswithdraw};
use crate::verifier::structs::{ InputsTransfer, ProofOfTransfer };
use crate::verifier::structs::{ ProofOfBit, ProofOfBit2 };

use crate::verifier::utils::{ challenge_commits, generator_h, feltXOR, view_key};
use crate::prover::utils::{generate_random, compute_s, compute_z, simPOE, to_binary, cipher_balance};

use core::ec::stark_curve::{GEN_X,GEN_Y};
use core::ec::{NonZeroEcPoint, EcPointTrait, EcStateTrait};


/// Generate the prove necesary to make a withdraw transaction. In this version the withdraw is for all the balance
/// that is stored in the y=g**x account.
pub fn prove_withdraw_all(
        x:felt252,
        amount:felt252,
        CL:[felt252;2],
        CR:[felt252;2],
        seed:felt252
) -> (InputswithdrawAll, ProofOfWitdhrawAll) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let R = EcPointTrait::new_nz(*CR.span()[0],  *CR.span()[1]).unwrap();

    //poe for y = g**x and L/g**b = R**x
    let k = generate_random(seed+1,1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    let A_cr: NonZeroEcPoint = EcPointTrait::mul(R.try_into().unwrap(), k).try_into().unwrap();
    let mut commits = array![
        [A_x.x(),A_x.y()],
        [A_cr.x(),A_cr.y()],
    ];
    let c = challenge_commits(ref commits);
    let s = compute_s(c, x, k);

    let proof: ProofOfWitdhrawAll = ProofOfWitdhrawAll {
        A_x: [A_x.x(), A_x.y()],
        A_cr: [A_cr.x(), A_cr.y()],
        s_x: s,
    };

    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(),x).try_into().unwrap();
    let inputs: InputswithdrawAll = InputswithdrawAll {
        y: [y.x(), y.y()],
        amount: amount,
        L: CL,
        R: CR,
    };
    return (inputs,proof);
}

pub fn prove_withdraw(
        x:felt252,
        initial_balance: felt252,
        amount:felt252,
        CL:[felt252;2],
        CR:[felt252;2],
        seed:felt252
) -> (Inputswithdraw, ProofOfWithdraw) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = g.try_into().unwrap().mul(x).try_into().unwrap();
    let R = EcPointTrait::new_nz(*CR.span()[0], *CR.span()[1]).unwrap();
    let L = EcPointTrait::new_nz(*CL.span()[0], *CL.span()[1]).unwrap();
    let [hx,hy] = generator_h();
    let h = EcPointTrait::new_nz(hx,hy).unwrap();

    let left = initial_balance-amount;

    let (r, RangeProof) = prove_range(left.try_into().unwrap(), generate_random(seed+1,0));

    let kb = generate_random(seed,3);
    let kx = generate_random(seed,4);
    let kr = generate_random(seed,5);

    let A_x:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kx).try_into().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kx, R);
    let A = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, h);
    let A_v = state.finalize_nz().unwrap();

    let mut commits = array![[A_x.x(), A_x.y()], [A.x(), A.y()], [A_v.x(),A_v.y()]];
    let c = challenge_commits(ref commits);
    let sb = compute_s(c,left,kb);
    let sx = compute_s(c,x,kx);
    let sr = compute_s(c,r,kr);

    let proof: ProofOfWithdraw = ProofOfWithdraw {
        A_x: [A_x.x(),A_x.y()],
        A: [A.x(),A.y()],
        A_v: [A_v.x(),A_v.y()],
        sx: sx,
        sb: sb,
        sr: sr,
        range: RangeProof,
    };

    let inputs: Inputswithdraw = Inputswithdraw {
        y: [y.x(), y.y()],
        amount: amount,
        L: [L.x(),L.y()],
        R: [R.x(),R.y()],
    };
    return (inputs, proof);
}

pub fn prove_transfer(
    x:felt252,
    y_bar:[felt252;2],
    b0:felt252,
    b:felt252,
    CL:[felt252;2],
    CR:[felt252;2],
    seed:felt252
) -> (InputsTransfer, ProofOfTransfer ) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = g.try_into().unwrap().mul(x).try_into().unwrap();
    let [h_x,h_y] = generator_h();
    let [view_x,view_y] = view_key();
    let h = EcPointTrait::new_nz(h_x,h_y).unwrap();
    
    
    let (r, proof ) = prove_range(b.try_into().unwrap(), generate_random(seed+1, 1));
    let (L,R) = cipher_balance(b, [y.x(), y.y()], r);
    let (L_bar,_R_bar) = cipher_balance(b, y_bar, r);
    let (L_audit,_R_audit) = cipher_balance(b, view_key() , r);

    let b_left = b0-b;
    let (r2, proof2 ) = prove_range(b_left.try_into().unwrap(), generate_random(seed+2, 1));


    let CR = EcPointTrait::new(*CR.span()[0], *CR.span()[1]).unwrap();
    let R = EcPointTrait::new(*R.span()[0], *R.span()[1]).unwrap();
    let G:NonZeroEcPoint = (CR - R).try_into().unwrap();

    let kx = generate_random(seed+1 ,0);
    let kb = generate_random(seed+1 ,1);
    let kr = generate_random(seed+1 ,2);
    let kb2 = generate_random(seed+1 ,3);
    let kr2 = generate_random(seed+1 ,4);

    let A_x:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kx).try_into().unwrap();
    let A_r:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kr).try_into().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, y);
    let A_b = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, EcPointTrait::new_nz(*y_bar.span()[0], *y_bar.span()[1]).unwrap());
    let A_bar = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, EcPointTrait::new_nz(view_x,view_y).unwrap());
    let A_audit = state.finalize_nz().unwrap();
    
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
         [A_r.x() , A_r.y()],
         [A_b.x() , A_b.y()],
         [A_b2.x() , A_b2.y()],
         [A_v.x() , A_v.y()],
         [A_v2.x() , A_v2.y()],
         [A_bar.x() , A_bar.y()],
         [A_audit.x() , A_audit.y()],
    ];
    let c = challenge_commits(ref commits);

    let s_x = compute_s(c,x, kx);
    let s_b = compute_s(c,b, kb);
    let s_r = compute_s(c,r, kr);
    let s_b2 = compute_s(c, b_left, kb2);
    let s_r2 = compute_s(c,r2, kr2);

    let inputs: InputsTransfer = InputsTransfer {
        y:[y.x(), y.y()],
        y_bar:y_bar,
        CR:[CR.try_into().unwrap().x(), CR.try_into().unwrap().y()],
        CL:CL,
        R:[R.try_into().unwrap().x(), R.try_into().unwrap().y()],
        L:L,
        L_bar,
        L_audit,
    };

    let proof: ProofOfTransfer = ProofOfTransfer {
        A_x:[A_x.x() , A_x.y()],
        A_r:[A_r.x() , A_r.y()],
        A_b:[A_b.x() , A_b.y()],
        A_b2:[A_b2.x() , A_b2.y()],
        A_v:[A_v.x() , A_v.y()],
        A_v2:[A_v2.x() , A_v2.y()],
        A_bar:[A_bar.x() , A_bar.y()],
        A_audit:[A_audit.x(), A_audit.y()],
        s_x,
        s_r,
        s_b,
        s_b2,
        s_r2,
        range: proof,
        range2: proof2,
    };
    return (inputs, proof);
}


/// Generate the proof that assert that V = g**b h**r encodes a bit b that is either 0 or 1.
/// Following standar OR for sigma protocols (read book of Dan Boneh for example) we follow 
/// the standar sigma proving protocol for the correct one and simultate the proof for the other one
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

/// Generate a element V = g**b h**r with a proof that b belongs to a range.
pub fn prove_range(b: u32, seed:felt252) -> (felt252, Span<ProofOfBit>) {
    let b_bin = to_binary(b);
    
    let mut proof = array![];
    let mut R = array![];
    let mut i:u32 = 0;
    while i < 32 {
        let r = generate_random(seed, i.try_into().unwrap()+1);
        let pi = prove_bit(*b_bin[i],r);
        R.append(r);
        proof.append(pi);
        i = i + 1;
    };

    let mut pow:felt252 = 1;
    let mut r: felt252 = 0;
    let mut i:u32 = 0;
    while i < 32 {
        //this magic trick let us sum compute de correct random
        r = compute_s(*R[i],pow,r);
        i = i+1;
        pow = 2*pow;
    };
    return (r, proof.span());
}


pub fn alternative_prove_bit(b:u8, r:felt252) -> ProofOfBit2 {
    let seed = 1293812;
    let b:felt252 = b.try_into().unwrap();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let [h_x, h_y] = generator_h();
    let h = EcPointTrait::new(h_x,h_y).unwrap();

    let V:NonZeroEcPoint = (g.mul(b) + h.mul(r)).try_into().unwrap();

    let kb = generate_random(seed,2);
    let kr = generate_random(seed,3);
    let t = generate_random(seed,4);
    
    let A:NonZeroEcPoint = (g.mul(kb) + h.mul(kr)).try_into().unwrap();
    let B:NonZeroEcPoint = (g.mul(b*kb) + h.mul(t)).try_into().unwrap();
    
    let mut commits = array![[A.x(), A.y()],[B.x(),B.y()]];
    let c = challenge_commits(ref commits);

    let sb = compute_s(c,b,kb);
    let sr = compute_s(c,r,kr);
    let z = compute_z(c,r,sb,t);

    ProofOfBit2 {
        V: [V.x(), V.y()],
        A: [A.x(), A.y()],
        B: [B.x(), B.y()],
        sb: sb,
        sr: sr,
        z:z,
    }
}
