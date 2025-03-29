use core::ec::stark_curve::{GEN_X, GEN_Y, ORDER};
use core::ec::{EcStateTrait, EcPointTrait, NonZeroEcPoint};
use tongo::verifier::verifier::{poe,poc, por,oneORzero, proofoftransfer};
use tongo::verifier::utils::{challenge_commits, in_order};
use tongo::verifier::structs::{ProofOfCipher};
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;

use crate::verifier::utils::{simPOE, create_proofofbit, cipher_balance, prover_poe};
use tongo::prover::utils::{compute_s, generate_random};



#[test]
fn test_poe(){
    //setup
    let x: felt252 = 123456789;
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    
    //generatin the proof (A_x,c,s)
    let seed = 38120931;
    let k = generate_random(seed, 1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), k).try_into().unwrap();
    let mut commit = array![[A_x.x(),A_x.y()]];
    let c = challenge_commits(ref commit);
    let s = compute_s(c, x, k);
    //Verify
    poe([y.x(), y.y()], [g.x(),g.y()], [A_x.x(), A_x.y()], c, s);
    
    let (A_x,c, s ) = prover_poe([GEN_X, GEN_Y],x, seed);
    poe([y.x(), y.y()], [g.x(),g.y()], A_x, c, s);
}

#[test]
fn test_simulatePOE() {
    //setup
    let x: felt252 = 123456789;
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();

    let (A_x, c, s) = simPOE([y.x(), y.y()], [g.x(), g.y()],37192873);
    poe([y.x(), y.y()], [g.x(),g.y()], A_x, c, s);
}



/// In this test the prover commits to V_0, V_1 and only knows the exponent of V_0. He wants to convice
/// the verifier that he knows one of the two. He knows V_0, so he follows the standar procedure to prove
/// the exponent. He does not know the exponent of V_1, so he will simulates the proof. In order for the 
/// verifier to not know in which case (0 or 1) the correct protocol was followed, the chose of the challenge
/// has to be modified. At the end the verifier will assert for two poe the two will pass but he cannot know which one
/// was simulated.
#[test]
fn test_OR0() {
    let seed = 371928371;
    let x = generate_random(seed,1);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let h:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    let r = generate_random(seed,2);
    
    let pi = create_proofofbit(0,[h.x(), h.y()],r);
    oneORzero(pi);
}

#[test]
fn test_OR1() {
    let seed = 47198274198273;
    let x = generate_random(seed,1);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let h:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    let r = generate_random(seed,2);
    
    let pi = create_proofofbit(1,[h.x(), h.y()],r);
    oneORzero(pi);
}


#[test]
fn test_poc() { 
    let seed = 73198273;
    let x = generate_random(seed,1);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x_bar).try_into().unwrap();
    let r = generate_random(seed,3);
    let R = EcPointTrait::mul(g.try_into().unwrap(), r).try_into().unwrap();
    let r2 = r;
    let b = 20;
    let mut state = EcStateTrait::init();
        state.add_mul(b,g);
        state.add_mul(r2,y);
    let L = state.finalize_nz().unwrap();

    let b_bar = 20;
    let mut state = EcStateTrait::init();
        state.add_mul(b_bar,g);
        state.add_mul(r2,y_bar);
    let L_bar = state.finalize_nz().unwrap();
    
    let k_r = generate_random(seed,4);
    let A_r = EcPointTrait::mul(g.try_into().unwrap(), k_r).try_into().unwrap();
    let mut commit = array![[A_r.x(),A_r.y()]];
    let c = challenge_commits(ref commit);
    let s_r = compute_s(c, r, k_r);
    
    let h = y.try_into().unwrap() - y_bar.try_into().unwrap();
    let A_b = EcPointTrait::mul(h, k_r).try_into().unwrap();
    
    let pi: ProofOfCipher = ProofOfCipher {
        L:[L.x(),L.y()],
        L_bar:[L_bar.x(),L_bar.y()],
        R:[R.x(),R.y()],
        A_r:[A_r.x(), A_r.y()],
        A_b:[A_b.x(), A_b.y()],
        s_r,
        s_b:1000,
    };
    poc([y.x(),y.y()], [y_bar.x(), y_bar.y()], pi);
}


#[test]
fn test_range() {
    let seed = 47198274198273;
    let x = generate_random(seed,0);
    let g:NonZeroEcPoint = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let h:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    //b = 3529162937 = 0b11010010010110101100000010111001
    // in bigintheend: 10011101000000110101101001001011
    let b0 = 3529162937;
    let b = array![1,0,0,1,1,1,0,1,0,0,0,0,0,0,1,1,0,1,0,1,1,0,1,0,0,1,0,0,1,0,1,1,];
    let mut proof = array![];
    let mut R = array![];
    let mut i:u32 = 0;
    while i < 32 {
        let r = generate_random(seed, i.try_into().unwrap()+1);
        let pi = create_proofofbit(*b[i],[h.x(), h.y()],r);
        R.append(r);
        proof.append(pi);
        i = i + 1;
    };

    let mut pow:felt252 = 1;
    let mut r: felt252 = 0;
    let mut i:u32 = 0;
    while i < 32 {
        r = compute_s(*R[i],pow,r);
        i = i+1;
        pow = 2*pow;
    };
    let mut state = EcStateTrait::init();
        state.add_mul(b0,g);
        state.add_mul(r,h);
    let V = state.finalize_nz().unwrap();
    
    por([V.x(), V.y()], proof.span());
}

#[test]
fn test_transfer() {
    // setup
    let g:NonZeroEcPoint = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();

    let seed = 47198274198273;
    let ultra_secret = generate_random(seed,0);
    let h:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), ultra_secret).try_into().unwrap();

    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    
    let x_bar = generate_random(seed,2);
    let y_bar:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x_bar).try_into().unwrap();
    let b_num = 3529162937;
    let b0 = b_num + 2;
    let r0 = generate_random(seed,3);
    
    let (CL, CR) = cipher_balance(b0, [y.x(), y.y()], r0);
    // end of setup
    
    //we want to transfer b to y_bar
    let b = array![1,0,0,1,1,1,0,1,0,0,0,0,0,0,1,1,0,1,0,1,1,0,1,0,0,1,0,0,1,0,1,1,];
    let mut proof = array![];
    let mut R = array![];
    let mut i:u32 = 0;
    while i < 32 {
        let r = generate_random(seed, i.try_into().unwrap()+1);
        let pi = create_proofofbit(*b[i],[h.x(), h.y()],r);
        R.append(r);
        proof.append(pi);
        i = i + 1;
    };

    let mut pow:felt252 = 1;
    let mut r: felt252 = 0;
    let mut i:u32 = 0;
    while i < 32 {
        r = compute_s(*R[i],pow,r);
        i = i+1;
        pow = 2*pow;
    };
    let mut state = EcStateTrait::init();
        state.add_mul(b_num,g);
        state.add_mul(r,h);
    let V = state.finalize_nz().unwrap();
    
    let (L,R) = cipher_balance(b_num, [y.x(), y.y()], r);
    let (L_bar,_R_bar) = cipher_balance(b_num, [y_bar.x(), y_bar.y()], r);

    // sobran 2 pesos. hay que hacer lo mismo para eso
    let b = array![0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,];
    let mut proof2 = array![];
    let mut R_temp = array![];
    let mut i:u32 = 0;
    while i < 32 {
        let r = generate_random(seed, i.try_into().unwrap() + 100);
        let pi = create_proofofbit(*b[i],[h.x(), h.y()],r);
        R_temp.append(r);
        proof2.append(pi);
        i = i + 1;
    };

    let mut pow:felt252 = 1;
    let mut r2: felt252 = 0;
    let mut i:u32 = 0;
    while i < 32 {
        r2 = compute_s(*R_temp[i],pow,r2);
        i = i+1;
        pow = 2*pow;
    };
    let mut state = EcStateTrait::init();
        state.add_mul(2,g);
        state.add_mul(r2,h);
    let V2 = state.finalize_nz().unwrap();

    let CR = EcPointTrait::new(*CR.span()[0], *CR.span()[1]).unwrap();
    let R = EcPointTrait::new(*R.span()[0], *R.span()[1]).unwrap();
    let G:NonZeroEcPoint = (CR - R).try_into().unwrap();

    let CL = EcPointTrait::new(*CL.span()[0], *CL.span()[1]).unwrap();
    let L = EcPointTrait::new(*L.span()[0], *L.span()[1]).unwrap();
//    let Y:NonZeroEcPoint = (CL - L).try_into().unwrap();

    //TODO: Clase para que le haga rand.get() y me de un random distinto
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

    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(A_x.x())
            .update(A_x.y())
            .update(A_r.x())
            .update(A_r.y())
            .update(A_b.x())
            .update(A_b.y())
            .update(A_bar.x())
            .update(A_bar.y())
            .update(A_v.x())
            .update(A_v.y())
            .update(A_b2.x())
            .update(A_b2.y())
            .update(A_v2.x())
            .update(A_v2.y())
            .update(salt)
        .finalize();
        salt = salt + 1;
    };

    let s_x = compute_s(c,x, kx);
    let s_b = compute_s(c,b_num, kb);
    let s_r = compute_s(c,r, kr);
    let s_b2 = compute_s(c,2, kb2);
    let s_r2 = compute_s(c,r2, kr2);


    proofoftransfer(
        [CL.try_into().unwrap().x(), CL.try_into().unwrap().y()],
        [CR.try_into().unwrap().x(), CR.try_into().unwrap().y()],
        [y.x(),y.y()],
        [y_bar.x(),y_bar.y()],
        [h.x(),h.y()],
        [L.try_into().unwrap().x(), L.try_into().unwrap().y()],
        L_bar,
        [R.try_into().unwrap().x(), R.try_into().unwrap().y()],  
        [A_r.x(),A_r.y()],
        [A_x.x(),A_x.y()],
        [A_b.x(),A_b.y()],
        [A_bar.x(),A_bar.y()],
        [A_v.x(),A_v.y()],
        [A_b2.x(),A_b2.y()],
        [A_v2.x(),A_v2.y()],
        s_r,
        s_x,
        s_b,
        s_b2,
        s_r2,
        [V.x(), V.y()],
        [V2.x(), V2.y()],
        proof,
        proof2,
    );
}
