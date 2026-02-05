use starknet::ContractAddress;
use core::ec::{
    NonZeroEcPoint,
    EcPointTrait,
    EcStateTrait,
    stark_curve::{GEN_X,GEN_Y},
};

use tongo::structs::common::{
    pubkey::{PubKey},
    cipherbalance::{CipherBalance, CipherBalanceTrait},
    starkpoint::StarkPoint,
    relayer::RelayData,
};
use tongo::structs::traits::{GeneralPrefixData,Prefix};
use tongo::structs::operations::{
    fund::{InputsFund, ProofOfFund},
    withdraw::{InputsWithdraw, ProofOfWithdraw},
    transfer::{InputsTransfer, ProofOfTransfer},
    ragequit::{InputsRagequit, ProofOfRagequit},
    rollover::{InputsRollOver, ProofOfRollOver},
    audit::{InputsAudit, ProofOfAudit},
};

use tongo::verifier::{
    range::{Range, bitProof},
    utils::generator_h,
};

use she::utils::{compute_challenge, compute_s};
use she::protocols::range::{prover_for_testing, pregenerate_random_for_testing};
use she::protocols::bit::BitProofWithPrefix;

use crate::consts::{CHAIN_ID, TONGO_ADDRESS};
use crate::prover::utils::{
    generate_random,
    decipher_balance,
    pubkey_from_secret,
};


pub fn prove_audit(
    x:felt252,
    balance: u128,
    storedBalance: CipherBalance,
    auditorPubKey: PubKey,
    sender:ContractAddress,
    seed:felt252,
) -> (InputsAudit, ProofOfAudit) {

    decipher_balance(balance.into(), x, storedBalance);
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = pubkey_from_secret(x);

    let (_, R0) = storedBalance.points();
    let r = generate_random(seed, 1);
    let auditedBalance = CipherBalanceTrait::new(auditorPubKey, balance.into(), r);
    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:TONGO_ADDRESS,
        sender_address:sender,
    };

    let inputs: InputsAudit = InputsAudit {y, auditorPubKey, storedBalance, auditedBalance, prefix_data};
    let prefix = inputs.compute_prefix();

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

    let commits: Array<NonZeroEcPoint> = array![Ax, AL0, AL1,AR1];
    let c = compute_challenge(prefix, commits);

    let sx = compute_s(kx, x, c);
    let sr = compute_s(kr, r, c);
    let sb = compute_s(kb, balance.into(), c);

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
    amount:u128,
    from: ContractAddress,
    initialBalance:u128,
    currentBalance: CipherBalance,
    nonce: u64,
    sender:ContractAddress,
    seed: felt252
) -> (InputsFund, ProofOfFund, CipherBalance) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = pubkey_from_secret(x);

    decipher_balance(initialBalance.into(), x, currentBalance);
    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:TONGO_ADDRESS,
        sender_address:sender,
    };
    let inputs: InputsFund = InputsFund { y: y.try_into().unwrap(), amount, nonce, prefix_data};
    let prefix = inputs.compute_prefix();

    //prover
    let kx = generate_random(seed, 1);

    let Ax: NonZeroEcPoint = g.mul(kx).try_into().unwrap();

    let commits: Array<NonZeroEcPoint> = array![Ax];
    let c = compute_challenge(prefix, commits);

    let sx = compute_s(kx, x, c);

    let proof: ProofOfFund = ProofOfFund { Ax: Ax.into(), sx };

    let cipher = CipherBalanceTrait::new(y, amount.into(), 'fund');
    let newBalance = CipherBalanceTrait::add(currentBalance , cipher);
    return (inputs, proof, newBalance);
}


pub fn prove_rollover(
    x: felt252,
    nonce: u64,
    sender:ContractAddress,
    seed: felt252,
) -> (InputsRollOver, ProofOfRollOver) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();
    let y = pubkey_from_secret(x);
    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:TONGO_ADDRESS,
        sender_address:sender,
    };
    let inputs: InputsRollOver = InputsRollOver { y: y.try_into().unwrap(), nonce, prefix_data};
    let prefix = inputs.compute_prefix();

    //prover
    let k = generate_random(seed, 1);
    let Ax: NonZeroEcPoint = g.mul(k).try_into().unwrap();

    let commits: Array<NonZeroEcPoint> = array![Ax];
    let c = compute_challenge(prefix, commits);
    let s = compute_s(k, x, c);

    let proof: ProofOfRollOver = ProofOfRollOver { Ax: Ax.into(), sx: s };
    return (inputs, proof);
}

/// Generate the prove necesary to make a withdraw transaction. In this version the withdraw is for
/// all the balance that is stored in the y=g**x account.
pub fn prove_ragequit(
    x: felt252,
    amount: u128,
    to: ContractAddress,
    currentBalance: CipherBalance,
    nonce: u64,
    sender: ContractAddress,
    fee_to_sender: u128,
    seed: felt252
) -> (InputsRagequit, ProofOfRagequit, CipherBalance) {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    decipher_balance(amount.into(), x, currentBalance);

    let ( _ , R) = currentBalance.points_nz();

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:TONGO_ADDRESS,
        sender_address:sender,
    };
    
    let mut relayData = RelayData {fee_to_sender};

    let inputs: InputsRagequit = InputsRagequit {
        y:y.try_into().unwrap(),
        amount,
        to,
        nonce,
        currentBalance,
        prefix_data,
        relayData
    };
    let prefix = inputs.compute_prefix();

    //poe for y = g**x and L/g**b = R**x
    let kx = generate_random(seed, 1);

    let Ax: NonZeroEcPoint = (g.into().mul(kx)).try_into().unwrap();
    let AR: NonZeroEcPoint = R.into().mul(kx).try_into().unwrap();

    let commits: Array<NonZeroEcPoint> = array![Ax,AR];
    let c = compute_challenge(prefix, commits);

    let sx = compute_s(kx, x, c);

    let proof: ProofOfRagequit = ProofOfRagequit {
        Ax: Ax.into(), AR: AR.into(),  sx: sx
    };

    let newBalance: CipherBalance  = CipherBalanceTrait::new(y, 0, 1);
    return (inputs, proof, newBalance);
}


pub fn prove_withdraw(
    x: felt252,
    amount: u128,
    to: ContractAddress,
    initialBalance: u128,
    currentBalance: CipherBalance,
    nonce: u64,
    bit_size:u32,
    sender: ContractAddress,
    fee_to_sender: u128,
    seed: felt252
) -> (InputsWithdraw, ProofOfWithdraw, CipherBalance) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let h = generator_h();
    let y = pubkey_from_secret(x);
    decipher_balance(initialBalance.into(), x, currentBalance);

    let left = initialBalance - amount - fee_to_sender;

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:TONGO_ADDRESS,
        sender_address:sender,
    };

    let (randomness, total_random ) = pregenerate_random_for_testing(bit_size, seed + 1);
    let auxiliarCipher = CipherBalanceTrait::new(h.into(),left.into(), total_random);

    let relayData = RelayData {fee_to_sender};

    let inputs: InputsWithdraw = InputsWithdraw {
        y: y.try_into().unwrap(),
        amount,
        currentBalance,
        auxiliarCipher,
        nonce,
        to,
        bit_size,
        prefix_data,
        relayData,
    };

    let prefix = inputs.compute_prefix();

    let mut currentBalance = currentBalance;
    if inputs.relayData.fee_to_sender != 0 {
        let fee = CipherBalanceTrait::new(y, fee_to_sender.into(), 'fee' );
        currentBalance = currentBalance.subtract(fee)
    }
    let (_,R) = currentBalance.points();

    let (r, range) = prove_range(left.try_into().unwrap(),bit_size,randomness, prefix, generate_random(seed + 1, 1));
    assert!(r == total_random, "random mismatch");


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


    let commits: Array<NonZeroEcPoint> = array![A_x,A_r, A, A_v];
    let c = compute_challenge(prefix,commits);
    let sb = compute_s(kb, left.into(), c);
    let sx = compute_s(kx, x, c);
    let sr = compute_s(kr, r, c);

    let proof: ProofOfWithdraw = ProofOfWithdraw {
        A_x: A_x.into(),
        A_r:A_r.into(),
        A: A.into(),
        A_v: A_v.into(),
        sx,
        sb,
        sr,
        range,
    };

    let cipher = CipherBalanceTrait::new(y, amount.into(), 'withdraw');
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
    bit_size:u32,
    sender:ContractAddress,
    seed: felt252
) -> (InputsTransfer, ProofOfTransfer, CipherBalance) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let y = pubkey_from_secret(x);
    decipher_balance(initialBalance, x, currentBalance);

    let h = generator_h();
    let balanceLeft = initialBalance - amount;


    let (randomness, total_random ) = pregenerate_random_for_testing(bit_size, seed + 1);
    let auxiliarCipher = CipherBalanceTrait::new(h.into(),amount, total_random);
    let transferBalanceSelf = CipherBalanceTrait::new(y, amount, total_random);
    let transferBalance = CipherBalanceTrait::new(to, amount, total_random);

    let (randomness2, total_random2 ) = pregenerate_random_for_testing(bit_size, seed + 1);
    let auxiliarCipher2 = CipherBalanceTrait::new(h.into(), balanceLeft, total_random2);

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:TONGO_ADDRESS,
        sender_address:sender,
    };

    let inputs: InputsTransfer = InputsTransfer {
        from: y.try_into().unwrap(),
        to: to.try_into().unwrap(),
        nonce: nonce,
        currentBalance,
        transferBalance,
        transferBalanceSelf,
        auxiliarCipher,
        auxiliarCipher2,
        bit_size,
        prefix_data
    };
    let prefix = inputs.compute_prefix();


    let (r, proof) = prove_range(amount.try_into().unwrap(),bit_size,randomness, prefix, generate_random(seed + 1, 1));
    assert!(r == total_random, "random mismatch");

    let (r2, proof2) = prove_range(balanceLeft.try_into().unwrap(),bit_size,randomness2,prefix, generate_random(seed + 2, 1));
    assert!(r2 == total_random2, "random2 mismatch");

    let (_, CR) = currentBalance.points();
    let (_, R)  = transferBalance.points();

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

    let commits: Array<NonZeroEcPoint> = array![
        A_x,
        A_r,
        A_r2,
        A_b,
        A_b2,
        A_v,
        A_v2,
        A_bar,
    ];

    let c = compute_challenge(prefix,commits);

    let s_x = compute_s(kx, x, c);
    let s_b = compute_s(kb, amount, c);
    let s_r = compute_s(kr, r,c);
    let s_b2 = compute_s(kb2, balanceLeft, c);
    let s_r2 = compute_s(kr2, r2, c);


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
        range: proof,
        range2: proof2,
    };

    let newBalance= CipherBalanceTrait::subtract(currentBalance , transferBalanceSelf);
    return (inputs, proof, newBalance);
}


pub fn prove_range(amount: u32,bit_size:u32,randomness: Array<felt252>, initial_prefix: felt252, seed: felt252) -> (felt252, Range) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let h = generator_h();

    let (she_inputs, she_proof, r) = prover_for_testing(amount, g,h, bit_size, randomness, initial_prefix,generate_random(seed,0));

    let mut commitments: Array<StarkPoint> = array![];
    let mut proofs: Array<bitProof> = array![];
    for i in 0..she_inputs.commitments.len() {
        commitments.append((*she_inputs.commitments.at(i)).into());
        let BitProofWithPrefix {A0, A1, c0,prefix: _, s0, s1} = *she_proof.proofs.at(i);
        let temp: bitProof = bitProof {
            A0: A0.into(),
            A1: A1.into(),
            c0,
            s0,
            s1
        };
        proofs.append(temp);
    }

    return (r, Range {commitments: commitments.span(), proofs: proofs.span()});
}
