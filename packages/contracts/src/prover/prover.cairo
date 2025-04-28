use crate::verifier::structs::{ProofOfWitdhrawAll, InputsWithdraw};
use crate::verifier::structs::{ProofOfWithdraw};
use crate::verifier::structs::{InputsTransfer, ProofOfTransfer};
use crate::verifier::structs::{ProofOfBit, ProofOfBit2};
use crate::verifier::structs::{InputsFund, ProofOfFund};
use crate::verifier::structs::{PubKey, PubKeyTrait};
use crate::verifier::structs::{StarkPoint};
use crate::verifier::structs::{CipherBalanceTrait};

use crate::verifier::utils::{compute_prefix, challenge_commits2};

use crate::verifier::utils::{challenge_commits, generator_h, feltXOR, view_key};
use crate::prover::utils::{generate_random, compute_s, compute_z, simPOE, to_binary};

use core::starknet::ContractAddress;
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{NonZeroEcPoint, EcPointTrait, EcStateTrait, EcPoint};


/// Generate the prove necesary to make a withdraw transaction. In this version the withdraw is for
/// all the balance that is stored in the y=g**x account.
pub fn prove_withdraw_all(
    x: felt252,
    amount: felt252,
    to: ContractAddress,
    CL: StarkPoint,
    CR: StarkPoint,
    nonce: u64,
    seed: felt252
) -> (InputsWithdraw, ProofOfWitdhrawAll) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let y = PubKeyTrait::from_secret(x);
    let R: NonZeroEcPoint = CR.try_into().unwrap();

    //poe for y = g**x and L/g**b = R**x
    let k = generate_random(seed + 1, 1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g, k).try_into().unwrap();
    let A_cr: NonZeroEcPoint = EcPointTrait::mul(R.try_into().unwrap(), k).try_into().unwrap();

    let mut seq: Array<felt252> = array!['withdraw_all', y.x, y.y, to.into(), nonce.into(),];
    let prefix = compute_prefix(ref seq);
    let mut commits: Array<StarkPoint> = array![A_x.into(), A_cr.into()];

    let c = challenge_commits2(prefix, ref commits);
    let s = compute_s(c, x, k);

    let proof: ProofOfWitdhrawAll = ProofOfWitdhrawAll {
        A_x: A_x.into(), A_cr: A_cr.into(), s_x: s,
    };

    let y = PubKeyTrait::from_secret(x);
    let inputs: InputsWithdraw = InputsWithdraw {
        y: y, amount: amount, to: to, nonce: nonce, L: CL, R: CR,
    };
    return (inputs, proof);
}

pub fn prove_fund(x: felt252, nonce: u64, seed: felt252) -> (InputsFund, ProofOfFund) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = PubKeyTrait::from_secret(x);
    let inputs: InputsFund = InputsFund { y: y, nonce: nonce };
    let mut seq: Array<felt252> = array!['fund', inputs.y.x, inputs.y.y, inputs.nonce.into(),];
    let prefix = compute_prefix(ref seq);

    //prover
    let k = generate_random(seed, 2);
    let Ax: NonZeroEcPoint = g.mul(k).try_into().unwrap();

    let mut commits: Array<StarkPoint> = array![Ax.into()];
    let c = challenge_commits2(prefix, ref commits);
    let s = compute_s(c, x, k);

    let proof: ProofOfFund = ProofOfFund { Ax: Ax.into(), sx: s };
    return (inputs, proof);
}

pub fn prove_withdraw(
    x: felt252,
    initial_balance: felt252,
    amount: felt252,
    to: ContractAddress,
    CL: StarkPoint,
    CR: StarkPoint,
    nonce: u64,
    seed: felt252
) -> (InputsWithdraw, ProofOfWithdraw) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = PubKeyTrait::from_secret(x);
    let R: NonZeroEcPoint = CR.try_into().unwrap();
    let L: NonZeroEcPoint = CL.try_into().unwrap();
    let h = generator_h();

    let left = initial_balance - amount;

    let (r, RangeProof) = prove_range(left.try_into().unwrap(), generate_random(seed + 1, 0));

    let kb = generate_random(seed, 3);
    let kx = generate_random(seed, 4);
    let kr = generate_random(seed, 5);

    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kx).try_into().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kx, R);
    let A = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kr, h);
    let A_v = state.finalize_nz().unwrap();

    let mut seq: Array<felt252> = array!['withdraw', y.x, y.y, to.into(), nonce.into(),];
    let prefix = compute_prefix(ref seq);
    let mut commits: Array<StarkPoint> = array![A_x.into(), A.into(), A_v.into()];
    let c = challenge_commits2(prefix, ref commits);
    let sb = compute_s(c, left, kb);
    let sx = compute_s(c, x, kx);
    let sr = compute_s(c, r, kr);

    let proof: ProofOfWithdraw = ProofOfWithdraw {
        A_x: A_x.into(), A: A.into(), A_v: A_v.into(), sx: sx, sb: sb, sr: sr, range: RangeProof,
    };

    let inputs: InputsWithdraw = InputsWithdraw {
        y: y, amount: amount, L: L.into(), R: R.into(), nonce: nonce, to: to,
    };
    return (inputs, proof);
}

pub fn prove_transfer(
    x: felt252,
    y_bar: PubKey,
    b0: felt252,
    b: felt252,
    CL: StarkPoint,
    CR: StarkPoint,
    nonce: u64,
    seed: felt252
) -> (InputsTransfer, ProofOfTransfer) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = PubKeyTrait::from_secret(x);
    let h = generator_h();
    let view = view_key();

    let (r, proof) = prove_range(b.try_into().unwrap(), generate_random(seed + 1, 1));
    let balance = CipherBalanceTrait::new(y, b, r);
    let (L, R) = (balance.CL, balance.CR);
    let L_bar = CipherBalanceTrait::new(y_bar, b, r).CL;
    let L_audit = CipherBalanceTrait::new(view, b, r).CL;

    let b_left = b0 - b;
    let (r2, proof2) = prove_range(b_left.try_into().unwrap(), generate_random(seed + 2, 1));

    //    let CR = EcPointTrait::new(*CR.span()[0], *CR.span()[1]).unwrap();
    let CR: NonZeroEcPoint = CR.try_into().unwrap();
    //TODO: Corregir
    let CR: EcPoint = CR.into();
    let R: NonZeroEcPoint = R.try_into().unwrap();
    let G: NonZeroEcPoint = (CR - R.into()).try_into().unwrap();

    let kx = generate_random(seed + 1, 0);
    let kb = generate_random(seed + 1, 1);
    let kr = generate_random(seed + 1, 2);
    let kb2 = generate_random(seed + 1, 3);
    let kr2 = generate_random(seed + 1, 4);

    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kx).try_into().unwrap();
    let A_r: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kr).try_into().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kr, y.try_into().unwrap());
    let A_b = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kr, EcPointTrait::new_nz(y_bar.x, y_bar.y).unwrap());
    let A_bar = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kr, EcPointTrait::new_nz(view.x, view.y).unwrap());
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

    let mut commits: Array<StarkPoint> = array![
        A_x.into(),
        A_r.into(),
        A_b.into(),
        A_b2.into(),
        A_v.into(),
        A_v2.into(),
        A_bar.into(),
        A_audit.into(),
    ];

    let mut seq: Array<felt252> = array![
        'transfer',
        y.x,
        y.y,
        y_bar.x,
        y_bar.y,
        L.x,
        L.y,
        R.try_into().unwrap().x(),
        R.try_into().unwrap().y(),
        nonce.into(),
    ];
    let prefix = compute_prefix(ref seq);
    let c = challenge_commits2(prefix, ref commits);

    let s_x = compute_s(c, x, kx);
    let s_b = compute_s(c, b, kb);
    let s_r = compute_s(c, r, kr);
    let s_b2 = compute_s(c, b_left, kb2);
    let s_r2 = compute_s(c, r2, kr2);

    let inputs: InputsTransfer = InputsTransfer {
        y: y,
        y_bar: y_bar,
        CR: CR.into(),
        CL: CL,
        R: R.try_into().unwrap(),
        L: L,
        L_bar: L_bar,
        L_audit: L_audit,
        nonce: nonce,
    };

    let proof: ProofOfTransfer = ProofOfTransfer {
        A_x: A_x.into(),
        A_r: A_r.into(),
        A_b: A_b.into(),
        A_b2: A_b2.into(),
        A_v: A_v.into(),
        A_v2: A_v2.into(),
        A_bar: A_bar.into(),
        A_audit: A_audit.into(),
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
pub fn prove_bit(b: u8, r: felt252) -> ProofOfBit {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let h = generator_h();
    //if b == 0 we follow the standar poe for 0 and simulate for 1
    if b == 0 {
        let V = h.into().mul(r);
        let V_1: NonZeroEcPoint = (V - g).try_into().unwrap();
        let k: felt252 = generate_random(r, 1);
        let A0: NonZeroEcPoint = h.into().mul(k).try_into().unwrap();

        let (A1, c_1, s_1) = simPOE(V_1.into(), h, r);
        let mut commits = array![[A0.x(), A0.y()], [A1.x, A1.y]];
        let c = challenge_commits(ref commits);
        let c_0 = feltXOR(c, c_1);
        let s_0 = compute_s(c_0, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V: V.try_into().unwrap(), A0: A0.into(), A1, c0: c_0, s0: s_0, s1: s_1
        };
        return pi;
        // if b == 1 we follow the standar poe for 1 and simulate for 0
    } else {
        //TODO: throw an error if b is not 0 nor 1.
        let V: NonZeroEcPoint = (g + h.into().mul(r)).try_into().unwrap();
        let (A0, c_0, s_0) = simPOE(V.into(), generator_h(), r);

        //        let V_1 = V - g;
        let k = generate_random(r, 2);
        let A1: NonZeroEcPoint = h.into().mul(k).try_into().unwrap();
        let mut commits = array![[A0.x, A0.y], [A1.x(), A1.y()]];
        let c = challenge_commits(ref commits);
        let c_1 = feltXOR(c, c_0);
        let s_1 = compute_s(c_1, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V: V.into(), A0, A1: A1.into(), c0: c_0, s0: s_0, s1: s_1
        };
        return pi;
    }
}

/// Generate a element V = g**b h**r with a proof that b belongs to a range.
pub fn prove_range(b: u32, seed: felt252) -> (felt252, Span<ProofOfBit>) {
    let b_bin = to_binary(b);

    let mut proof = array![];
    let mut R = array![];
    let mut i: u32 = 0;
    while i < 32 {
        let r = generate_random(seed, i.try_into().unwrap() + 1);
        let pi = prove_bit(*b_bin[i], r);
        R.append(r);
        proof.append(pi);
        i = i + 1;
    };

    let mut pow: felt252 = 1;
    let mut r: felt252 = 0;
    let mut i: u32 = 0;
    while i < 32 {
        //this magic trick let us sum compute de correct random
        r = compute_s(*R[i], pow, r);
        i = i + 1;
        pow = 2 * pow;
    };
    return (r, proof.span());
}


pub fn alternative_prove_bit(b: u8, r: felt252) -> ProofOfBit2 {
    let seed = 1293812;
    let b: felt252 = b.try_into().unwrap();
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let h = generator_h();

    let V: NonZeroEcPoint = (g.mul(b) + h.into().mul(r)).try_into().unwrap();

    let kb = generate_random(seed, 2);
    let kr = generate_random(seed, 3);
    let t = generate_random(seed, 4);

    let A: NonZeroEcPoint = (g.mul(kb) + h.into().mul(kr)).try_into().unwrap();
    let B: NonZeroEcPoint = (g.mul(b * kb) + h.into().mul(t)).try_into().unwrap();

    let mut commits = array![[A.x(), A.y()], [B.x(), B.y()]];
    let c = challenge_commits(ref commits);

    let sb = compute_s(c, b, kb);
    let sr = compute_s(c, r, kr);
    let z = compute_z(c, r, sb, t);

    ProofOfBit2 { V: V.into(), A: A.into(), B: B.into(), sb: sb, sr: sr, z: z, }
}
