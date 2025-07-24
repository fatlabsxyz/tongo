use tongo::structs::common::{
    pubkey::{PubKey},
    cipherbalance::{CipherBalance, CipherBalanceTrait},
};
use tongo::structs::operations::{
    fund::{InputsFund, ProofOfFund},
    withdraw::{InputsWithdraw, ProofOfWithdraw},
    transfer::{InputsTransfer, ProofOfTransfer},
    ragequit::{InputsRagequit, ProofOfRagequit},
    rollover::{InputsRollOver, ProofOfRollOver},
};

use tongo::structs::proofbit::{ProofOfBit,ProofOfBit2};
use tongo::structs::traits::Prefix;
use crate::prover::utils::{challenge_commits};
use crate::prover::utils::pubkey_from_secret;

use tongo::verifier::utils::{generator_h, feltXOR};
use crate::prover::utils::{generate_random, compute_s, compute_z, simPOE, to_binary};

use starknet::ContractAddress;
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{NonZeroEcPoint, EcPointTrait, EcStateTrait, EcPoint};



pub fn prove_fund(
    x: felt252,
    amount:felt252,
    initialBalance:felt252,
    currentBalance: CipherBalance,
    nonce: u64,
    auditorPubKey: PubKey,
    seed: felt252
) -> (InputsFund, ProofOfFund) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = pubkey_from_secret(x);


    let r = generate_random(seed, 1);
    let auxBalance = CipherBalanceTrait::new(y, initialBalance, r);
    let (_, R) = auxBalance.points();
    let auditedBalance = CipherBalanceTrait::new(auditorPubKey, initialBalance + amount, r);

    let ( _ , R0) = currentBalance.points();

    let inputs: InputsFund = InputsFund { y: y.try_into().unwrap(), amount, nonce, currentBalance, auxBalance, auditedBalance, auditorPubKey: auditorPubKey.try_into().unwrap()  };
    let prefix = inputs.prefix();
//    let mut seq: Array<felt252> = array!['fund', inputs.y.x, inputs.y.y, inputs.nonce.into(),];
//    let prefix = compute_prefix(ref seq);

    //prover
    let kx = generate_random(seed, 2);
    let kb = generate_random(seed, 3);
    let kr = generate_random(seed, 4);

    let Ax: NonZeroEcPoint = g.mul(kx).try_into().unwrap();
    let Ar: NonZeroEcPoint = g.mul(kr).try_into().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g.try_into().unwrap());
        state.add_mul(kr, y.try_into().unwrap());
    let Ab = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g.try_into().unwrap());
        state.add_mul(kr, auditorPubKey.try_into().unwrap());
    let A_auditor = state.finalize_nz().unwrap();

    let AUX_R:EcPoint = (R0.try_into().unwrap() - R.into()).into();
    let AUX_A:NonZeroEcPoint = AUX_R.mul(kx).try_into().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![Ax, Ar, Ab,A_auditor, AUX_A];
    let c = challenge_commits(prefix, ref commits);

    let sx = compute_s(c, x, kx);
    let sr = compute_s(c, r, kr);
    let sb = compute_s(c, initialBalance, kb);

    let proof: ProofOfFund = ProofOfFund { Ax: Ax.into(), Ar: Ar.into(), Ab: Ab.into(), A_auditor: A_auditor.into(), AUX_A: AUX_A.into(), sx, sr,sb };
    return (inputs, proof);
}


pub fn prove_rollover(x: felt252, nonce: u64, seed: felt252) -> (InputsRollOver, ProofOfRollOver) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = pubkey_from_secret(x);
    let inputs: InputsRollOver = InputsRollOver { y: y.try_into().unwrap(), nonce};
    let prefix = inputs.prefix();

    //prover
    let k = generate_random(seed, 1);
    let Ax: NonZeroEcPoint = g.mul(k).try_into().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![Ax];
    let c = challenge_commits(prefix, ref commits);
    let s = compute_s(c, x, k);

    let proof: ProofOfRollOver = ProofOfRollOver { Ax: Ax.into(), sx: s };
    return (inputs, proof);
}

/// Generate the prove necesary to make a withdraw transaction. In this version the withdraw is for
/// all the balance that is stored in the y=g**x account.
pub fn prove_ragequit(
    x: felt252,
    amount: felt252,
    to: ContractAddress,
    currentBalance: CipherBalance,
    nonce: u64,
    seed: felt252
) -> (InputsRagequit, ProofOfRagequit) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    let ( _ , R) = currentBalance.points_nz();
    let inputs: InputsRagequit = InputsRagequit {y:y.try_into().unwrap(), amount, to, nonce, currentBalance };

    let prefix = inputs.prefix();

    //poe for y = g**x and L/g**b = R**x
    let k = generate_random(seed, 1);
    let A_x: NonZeroEcPoint = EcPointTrait::mul(g, k).try_into().unwrap();
    let A_cr: NonZeroEcPoint = EcPointTrait::mul(R.try_into().unwrap(), k).try_into().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![A_x, A_cr];

    let c = challenge_commits(prefix, ref commits);
    let s = compute_s(c, x, k);

    let proof: ProofOfRagequit = ProofOfRagequit {
        A_x: A_x.into(), A_cr: A_cr.into(), s_x: s,
    };

    return (inputs, proof);
}



pub fn prove_withdraw(
    x: felt252,
    initial_balance: felt252,
    amount: felt252,
    to: ContractAddress,
    currentBalance: CipherBalance,
    nonce: u64,
    y_auditor: PubKey,
    seed: felt252
) -> (InputsWithdraw, ProofOfWithdraw) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    let (_,R) = currentBalance.points();
    let h = generator_h();
    let view = y_auditor;

    let left = initial_balance - amount;

    let (r, RangeProof) = prove_range(left.try_into().unwrap(), generate_random(seed + 1, 1));
    let auditedBalance = CipherBalanceTrait::new(view, left, r);

    let inputs: InputsWithdraw = InputsWithdraw {
        y: y.try_into().unwrap(), amount, currentBalance, auditedBalance, nonce, to, auditorPubKey: y_auditor.try_into().unwrap(),
    };
    let prefix = inputs.prefix();

    let kb = generate_random(seed, 1);
    let kx = generate_random(seed, 2);
    let kr = generate_random(seed, 3);

    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kx).try_into().unwrap();
    let A_r: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kr).try_into().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kx, R.try_into().unwrap());
    let A = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kr, h);
    let A_v = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
    state.add_mul(kb, g);
    state.add_mul(kr, y_auditor.try_into().unwrap());
    let A_auditor = state.finalize_nz().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![A_x,A_r, A, A_v, A_auditor];
    let c = challenge_commits(prefix, ref commits);
    let sb = compute_s(c, left, kb);
    let sx = compute_s(c, x, kx);
    let sr = compute_s(c, r, kr);

    let proof: ProofOfWithdraw = ProofOfWithdraw {
        A_x: A_x.into(),A_r:A_r.into(), A: A.into(), A_v: A_v.into(),A_auditor:A_auditor.into(), sx: sx, sb: sb, sr: sr, range: RangeProof,
    };

    return (inputs, proof);
}

pub fn prove_transfer(
    x: felt252,
    y_bar: PubKey,
    b0: felt252,
    b: felt252,
    auditorPubKey: PubKey,
    currentBalance: CipherBalance,
    nonce: u64,
    seed: felt252
) -> (InputsTransfer, ProofOfTransfer) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    let h = generator_h();
    let view = auditorPubKey;

    let (_, CR) = currentBalance.points();

    let (r, proof) = prove_range(b.try_into().unwrap(), generate_random(seed + 1, 1));
    let transferBalanceSelf = CipherBalanceTrait::new(y, b, r);
    let transferBalance = CipherBalanceTrait::new(y_bar, b, r);
    let auditedBalance = CipherBalanceTrait::new(view, b, r);

    let (_, R) = transferBalanceSelf.points();

    let b_left = b0 - b;
    let (r2, proof2) = prove_range(b_left.try_into().unwrap(), generate_random(seed + 2, 1));

    let auditedBalanceSelf = CipherBalanceTrait::new(view, b_left, r2);

    let inputs: InputsTransfer = InputsTransfer {
        y: y.try_into().unwrap(),
        y_bar: y_bar.try_into().unwrap(),
        nonce: nonce,
        auditorPubKey: auditorPubKey.try_into().unwrap(),
        currentBalance,
        transferBalance,
        transferBalanceSelf,
        auditedBalance,
        auditedBalanceSelf,
    };
    let prefix = inputs.prefix();

    let G: NonZeroEcPoint = (CR - R.into()).try_into().unwrap();

    let kx = generate_random(seed + 1, 0);
    let kb = generate_random(seed + 1, 1);
    let kr = generate_random(seed + 1, 2);
    let kb2 = generate_random(seed + 1, 3);
    let kr2 = generate_random(seed + 1, 4);

    let A_x: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kx).try_into().unwrap();
    let A_r: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kr).try_into().unwrap();
    let A_r2: NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), kr2).try_into().unwrap();

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
    state.add_mul(kr, EcPointTrait::new_nz(auditorPubKey.x, auditorPubKey.y).unwrap());
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

    let mut state = EcStateTrait::init();
    state.add_mul(kb2, g);
    state.add_mul(kr2, EcPointTrait::new_nz(view.x, view.y).unwrap());
    let A_self_audit = state.finalize_nz().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![
        A_x,
        A_r,
        A_r2,
        A_b,
        A_b2,
        A_v,
        A_v2,
        A_bar,
        A_audit,
        A_self_audit,
    ];

    let c = challenge_commits(prefix, ref commits);

    let s_x = compute_s(c, x, kx);
    let s_b = compute_s(c, b, kb);
    let s_r = compute_s(c, r, kr);
    let s_b2 = compute_s(c, b_left, kb2);
    let s_r2 = compute_s(c, r2, kr2);


    let proof: ProofOfTransfer = ProofOfTransfer {
        A_x: A_x.into(),
        A_r: A_r.into(),
        A_r2: A_r2.into(),
        A_b: A_b.into(),
        A_b2: A_b2.into(),
        A_v: A_v.into(),
        A_v2: A_v2.into(),
        A_bar: A_bar.into(),
        A_audit: A_audit.into(),
        A_self_audit: A_self_audit.into(),
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

        let (A1, c_1, s_1) = simPOE(V_1, h, r);
        let mut commits = array![A0.into(),A1];
        let c = challenge_commits(0,ref commits);
        let c_0 = feltXOR(c, c_1);
        let s_0 = compute_s(c_0, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V: V.try_into().unwrap(), A0: A0.into(), A1: A1.into(), c0: c_0, s0: s_0, s1: s_1
        };
        return pi;
        // if b == 1 we follow the standar poe for 1 and simulate for 0
    } else {
        //TODO: throw an error if b is not 0 nor 1.
        let V: NonZeroEcPoint = (g + h.into().mul(r)).try_into().unwrap();
        let (A0, c_0, s_0) = simPOE(V, generator_h(), r);

        //        let V_1 = V - g;
        let k = generate_random(r, 2);
        let A1: NonZeroEcPoint = h.into().mul(k).try_into().unwrap();
        let mut commits = array![A0, A1.into()];
        let c = challenge_commits(0,ref commits);
        let c_1 = feltXOR(c, c_0);
        let s_1 = compute_s(c_1, r, k);
        let pi: ProofOfBit = ProofOfBit {
            V:V.into(), A0: A0.into(), A1: A1.into(), c0: c_0, s0: s_0, s1: s_1
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

    let mut commits = array![A.into(), B.into()];
    let c = challenge_commits(0, ref commits);

    let sb = compute_s(c, b, kb);
    let sr = compute_s(c, r, kr);
    let z = compute_z(c, r, sb, t);

    ProofOfBit2 { V: V.into(), A: A.into(), B: B.into(), sb: sb, sr: sr, z: z, }
}
