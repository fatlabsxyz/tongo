import { describe, expect, it, vi, beforeEach } from "vitest";

import {provePOE,verifyPOE, encrypt, g,PED2, challenge_commits2, compute_prefix} from "../src";

describe("Example test suit", () => {
  it("encrypts the number 2**239", () => {
    const ciphertext = encrypt(2n ** 239n);
    expect(ciphertext).toEqual({
      x: 802067669445338147039837134275860456997099677631894729361742737790946772764n,
      y: 294649485537830512735642952583674639919984341293658336545460967464050719199n
    })
  })
})

// let x = 123n
// const y = g.multiplyUnsafe(x)
// const {A, s} = provePOE(x)
// let res = verifyPOE(y, A, s)
// console.log("Verify POE: ", res)

let transfer_selector = 8390876182755042674n
let a = challenge_commits2(transfer_selector,[g,g])
console.log("challenge_commits2: ",a)

let b = compute_prefix([1n,2n])
console.log("prefix: ", b)
