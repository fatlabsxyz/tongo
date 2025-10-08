import { CipherBalance, createCipherBalance, GENERATOR as g, SECONDARY_GENERATOR as h, compute_prefix, GeneralPrefixData, ProjectivePoint} from "../types"
import { poe } from "@fatsolutions/she/protocols"
import { poe2 } from "@fatsolutions/she/protocols"
import { compute_challenge, compute_s, generateRandom} from "@fatsolutions/she"
import {Range, generateRangeProof, verifyRangeProof} from "../provers/range"


/// Public inputs of the verifier for the withdarw operation.
///
/// - y: The Tongo account to withdraw from.
/// - nonce: The nonce of the Tongo account.
/// - to: The starknet contract address to send the funds to.
/// - amount: The ammount of tongo to withdraw.
/// - currentBalance: The current CipherBalance stored for the account.
export interface InputsWithdraw {
    y: ProjectivePoint;
    nonce: bigint;
    to: bigint;
    amount: bigint;
    currentBalance: CipherBalance,
    bit_size:number,
    prefix_data: GeneralPrefixData,
}

/// Computes the prefix by hashing some public inputs.
function prefixWithdraw(
    general_prefix_data:GeneralPrefixData,
    y:ProjectivePoint,
    nonce:bigint,
    amount:bigint,
    to:bigint
): bigint {
    const withdraw_selector = 8604536554778681719n;
    const {chain_id, tongo_address} = general_prefix_data;
    const seq: bigint[] = [
        chain_id,
        tongo_address,
        withdraw_selector,
        y.toAffine().x,
        y.toAffine().y,
        nonce,
        amount,
        to,
    ];
    return compute_prefix(seq);
}

/// Proof of withdraw operation.
/// TODO: remove the _?
export interface ProofOfWithdraw {
    A_x: ProjectivePoint;
    A_r: ProjectivePoint;
    A: ProjectivePoint;
    A_v: ProjectivePoint;
    sx: bigint;
    sb: bigint;
    sr: bigint;
    R_aux:ProjectivePoint;
    range: Range;
}

export function proveWithdraw(
    x: bigint,
    initial_balance: bigint,
    amount: bigint,
    to: bigint,
    currentBalance: CipherBalance,
    nonce: bigint,
    bit_size:number,
    prefix_data: GeneralPrefixData,
):{
    inputs: InputsWithdraw;
    proof: ProofOfWithdraw
    newBalance: CipherBalance;
} {
    const y = g.multiply(x);
    const {L:L0, R:R0} = currentBalance;
     
    //this is to assert that storedbalance is an encription of the balance amount
    const g_b = L0.subtract(R0.multiplyUnsafe(x))
    const temp = g.multiplyUnsafe(initial_balance)
    if (!g_b.equals(temp)) {throw new Error("storedBalance is not an encryption of balance")}; 

    const prefix = prefixWithdraw(prefix_data,y,nonce,amount,to);
    const left =  initial_balance - amount;

    const {r, range} = generateRangeProof(left,bit_size, prefix);
    const R_aux = g.multiply(r);

    const inputs: InputsWithdraw = {
        y,
        nonce,
        currentBalance,
        to,
        amount,
        bit_size,
        prefix_data,
    };


    const kb = generateRandom()
    const kx = generateRandom()
    const kr = generateRandom()

    const A_x = g.multiplyUnsafe(kx);
    const A_r = g.multiplyUnsafe(kr);
    const A = g.multiplyUnsafe(kb).add(R0.multiplyUnsafe(kx));
    const A_v = g.multiplyUnsafe(kb).add(h.multiplyUnsafe(kr));

    const c = compute_challenge(prefix, [A_x,A_r, A, A_v]);

    const sb = compute_s(kb, left, c);
    const sx = compute_s(kx, x, c);
    const sr = compute_s(kr, r, c);

    const proof: ProofOfWithdraw = {
        A_x,
        A_r,
        A,
        A_v,
        sx,
        sb,
        sr,
        R_aux,
        range,
    };

    // compute the cipherbalance that y will have at the end of the withdraw 
    const cairo_string_withdraw = BigInt(8604536554778681719n);
    const cipher = createCipherBalance(y, amount, cairo_string_withdraw);
    const newBalance: CipherBalance = {L: currentBalance.L.subtract(cipher.L), R: currentBalance.R.subtract(cipher.R)};

    return { inputs, proof, newBalance };
}


/// Verifies the withdraw operation. First, ussers have to show knowledge of the private key. Then, users  have to provide 
/// a cleartext of the amount b to withdraw. The contract will construct a cipher balance (L2, R2) = (g**b y**r2, g**r2)
/// with randomness r2='withdraw'. The contract will subtract (L2,R2) to the stored balance of the user. The user have
/// provide a zk proof that the final cipher balance is encrypting a positive (a value in (0, u**32)) amount b_left. To do
/// this when the RangeProof is verified, it returns a V = g**b_left h**r, with b_left positive. V is used as a L part of
/// a cipher blalance, users have to prove that the cipher balance (V, R_aux = g**r) is encrypting the same amount
/// that the final cipher balance.
///
/// EC_MUL: 12 + n*5 = 172 for u32 
/// EC_ADD: 8 + n*4  = 136 for u32
export function verifyWithdraw(
    inputs: InputsWithdraw,
    proof: ProofOfWithdraw,
) {
    let bit_size = inputs.bit_size;
    const prefix = prefixWithdraw(
        inputs.prefix_data,
        inputs.y,
        inputs.nonce,
        inputs.amount,
        inputs.to
    );

    const c = compute_challenge(prefix, [proof.A_x,proof.A_r, proof.A, proof.A_v]);

    let res = poe._verify(inputs.y, g, proof.A_x, c, proof.sx);
    if (res == false) { throw new Error("error in poe y") }

    let {L:L0, R:R0} =inputs.currentBalance; 

    L0 = L0.subtract(g.multiply(inputs.amount));

    res = poe2._verify(L0, g, R0, proof.A, c, proof.sb, proof.sx);
    if (res == false) { throw new Error("error in poe2 Y") }

    
    let range_prefix = 0n;
    const V = verifyRangeProof(proof.range,bit_size, range_prefix);
    if (V == false) { throw new Error("erro in range for V") }

    res = poe2._verify(V, g, g, proof.A_v, c, proof.sb, proof.sr);
    if (res == false) { throw new Error("error in poe2 V") }
}
