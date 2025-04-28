import { AffinePoint } from "@noble/curves/abstract/curve";
import { CURVE, ProjectivePoint } from "@scure/starknet"

export type Affine = AffinePoint<bigint>

const CURVE_ORDER = CURVE.n

export const g = new ProjectivePoint(
  CURVE.Gx,
  CURVE.Gy,
  1n
);

export function encrypt(sc: bigint): Affine {
  return g.multiplyUnsafe(sc).toAffine()
}


export function provePOE(x: bigint) {
    //TODO: create a function that returns a random in the curve order
    let k = 1234n //random_here
    const A = g.multiplyUnsafe(k)
    //TODO: the challenge has to be computed with the corresponding prefix and hasshing the commit
    let c = 100n //remove
    //TODO: this operation has to be done mod curve order.
    let s = (k + x*c)%CURVE_ORDER
    return {A, s}
}

export function verifyPOE(y:ProjectivePoint, A:ProjectivePoint, s:bigint){
    const LHS = g.multiplyUnsafe(s).toAffine()
    //TODO: use the correspongind hash
    const c = 100n
    const RHS = A.add(y.multiplyUnsafe(c))
    return (LHS.x == RHS.x)&&(LHS.y == RHS.y)
}

function cipher_balance(y:ProjectivePoint, amount:bigint, random: bigint){
    const L = (g.multiplyUnsafe(amount)).add(y.multiplyUnsafe(random))
    const R = g.multiplyUnsafe(random)
    return {L,R}
}

function prove_fund(x: bigint, nonce: bigint){
//  let y = g.multiplyUnsafe(x)
//  let prefix = H('fund', y.x, y.y, nonce)  (Affine)
    
    let k = 1234n //random_here
    const A = g.multiplyUnsafe(k)
//  let c = H(prefix, A.x, A.y)  (Affine)
    let c = 100n //remove
    let s = (k + x*c)%CURVE_ORDER
    return {A, s}
}

function prove_withdraw_all(x:bigint, CL:ProjectivePoint,CR:ProjectivePoint, nonce: bigint){
//  let y = g.multiplyUnsafe(x)
//  prefix = H('withdraw_all', y.x,y.y,to:ContractAddress,nonce) (Affine)

    let k = 1234n //random_here
    const R = CR
    const Ax = g.multiplyUnsafe(k)
    const Acr = R.multiplyUnsafe(k)
//  let c = H(prefix, A.x, A.y, Acr.x, Acr.y) (Affine)
    let c = 100n //remove
    let s = (k + x*c)%CURVE_ORDER
    return {Ax, Acr, s}
}

function prove_withdraw(x:bigint,initial_balance:bigint, amount:bigint, CL:ProjectivePoint, CR: ProjectivePoint, nonce:bigint) {
//  let y = g.multiplyUnsafe(x)
//  prefix = H('withdraw', y.x,y.y,to:ContractAddress,nonce) (Affine)

    const left = initial_balance - amount
//  let {r, rangeproof} = prove_range(for: initial_balance - amount)
    let r = 4917283n

//  const H = otro generador
    const H = g

    let kx = 1234n //random_here
    let kb = 234n //random_here
    let kr = 34n //random_here

    const R = CR
    const Ax = g.multiplyUnsafe(kx)
    const A = (g.multiplyUnsafe(kb)).add(R.multiplyUnsafe(kx))
    const Av = (g.multiplyUnsafe(kb)).add(H.multiplyUnsafe(kr))
//  let c = H(prefix, Ax.x, Ax.y, A.x, A.y, Av.x, Av.y) (Affine)
    let c = 100n //remove
    let sb = (kb + left*c)%CURVE_ORDER
    let sx = (kx + x*c)%CURVE_ORDER
    let sr = (kr + r*c)%CURVE_ORDER
    return {Ax, A, Av, sx, sb, sr}
//     return {Ax, A, Av, sx, sb, sr, ProofOfRange}
}

function prove_transfer(x: bigint, y_bar: ProjectivePoint, initial_balance: bigint, amount: bigint, CL:ProjectivePoint, CR: ProjectivePoint, nonce: bigint) {
    let y = g.multiplyUnsafe(x)
//  prefix = H('transfer', y.x,y.y,y_bar.x, y_bar.y,CL.x,CL.y,CR.x,CR.y,nonce) (Affine)


//  const H = otro generador
//  const view = view_key
    const H = g //remove
    const view = g //remove

//  let {r, rangeproof} = prove_range(for: initial_balance)
    let r = 4917283n
    let {L,R} = cipher_balance(y, amount, r)
    let L_bar = cipher_balance(y_bar, amount, r).L
    let L_audit  = cipher_balance(view, amount, r).L

    let b_left = initial_balance - amount
//  let {r2, rangeproof2} = prove_range(for: initial_balance - amount)
    let r2 = 491n //remove
    let G = CR.subtract(R)
    
    let kx = 1234n //random_here
    let kb = 234n //random_here
    let kr = 34n //random_here
    let kb2 = 2342n //random_here
    let kr2= 34n //random_here

    const Ax = g.multiplyUnsafe(kx)
    const Ar = g.multiplyUnsafe(kr)
    const A_b = (g.multiplyUnsafe(kb)).add(y.multiplyUnsafe(kr))
    const A_bar = (g.multiplyUnsafe(kb)).add(y_bar.multiplyUnsafe(kr))
    const A_audit = (g.multiplyUnsafe(kb)).add(view.multiplyUnsafe(kr))
    const A_v = (g.multiplyUnsafe(kb)).add(H.multiplyUnsafe(kr))
    const A_b2 = (g.multiplyUnsafe(kb2)).add(G.multiplyUnsafe(kx))
    const A_v2 = (g.multiplyUnsafe(kb2)).add(H.multiplyUnsafe(kr2))
    
//  let c = H(prefix, Ax.x, Ax.y, Ar.x, Ar.y, A_b.x,A_b.y, A_b2.x, A_b2.y, A_v.x, A_v.y, A_v2.x, A_v2.y, A_bar.x, A_bar.y, A_audit.x, A_audit.y)
    let c = 1451n //remove

    let s_x = (kx + x*c)%CURVE_ORDER
    let s_b = (kb + initial_balance*c)%CURVE_ORDER
    let s_r = (kr + r*c)%CURVE_ORDER
    let s_b2 = (kb2 + b_left*c)%CURVE_ORDER
    let s_r2 = (kr2 + r2*c)%CURVE_ORDER

//     return {Ax, Ar, A_b, A_b2,A_v, A_v2, A_bar, A_audit, s_x, s_r,s_b, s_b2,s_r2, rangeproof, rangeproof2}
    return {R,L, L_bar, L_audit, Ax, Ar, A_b, A_b2,A_v, A_v2, A_bar, A_audit, s_x, s_r,s_b, s_b2,s_r2}
}

function simPOE(y:ProjectivePoint, gen: ProjectivePoint ) {
    const s = 128931n //random_here
    const c = 3712983n //random_here
    const A = (gen.multiplyUnsafe(s)).subtract(y.multiplyUnsafe(c))
    return {A,c,s}
}

function prove_bit(bit: number,random: bigint) {
//  const H = otro generador
    const H = g
    if (bit == 0) {
        let V = H.multiplyUnsafe(random)
        let V_1 = V.subtract(g)

        let k = 3287721n //random_here
        const A0 = H.multiplyUnsafe(k)

        let {A:A1,c:c_1,s:s_1} = simPOE(V_1, H)
//      let c = H(A0.x, A0.y, A1.y, A1.y)
//      let c_0 = feltXOR(c, c_1)
        let c_0 = 98312n //remove
        let s_0 = (k + c_0 * random ) % CURVE_ORDER

        return {V, A0,A1,c_0,s_0,s_1}
    } if (bit == 1 ) {
        let V = g.add(H.multiplyUnsafe(random))
        let {A:A0,c:c_0,s:s_0} = simPOE(V, H)

        let k = 7721n //random_here
        let A1 = H.multiplyUnsafe(k)
//      let c = H(A0.x, A0.y, A1.y, A1.y)
//      let c_1 = feltXOR(c, c_0)
        let c_1 = 12983n //remove
        let s_1 = (k + c_1 * random) % CURVE_ORDER

        return {V, A0, A1, c_0, s_0, s_1}
    }
}

function prove_range(b: bigint) {
//     let b_bin = to_binary(b)
    let b_bin: Array<number> = [1,0,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    let proof: Array<number> = []
    let R: Array<bigint> = []
    let i = 0;
    while (i < 32) { 
        let r = 89371n
        let pi = prove_bit(b_bin[i], r)
//         proof.append(pi)
        proof.push(i)
        R.push(r)
        i = i + 1
    }

    let pow = 1n
    let r = 0n
    i = 0
    while (i < 32) {
        r = (R[i]* 2n**pow) % CURVE_ORDER
        i = i + 1
        pow = 2n*pow
    }

    return {r, proof}
}
