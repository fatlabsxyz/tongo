use core::integer::{u512};

#[derive(Serde, Drop, Copy, Default, Debug)]
pub struct AEBalance {
    ciphertext: u512,
    nonce: u256
}

impl U512Default of Default<u512> {
    fn default() -> u512 {
        u512 { limb0: 0, limb1: 0, limb2: 0, limb3: 0, }
    }
}

impl U512Debug of core::fmt::Debug<u512> {
    fn fmt(self: @u512, ref f: core::fmt::Formatter) -> Result::<(), core::fmt::Error> {
        let u512 { limb0, limb1, limb2, limb3} = self;
        write!(f, "U512({limb0},{limb1},{limb2},{limb3})")
    }
}
