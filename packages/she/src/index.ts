import { AffinePoint } from "@noble/curves/abstract/curve";
import {utils, CURVE, ProjectivePoint, computeHashOnElements, pedersen} from "@scure/starknet"

export type Affine = AffinePoint<bigint>

export const CURVE_ORDER = CURVE.n

export const g = new ProjectivePoint(
  CURVE.Gx,
  CURVE.Gy,
  1n
);
// It is critical to ensure that h has been generated in a way
// that nobody knows the discrete logarithm.
//
// Starknet utilizes nothing-up-my-sleeve technique:
// The parameters of the Pedersen hash are generated from the constant 𝜋.
// The x-coordinate of each point is a chunk of 76 decimal digit of 𝜋 modulo 𝑝.
// If it is a quadratic residue then the point is valid
// else the x-coordinate coordinate is incremented by one.
// https://docs.starkware.co/starkex/pedersen-hash-function.html
// https://github.com/starkware-libs/starkex-for-spot-trading/blob/607f0b4ce507e1d95cd018d206a2797f6ba4aab4/src/starkware/crypto/starkware/crypto/signature/nothing_up_my_sleeve_gen.py
export const h = new ProjectivePoint(
    691680531741293280453937373379419976656630796816457407115079998151342235387n,
    3202630011890313728668067682268550517524522030380821660699334634079346351030n,
    1n
);

export const view = new ProjectivePoint(
    3220927228414153929438887738336746530194630060939473224263346330912472379800n,
    2757351908714051356627755054438992373493721650442793345821069764655464109380n,
    1n
);


export function encrypt(sc: bigint): Affine {
  return g.multiplyUnsafe(sc).toAffine()
}


// ----------------------------------- POE -------------------------------------------------
export function poe(y:ProjectivePoint, g:ProjectivePoint, A:ProjectivePoint, c:bigint, s:bigint) {
    const LHS = g.multiplyUnsafe(s)
    const RHS = A.add(y.multiplyUnsafe(c))
    return LHS.equals(RHS)
}

export function prove_poe(x: bigint,g:ProjectivePoint,seed:bigint) {
    let y = g.multiplyUnsafe(x)
    let k = generate_cairo_random(seed,1n)
    const A = g.multiplyUnsafe(k)
    let c = challenge_commits2(0n,[A])
    let s = (k + x*c)%CURVE_ORDER
    return {y, A, s}
}

export function verify_poe(y:ProjectivePoint, g:ProjectivePoint, A:ProjectivePoint, s:bigint) {
    const c = challenge_commits2(0n,[A])
    const res = poe(y,g,A,c,s)
    if (res == false ) {throw new Error("nope")}
}
// ----------------------------------- POE -------------------------------------------------


// ----------------------------------- POE2 -------------------------------------------------
function poe2(y:ProjectivePoint, g1:ProjectivePoint, g2:ProjectivePoint, A:ProjectivePoint, c:bigint, s1:bigint, s2:bigint) {
    const LHS = (g1.multiplyUnsafe(s1)).add(g2.multiplyUnsafe(s2))
    const RHS = A.add(y.multiplyUnsafe(c))
    return LHS.equals(RHS)
}

export function prove_poe2(x1: bigint,x2:bigint,g1:ProjectivePoint,g2:ProjectivePoint,seed:bigint) {
    const y = (g1.multiplyUnsafe(x1)).add(g2.multiplyUnsafe(x2))
    const k1 = generate_cairo_random(seed,1n)
    const k2 = generate_cairo_random(seed,2n)
    const A = (g1.multiplyUnsafe(k1)).add(g2.multiplyUnsafe(k2))
    const c = challenge_commits2(0n,[A])
    const s1 = (k1 + x1*c)%CURVE_ORDER
    const s2 = (k2 + x2*c)%CURVE_ORDER
    return {y, A, s1,s2}
}

export function verify_poe2(y:ProjectivePoint, g1:ProjectivePoint,g2:ProjectivePoint, A:ProjectivePoint, s1:bigint, s2:bigint) {
    const c = challenge_commits2(0n,[A])
    const res = poe2(y,g1,g2, A,c,s1,s2)
    if (res == false ) {throw new Error("nope")}
}
// ----------------------------------- POE2 -------------------------------------------------


export function cipher_balance(y:ProjectivePoint, amount:bigint, random: bigint){
    const L = (g.multiplyUnsafe(amount)).add(y.multiplyUnsafe(random))
    const R = g.multiplyUnsafe(random)
    return {L,R}
}


// -----------------------------  FUND -------------------------------------------------------
export interface InputsFund {
    y:ProjectivePoint,
    nonce: bigint
}

export interface ProofOfFund {
    Ax: ProjectivePoint,
    sx: bigint
}

export function prove_fund(x: bigint, nonce: bigint, seed: bigint): {inputs:InputsFund,proof: ProofOfFund} {
    const fund_selector = 1718972004n
    const y = g.multiplyUnsafe(x)
    const inputs: InputsFund  = {y: y, nonce:nonce }

    const seq: bigint[] = [fund_selector,  y.toAffine().x, y.toAffine().y, nonce]
    const prefix = compute_prefix(seq)
    
    const k = generate_cairo_random(seed,1n)
    const Ax = g.multiplyUnsafe(k)
    const c = challenge_commits2(prefix, [Ax])
    const sx = (k + x*c)%CURVE_ORDER

    const proof: ProofOfFund = {Ax: Ax, sx:sx}
    return {inputs, proof}
}

export function verify_fund(inputs: InputsFund, proof: ProofOfFund) {
    const fund_selector = 1718972004n
    const seq: bigint[] = [fund_selector,  inputs.y.toAffine().x, inputs.y.toAffine().y, inputs.nonce]
    const prefix = compute_prefix(seq)
    const c = challenge_commits2(prefix, [proof.Ax])
    const res = poe(inputs.y, g, proof.Ax, c, proof.sx )
    if (res == false) {throw new Error("verify_fund failed")}
}
// -----------------------------  FUND -------------------------------------------------------


// -----------------------------  WITHDRAW_ALL -------------------------------------------------------
export interface InputsWithdraw {
    y:ProjectivePoint,
    nonce: bigint,
    to: bigint,
    amount: bigint,
    L:ProjectivePoint,
    R:ProjectivePoint,
}

interface ProofOfWithdrawAll {
    A_x: ProjectivePoint,
    A_cr:ProjectivePoint,
    s_x: bigint
}

export function prove_withdraw_all(
    x:bigint,
    CL:ProjectivePoint,
    CR:ProjectivePoint,
    nonce: bigint,
    to:bigint,
    amount: bigint,
    seed:bigint
): {inputs: InputsWithdraw, proof: ProofOfWithdrawAll} {
    const withdraw_all_selector = 36956203100010950502698282092n
    const y = g.multiplyUnsafe(x)
    const inputs: InputsWithdraw = {y: y, nonce:nonce, to:to, amount: amount, L:CL, R:CR}
    //to: ContractAddress
    let seq: bigint[] = [withdraw_all_selector,  y.toAffine().x, y.toAffine().y,to, nonce] 
    let prefix = compute_prefix(seq)

    let k = generate_cairo_random(seed, 1n)
    const R = CR
    const A_x = g.multiplyUnsafe(k)
    const A_cr = R.multiplyUnsafe(k)

    let c = challenge_commits2(prefix, [A_x,A_cr])
    let s_x = (k + x*c)%CURVE_ORDER

    let proof: ProofOfWithdrawAll = {A_x: A_x, A_cr: A_cr, s_x:s_x}
    return {inputs, proof}
}

export function verify_withdraw_all(inputs: InputsWithdraw, proof:ProofOfWithdrawAll) {
    const withdraw_all_selector = 36956203100010950502698282092n
    let seq: bigint[] = [withdraw_all_selector,  inputs.y.toAffine().x, inputs.y.toAffine().y,inputs.to, inputs.nonce] 
    let prefix = compute_prefix(seq)
    let c = challenge_commits2(prefix, [proof.A_x,proof.A_cr])

    let res = poe(inputs.y, g, proof.A_x, c, proof.s_x )
    if (res == false) {throw new Error("error in poe y")}

    const g_b = g.multiplyUnsafe(inputs.amount)
    const Y = inputs.L.subtract(g_b)
    
    res = poe(Y, inputs.R, proof.A_cr, c, proof.s_x)
    if (res == false) {throw new Error("error in poe Y")}
}
// -----------------------------  WITHDRAW_ALL -------------------------------------------------------



// -----------------------------  WITHDRAW -------------------------------------------------------
interface ProofOfWithdraw{
    A_x: ProjectivePoint,
    A:ProjectivePoint,
    A_v: ProjectivePoint,
    sx: bigint
    sb: bigint
    sr: bigint
    range: ProofOfBit[]
}

export function prove_withdraw(
    x:bigint,
    initial_balance:bigint,
    amount:bigint,
    CL:ProjectivePoint,
    CR: ProjectivePoint,
    to:bigint,
    nonce:bigint,
    seed: bigint,
): {inputs: InputsWithdraw, proof: ProofOfWithdraw} {
    const withdraw_selector = 8604536554778681719n
    const y = g.multiplyUnsafe(x)
    const inputs: InputsWithdraw = {y:y, nonce:nonce, L:CL, R:CR, to:to, amount:amount}

    //to: ContractAddress
    const seq: bigint[] = [withdraw_selector,  y.toAffine().x, y.toAffine().y,to, nonce] 
    const prefix = compute_prefix(seq)

    const left = initial_balance - amount
    const {r, proof:range} = prove_range(left,32,generate_cairo_random(seed +1n,1n))

    const kb = generate_cairo_random(seed,1n)
    const kx = generate_cairo_random(seed,2n)
    const kr = generate_cairo_random(seed,3n)

    const R = CR
    const Ax = g.multiplyUnsafe(kx)
    const A = (g.multiplyUnsafe(kb)).add(R.multiplyUnsafe(kx))
    const Av = (g.multiplyUnsafe(kb)).add(h.multiplyUnsafe(kr))

    const c = challenge_commits2(prefix, [Ax,A,Av])

    const sb = (kb + left*c)%CURVE_ORDER
    const sx = (kx + x*c)%CURVE_ORDER
    const sr = (kr + r*c)%CURVE_ORDER

    const proof: ProofOfWithdraw = {A_x:Ax, A:A, A_v:Av,sx:sx, sb:sb, sr:sr, range:range}
    return {inputs, proof}
}

export function verify_withdraw(inputs: InputsWithdraw, proof:ProofOfWithdraw) {
    const withdraw_selector = 8604536554778681719n
    const seq: bigint[] = [withdraw_selector,  inputs.y.toAffine().x, inputs.y.toAffine().y,inputs.to, inputs.nonce] 
    const prefix = compute_prefix(seq)
    const c = challenge_commits2(prefix, [proof.A_x,proof.A,proof.A_v])

    let res = poe(inputs.y, g, proof.A_x, c, proof.sx )
    if (res == false) {throw new Error("error in poe y")}

    const g_b = g.multiplyUnsafe(inputs.amount)
    const Y = inputs.L.subtract(g_b)
    
    res = poe2(Y,g, inputs.R, proof.A, c,proof.sb, proof.sx)
    if (res == false) {throw new Error("error in poe2 Y")}

    const V = verify_range(proof.range, 32)

    res = poe2(V,g, h, proof.A_v, c,proof.sb, proof.sr)
    if (res == false) {throw new Error("error in poe2 V")}
}
// -----------------------------  WITHDRAW -------------------------------------------------------


// -----------------------------  TRANSFER -------------------------------------------------------

export interface InputsTransfer {
    y: ProjectivePoint,
    y_bar: ProjectivePoint,
    CL: ProjectivePoint,
    CR: ProjectivePoint,
    R: ProjectivePoint,
    L: ProjectivePoint,
    L_bar: ProjectivePoint,
    L_audit: ProjectivePoint,
    nonce: bigint
}

interface ProofOfTransfer {
     A_x: ProjectivePoint,
     A_r: ProjectivePoint,
     A_b: ProjectivePoint,
     A_b2: ProjectivePoint,
     A_v: ProjectivePoint,
     A_v2: ProjectivePoint,
     A_bar: ProjectivePoint,
     A_audit: ProjectivePoint,
     s_x: bigint,
     s_r: bigint,
     s_b: bigint,
     s_b2: bigint,
     s_r2: bigint,
     range: ProofOfBit[],
     range2: ProofOfBit[]
}

export function prove_transfer(
    x: bigint,
    y_bar: ProjectivePoint,
    initial_balance: bigint,
    amount: bigint,
    CL:ProjectivePoint,
    CR: ProjectivePoint,
    nonce: bigint,
    seed:bigint,
): {inputs: InputsTransfer, proof:ProofOfTransfer} {
    let transfer_selector = 8390876182755042674n
    let y = g.multiplyUnsafe(x)


    let {r, proof: range} = prove_range(amount, 32,generate_cairo_random(seed+1n,1n))
    let {L,R} = cipher_balance(y, amount, r)
    let L_bar = cipher_balance(y_bar, amount, r).L
    let L_audit  = cipher_balance(view, amount, r).L

    let seq: bigint[] = [
        transfer_selector,
        y.toAffine().x,
        y.toAffine().y,
        y_bar.toAffine().x,
        y_bar.toAffine().y,
        L.toAffine().x,
        L.toAffine().y,
        R.toAffine().x,
        R.toAffine().y,
        nonce
    ]
    let prefix = compute_prefix(seq)

    let inputs: InputsTransfer = {
        y:y,
        y_bar:y_bar,
        CL:CL,
        CR:CR,
        nonce:nonce,
        L:L,
        R:R,
        L_bar:L_bar,
        L_audit:L_audit,
    }

    let b_left = initial_balance - amount
    let {r:r2, proof:range2} = prove_range(b_left, 32, generate_cairo_random(seed+2n,1n))
    let G = CR.subtract(R)
    
    let kx = generate_cairo_random(seed+1n,0n)
    let kb = generate_cairo_random(seed+1n,1n)
    let kr = generate_cairo_random(seed+1n,2n)
    let kb2 = generate_cairo_random(seed+1n,3n)
    let kr2 = generate_cairo_random(seed+1n,4n)

    const Ax = g.multiplyUnsafe(kx)
    const Ar = g.multiplyUnsafe(kr)
    const A_b = (g.multiplyUnsafe(kb)).add(y.multiplyUnsafe(kr))
    const A_bar = (g.multiplyUnsafe(kb)).add(y_bar.multiplyUnsafe(kr))
    const A_audit = (g.multiplyUnsafe(kb)).add(view.multiplyUnsafe(kr))
    const A_v = (g.multiplyUnsafe(kb)).add(h.multiplyUnsafe(kr))
    const A_b2 = (g.multiplyUnsafe(kb2)).add(G.multiplyUnsafe(kx))
    const A_v2 = (g.multiplyUnsafe(kb2)).add(h.multiplyUnsafe(kr2))
    
    let c = challenge_commits2(prefix, [Ax, Ar, A_b, A_b2, A_v, A_v2, A_bar, A_audit])

    let s_x = (kx + x*c)%CURVE_ORDER
    let s_b = (kb + amount*c)%CURVE_ORDER
    let s_r = (kr + r*c)%CURVE_ORDER
    let s_b2 = (kb2 + b_left*c)%CURVE_ORDER
    console.log("s_b2:", s_b2)
    let s_r2 = (kr2 + r2*c)%CURVE_ORDER
    console.log("s_r2:", s_r2)

    let proof:ProofOfTransfer = {
        A_x: Ax,
        A_r: Ar,
        A_b: A_b,
        A_b2: A_b2,
        A_v: A_v,
        A_v2: A_v2,
        A_bar: A_bar,
        A_audit: A_audit,
        s_x: s_x,
        s_r: s_r,
        s_b: s_b,
        s_b2: s_b2,
        s_r2: s_r2,
        range: range,
        range2: range2,
    }
    return {inputs,proof}
}

export function verify_transfer(inputs: InputsTransfer, proof: ProofOfTransfer) {
    let transfer_selector = 8390876182755042674n
    let seq: bigint[] = [
        transfer_selector,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.y_bar.toAffine().x,
        inputs.y_bar.toAffine().y,
        inputs.L.toAffine().x,
        inputs.L.toAffine().y,
        inputs.R.toAffine().x,
        inputs.R.toAffine().y,
        inputs.nonce
    ]
    let prefix = compute_prefix(seq)
    let c = challenge_commits2(prefix, [
        proof.A_x,
        proof.A_r,
        proof.A_b,
        proof.A_b2,
        proof.A_v,
        proof.A_v2,
        proof.A_bar,
        proof.A_audit
    ])

    let res = poe(inputs.y, g, proof.A_x, c, proof.s_x )
    if (res == false) {throw new Error("error in poe for y")}

    res = poe(inputs.R, g,proof.A_r,c,proof.s_r)
    if (res == false) {throw new Error("error in poe for R")}

    res = poe2(inputs.L,g,inputs.y,proof.A_b,c,proof.s_b,proof.s_r)
    if (res == false) {throw new Error("error in poe2 for L")}

    res = poe2(inputs.L_bar,g,inputs.y_bar,proof.A_bar,c,proof.s_b,proof.s_r)
    if (res == false) {throw new Error("error in poe2 for L_bar")}

    res = poe2(inputs.L_audit,g,view,proof.A_audit,c,proof.s_b,proof.s_r)
    if (res == false) {throw new Error("error in pore2 for L_audit")}

    const V = verify_range(proof.range, 32)
    res = poe2(V,g,h,proof.A_v,c,proof.s_b,proof.s_r)
    if (res == false) {throw new Error("erro in poe2 for V")}

    const Y = inputs.CL.subtract(inputs.L)
    const G = inputs.CR.subtract(inputs.R)
    res = poe2(Y,g,G,proof.A_b2,c,proof.s_b2,proof.s_x)
    if (res == false) {throw new Error("error in poe2 for Y")}


    const V2 = verify_range(proof.range2, 32)
    res = poe2(V2,g,h,proof.A_v2,c,proof.s_b2,proof.s_r2)
    if (res == false) {throw new Error("error in poe2 for V2")}
}
// -----------------------------  TRANSFER -------------------------------------------------------


// -------------------------- PROOF OF BIT ----------------------------------------------------

interface ProofOfBit {
   V: ProjectivePoint,
   A0: ProjectivePoint,
   A1: ProjectivePoint,
   c_0: bigint,
   s_0: bigint,
   s_1: bigint,
}

function simPOE(y:ProjectivePoint, gen: ProjectivePoint,seed:bigint ) {
    const s = generate_cairo_random(seed +1n,1n)
    const c = generate_cairo_random(seed +1n,2n)
    const A = (gen.multiplyUnsafe(s)).subtract(y.multiplyUnsafe(c))
    return {A,c,s}
}

function prove_bit(bit: number ,random: bigint): ProofOfBit {
    if (bit == 0) {
        let V = h.multiplyUnsafe(random)
        let V_1 = V.subtract(g)

        let k = generate_cairo_random(random,1n)
        const A0 = h.multiplyUnsafe(k)

        let {A:A1,c:c_1,s:s_1} = simPOE(V_1, h,random)
        let c = challenge_commits2(0n,[A0,A1])
        let c_0 = c^c_1 //bitwisexor
        let s_0 = (k + c_0 * random ) % CURVE_ORDER

        return {V, A0,A1,c_0,s_0,s_1}
    } else {
        let V = g.add(h.multiplyUnsafe(random))
        let {A:A0,c:c_0,s:s_0} = simPOE(V, h, random)

        let k = generate_cairo_random(random,2n)
        let A1 = h.multiplyUnsafe(k)
        let c = challenge_commits2(0n, [A0,A1])
        let c_1 = c^c_0 //bitwisexor
        let s_1 = (k + c_1 * random) % CURVE_ORDER

        return {V, A0, A1, c_0, s_0, s_1}
    }
}

function oneOrZero(pi: ProofOfBit) {
    const c = challenge_commits2(0n,[pi.A0,pi.A1])
    const c_1 = c^pi.c_0
    let res = poe(pi.V,h,pi.A0, pi.c_0,pi.s_0)
    if (res == false ) {throw new Error("Failed 0 in proof of bit")}

    const V1 = pi.V.subtract(g)
    res = poe(V1,h,pi.A1, c_1,pi.s_1)
    if (res == false ) {throw new Error("Failed 1 in proof of bit")}
}
// -------------------------- PROOF OF BIT ----------------------------------------------------


// --------------------------------------- RANGE ------------------------------------------------
function prove_range(b: bigint, bits:number, seed: bigint) : {r:bigint, proof: ProofOfBit[]} {
    if (b >= 2**bits) { throw new Error("number not in range") }
    const b_bin = b.toString(2).padStart(bits,"0").split('').map(Number).reverse()
    const proof: ProofOfBit[]= []
    let pow = 1n
    let r = 0n
    let i = 0;
    while (i < bits) { 
        let r_inn = generate_cairo_random(seed, BigInt(i+1))
        let pi = prove_bit(b_bin[i]!, r_inn)
        proof.push(pi)
        r = (r + r_inn * pow) % CURVE_ORDER
        pow = 2n*pow
        i = i + 1
    }
    return {r, proof}
}

function verify_range(proof:ProofOfBit[], bits:number): ProjectivePoint {
    let pi = proof[0]!
    oneOrZero(pi)
    let  V = pi.V
    let pow = 2n
    let i = 1
    while (i < bits) {
       pi = proof[i]!
        oneOrZero(pi)
       V = V.add(pi.V.multiplyUnsafe(pow))
       i= i+1
       pow = pow *2n
    }
    return V
}
// --------------------------------------- RANGE ------------------------------------------------


/// Remember: hashing an array [Xn] has to be compared in cairo with the hash of H(0,X,1)
export function PED(elements: bigint[]) {
    return computeHashOnElements(elements)
}


/// This hash does not prepend the 0 and does not finalized with length
export const PED2 = (data: bigint[], fn = pedersen) =>
  data.reduce((x, y) => BigInt(fn(x, y)));

// This function coincides with cairo challenge_commits2
export function challenge_commits2(prefix:bigint,commits: ProjectivePoint[]){
    let data: bigint[] = [prefix];
    commits.forEach((commit,_index) => {
        let temp = commit.toAffine()
        data.push(temp.x)
        data.push(temp.y)
    }
    )

    let base = PED2(data)
    let salt = 1n
    let c = CURVE_ORDER + 1n
    while (c >= CURVE_ORDER) {
        c = PED2([base,salt])
        salt = salt + 1n
    }
    return c
}


//This function coincides with cairo compure_prefix
export function compute_prefix(seq: bigint[]) {
    return PED2([0n,...seq])
}

export function generate_random() {
    let random_bytes = utils.randomPrivateKey()
    return utils.normPrivateKeyToScalar(random_bytes)
}


export function generate_cairo_random(seed:bigint, multiplicity:bigint): bigint {
    let salt = 1n
    let c = CURVE_ORDER + 1n
    while (c >= CURVE_ORDER) {
        c = PED2([seed, multiplicity,salt])
        salt = salt + 1n
    }
    return c
}

export function decipher_balance(x:bigint, L:ProjectivePoint,R:ProjectivePoint): bigint {
    let Rx = R.multiplyUnsafe(x)
    let g_b = L.subtract(Rx)

    let b = 1n
    let temp = g
    if (temp.equals(g_b)) {return 1n}
    while (b < 2**32) {
        b = b + 1n
        temp = temp.add(g)
        if (temp.equals(g_b)) {break}
    }
    return b
}
