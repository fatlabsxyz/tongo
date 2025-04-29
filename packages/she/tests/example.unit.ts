import { describe, expect, it, vi, beforeEach } from "vitest";

import {encrypt, g,h,PED2, challenge_commits2, compute_prefix} from "../src";
import {generate_random, CURVE_ORDER, generate_cairo_random} from "../src";
import {prove_fund, verify_fund} from "../src";
import {prove_withdraw_all, verify_withdraw_all, cipher_balance} from "../src";
import {prove_withdraw,verify_withdraw} from "../src";
import {decipher_balance} from "../src";
import {prove_poe, verify_poe} from "../src"
import {prove_poe2, verify_poe2} from "../src"
import {prove_transfer,verify_transfer} from "../src"



describe("Example test suit", () => {
  it("encrypts the number 2**239", () => {
    const ciphertext = encrypt(2n ** 239n);
    expect(ciphertext).toEqual({
      x: 802067669445338147039837134275860456997099677631894729361742737790946772764n,
      y: 294649485537830512735642952583674639919984341293658336545460967464050719199n
    })
  })

  it("Testing random generator", () => {
    let i = 0;
    while ( i < 100) {
       let r = generate_random() 
       expect(r).toBeLessThan(CURVE_ORDER)
       i = i + 1
    }
  })


  it("Testing coincidence with cairo generate_random", () => {
    const random = generate_cairo_random(123n, 456n)
    expect(random).toEqual(2741632516191195515102142298096746973862893083064783049698513984956207988403n)
  })

  it("Testing prove_fund vs cairo", () => {
    const x = 1234n
    const nonce = 10n
    const seed = 89898989n
    const {inputs:_, proof} = prove_fund(x, nonce,seed)
    const Ax = proof.Ax.toAffine().x
    const Ay = proof.Ax.toAffine().y
    const s = proof.sx
    expect(Ax).toEqual(3612455079586708671597307320927915563177263408831939025216409148308051669345n)
    expect(Ay).toEqual(155702499075322517658393597207157113803433518217659499099352953264649181897n)
    expect(s).toEqual(1107716913810057927411929679130300674893211025343893263845808350282517648805n)
  })

  it("prove_fund vs ts", () => {
    const x = 1234n
    const nonce = 10n
    const seed = 89898989n
    const {inputs, proof} = prove_fund(x, nonce,seed)
    verify_fund(inputs, proof)
  })

  it("testing cipher_balance vs cairo", ()=> {
    const x = 888n
    let y = g.multiplyUnsafe(x)
    let {L,R} = cipher_balance(y, 100n, 99n)
    expect(L.toAffine()).toEqual({
        x: 63185172137553976261094001916869821930538601573037423789958141712125676224n,
        y: 3284483372844372190526227384089787598336158587807670835773211987319042139553n
    })
    expect(R.toAffine()).toEqual({
        x: 392166411187229336183623035240991458283748577268038216440094273072242938694n,
        y: 3541452660749468200612524365681823493197372096461287473921873394745076302935n
    })
  })

  it("prove_withdraw_all vs ts", () => {
    const x = 1234n
    const nonce = 10n
    const seed = 89898989n
    const amount = 10n;
    const to = 116200n;
    const random = 111111n;
    let y = g.multiplyUnsafe(x)
    let {L,R} = cipher_balance(y, amount, random)
    const {inputs, proof} = prove_withdraw_all(x,L, R, nonce,to, amount, seed)
    verify_withdraw_all(inputs, proof)
  })

  it("prove_withdrw vs ts", () => {
    const x = 888n
    let y = g.multiplyUnsafe(x)

    const nonce = 2n
    const initial_balance = 100n;
    const amount = 10n
    const to = 555n;
    let {L,R} = cipher_balance(y, initial_balance, 99n)
    const {inputs, proof} = prove_withdraw(x,initial_balance, amount ,L, R,to, nonce, 12n)
    verify_withdraw(inputs, proof)
  })

  it("prove_transfer vs ts", () => {
    const x = 4444n
    let y = g.multiplyUnsafe(x)
    const x_bar = 7777n
    let y_bar = g.multiplyUnsafe(x_bar)

    const nonce = 82n
    const seed = 5n
    const initial_balance = 100n
    const amount = 10n;
    const random = 999n;
    let {L,R} = cipher_balance(y, initial_balance, random)

    const {inputs, proof} = prove_transfer(x,y_bar,initial_balance, amount,L, R, nonce, seed)
    verify_transfer(inputs,proof)
  })

  it ("bechmark_decipher", () => {
    const x = 1234n
    const amount = 1_000n
    const random = 111111n;
    let y = g.multiplyUnsafe(x)
    let {L,R} = cipher_balance(y, amount, random)
    const b = decipher_balance(x,L,R)
    expect(b).toEqual(amount)
  })

  it("poe", () => {
    const x = 12n;
    const seed = 1234n;
    const {y, A, s} = prove_poe(x, g, seed)
    verify_poe(y, g, A, s)
  })

  it("poe2", () => {
    const x1 = 12n;
    const x2 = 12412n;
    const seed = 1234n;
    const {y, A, s1,s2} = prove_poe2(x1,x2, g,h, seed)
    verify_poe2(y,g,h, A,s1,s2)
  })
})


