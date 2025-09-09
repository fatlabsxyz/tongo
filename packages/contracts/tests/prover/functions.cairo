use tongo::structs::traits::{Challenge, AppendPoint};
use tongo::structs::common::{
    pubkey::{PubKey},
    cipherbalance::{CipherBalance, CipherBalanceTrait},
    starkpoint::StarkPoint,
};

use tongo::structs::operations::{
    fund::{InputsFund, ProofOfFund},
    withdraw::{InputsWithdraw, ProofOfWithdraw},
    transfer::{InputsTransfer, ProofOfTransfer},
    ragequit::{InputsRagequit, ProofOfRagequit},
    rollover::{InputsRollOver, ProofOfRollOver},
    audit::{InputsAudit, ProofOfAudit},
};

use tongo::structs::proofbit::{ProofOfBit};
use tongo::structs::traits::Prefix;
use crate::prover::utils::{challenge_commits, decipher_balance};
use crate::prover::utils::pubkey_from_secret;

use tongo::verifier::utils::{generator_h, feltXOR, cast_in_order};
use tongo::verifier::she::poe2;
use crate::prover::utils::{generate_random, compute_s, compute_z, simPOE, to_binary};

use starknet::ContractAddress;
use core::poseidon::poseidon_hash_span;
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{NonZeroEcPoint, EcPointTrait, EcStateTrait, EcPoint};


pub fn prove_audit(
    x:felt252,
    balance: felt252,
    storedBalance: CipherBalance,
    auditorPubKey: PubKey,
    seed:felt252,
) -> (InputsAudit, ProofOfAudit) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = pubkey_from_secret(x);

    let (_, R0) = storedBalance.points();
    let r = generate_random(seed, 1);
    let auditedBalance = CipherBalanceTrait::new(auditorPubKey, balance, r);
    let inputs: InputsAudit = InputsAudit {y, auditorPubKey, storedBalance, auditedBalance};
    let prefix = 'audit';

    //prover
    let kx = generate_random(seed, 2);
    let kb = generate_random(seed, 3);
    let kr = generate_random(seed, 4);

    let Ax: NonZeroEcPoint = g.mul(kx).try_into().unwrap();
    let AR1: NonZeroEcPoint = g.mul(kr).try_into().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g.try_into().unwrap());
        state.add_mul(kx, R0.try_into().unwrap());
    let AL0 = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g.try_into().unwrap());
        state.add_mul(kr, auditorPubKey.try_into().unwrap());
    let AL1 = state.finalize_nz().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![Ax, AL0, AL1,AR1];
    let c = challenge_commits(prefix, ref commits);

    let sx = compute_s(c, x, kx);
    let sr = compute_s(c, r, kr);
    let sb = compute_s(c, balance, kb);

    let proof: ProofOfAudit = ProofOfAudit {
        Ax: Ax.into(),
        AL0: AL0.into(),
        AL1: AL1.into(),
        AR1: AR1.into(),
        sx,
        sr,
        sb
    };
    return (inputs, proof);
}

pub fn prove_fund(
    x: felt252,
    amount:felt252,
    initialBalance:felt252,
    currentBalance: CipherBalance,
    nonce: u64,
    seed: felt252
) -> (InputsFund, ProofOfFund, CipherBalance) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = pubkey_from_secret(x);

    decipher_balance(initialBalance, x, currentBalance);
    let inputs: InputsFund = InputsFund { y: y.try_into().unwrap(), amount, nonce, currentBalance };
    let prefix = inputs.prefix();

    //prover
    let kx = generate_random(seed, 1);

    let Ax: NonZeroEcPoint = g.mul(kx).try_into().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![Ax];
    let c = challenge_commits(prefix, ref commits);

    let sx = compute_s(c, x, kx);

    let proof: ProofOfFund = ProofOfFund { Ax: Ax.into(), sx };

    let cipher = CipherBalanceTrait::new(y, amount, 'fund');
    let newBalance = CipherBalanceTrait::add(currentBalance , cipher);
    return (inputs, proof, newBalance);
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
) -> (InputsRagequit, ProofOfRagequit, CipherBalance) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    decipher_balance(amount, x, currentBalance);


    let ( _ , R) = currentBalance.points_nz();
    let inputs: InputsRagequit = InputsRagequit {y:y.try_into().unwrap(), amount, to, nonce, currentBalance };

    let prefix = inputs.prefix();

    //poe for y = g**x and L/g**b = R**x
    let kx = generate_random(seed, 1);

    let Ax: NonZeroEcPoint = (g.into().mul(kx)).try_into().unwrap();
    let AR: NonZeroEcPoint = R.into().mul(kx).try_into().unwrap();

    let mut commits: Array<NonZeroEcPoint> = array![Ax,AR];

    let c = challenge_commits(prefix, ref commits);
    let sx = compute_s(c, x, kx);

    let proof: ProofOfRagequit = ProofOfRagequit {
        Ax: Ax.into(), AR: AR.into(),  sx: sx
    };

    let newBalance: CipherBalance  = CipherBalanceTrait::new(y, 0, 1);
    return (inputs, proof, newBalance);
}


pub fn prove_withdraw(
    x: felt252,
    amount: felt252,
    to: ContractAddress,
    initialBalance: felt252,
    currentBalance: CipherBalance,
    nonce: u64,
    seed: felt252
) -> (InputsWithdraw, ProofOfWithdraw, CipherBalance) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    decipher_balance(initialBalance, x, currentBalance);

    let (_,R) = currentBalance.points();
    let h = generator_h();

    let left = initialBalance - amount;

    let (r, RangeProof) = prove_range(left.try_into().unwrap(), generate_random(seed + 1, 1));
    let R_aux: StarkPoint = g.into().mul(r).try_into().unwrap();

    let inputs: InputsWithdraw = InputsWithdraw {
        y: y.try_into().unwrap(), amount, currentBalance, nonce, to, 
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


    let mut commits: Array<NonZeroEcPoint> = array![A_x,A_r, A, A_v];
    let c = challenge_commits(prefix, ref commits);
    let sb = compute_s(c, left, kb);
    let sx = compute_s(c, x, kx);
    let sr = compute_s(c, r, kr);

    let proof: ProofOfWithdraw = ProofOfWithdraw {
        A_x: A_x.into(),A_r:A_r.into(), A: A.into(), A_v: A_v.into(), sx: sx, sb: sb, sr: sr,R_aux, range: RangeProof,
    };

    let cipher = CipherBalanceTrait::new(y, amount, 'withdraw');
    let newBalance = CipherBalanceTrait::subtract(currentBalance , cipher);

    return (inputs, proof, newBalance);
}

pub fn prove_transfer(
    x: felt252,
    to: PubKey,
    initialBalance: felt252,
    amount: felt252,
    currentBalance: CipherBalance,
    nonce: u64,
    seed: felt252
) -> (InputsTransfer, ProofOfTransfer, CipherBalance) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    decipher_balance(initialBalance, x, currentBalance);

    let h = generator_h();

    let (_, CR) = currentBalance.points();

    let (r, proof) = prove_range(amount.try_into().unwrap(), generate_random(seed + 1, 1));
    let R_aux: StarkPoint = g.into().mul(r).try_into().unwrap();
    let transferBalanceSelf = CipherBalanceTrait::new(y, amount, r);
    let transferBalance = CipherBalanceTrait::new(to, amount, r);

    let (_, R) = transferBalanceSelf.points();

    let balanceLeft = initialBalance - amount;
    let (r2, proof2) = prove_range(balanceLeft.try_into().unwrap(), generate_random(seed + 2, 1));
    let R_aux2: StarkPoint = g.into().mul(r2).try_into().unwrap();


    let inputs: InputsTransfer = InputsTransfer {
        y: y.try_into().unwrap(),
        y_bar: to.try_into().unwrap(),
        nonce: nonce,
        currentBalance,
        transferBalance,
        transferBalanceSelf,
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
        state.add_mul(kr, EcPointTrait::new_nz(to.x, to.y).unwrap());
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

    let mut commits: Array<NonZeroEcPoint> = array![
        A_x,
        A_r,
        A_r2,
        A_b,
        A_b2,
        A_v,
        A_v2,
        A_bar,
    ];

    let c = challenge_commits(prefix, ref commits);

    let s_x = compute_s(c, x, kx);
    let s_b = compute_s(c, amount, kb);
    let s_r = compute_s(c, r, kr);
    let s_b2 = compute_s(c, balanceLeft, kb2);
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
        s_x,
        s_r,
        s_b,
        s_b2,
        s_r2,
        R_aux,
        range: proof,
        R_aux2,
        range2: proof2,
    };
    
    let newBalance= CipherBalanceTrait::subtract(currentBalance , transferBalanceSelf);
//    let (inputsAudit, proofAudit) = prove_audit(x, balanceLeft, storedBalance,auditorPubKey, generate_random(seed + 1,5));
//    let auditPart: Audit = Audit {auditedBalance: inputsAudit.auditedBalance, proof:proofAudit, ae_hints: empty_ae_hint(),};
//
//
//    let (inputsAudit, proofAudit) = prove_audit(x, amount, transferBalanceSelf,auditorPubKey, generate_random(seed + 1,6));
//    let auditPartTransfer: Audit = Audit {auditedBalance: inputsAudit.auditedBalance, proof:proofAudit, ae_hints: empty_ae_hint(),};

    return (inputs, proof, newBalance);
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


/// ALTERNATIVE

#[derive(Serde, Drop, Copy)]
pub struct ProofOfBit2 {
    pub V: StarkPoint,
    pub A: StarkPoint,
    pub B: StarkPoint,
    pub sb: felt252,
    pub sr: felt252,
    pub z: felt252,
}


impl ChallengeBit2 of Challenge<ProofOfBit2> {
    fn compute_challenge(self: @ProofOfBit2, prefix:felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A);
       arr.append_coordinates(self.B);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
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


/// Alternative proof of commit a bit or one or zero. It seems it is not as efficient
/// as the proof we are ussing now but this can check all at once. This could be log(n)
/// instead linear in n as the other one.
/// TODO: test and decide (If we change to bulletproof this has no sense)
pub fn alternative_oneORzero(proof: ProofOfBit2) {
    let h = generator_h();

    let c = proof.compute_challenge(0);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    poe2(proof.V.try_into().unwrap(), g, h, proof.A.try_into().unwrap(), c, proof.sb, proof.sr);

    let V: EcPoint = proof.V.try_into().unwrap();
    let B: EcPoint = proof.B.try_into().unwrap();
    let LHS = h.into().mul(proof.z);
    let RHS = V.mul(c) - V.mul(proof.sb) + B;
    assert!(LHS.try_into().unwrap().coordinates() == RHS.try_into().unwrap().coordinates(), "asd2");
}
