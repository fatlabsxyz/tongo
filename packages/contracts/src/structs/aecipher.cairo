use core::integer::u512;
use starknet::storage_access::StorePacking;

/// An amount, symetrically encrypted under an authenticated encryption scheme.
/// This amount can not be enforced by the protocol itself, so we do not
/// operate it in any way. It's mainly used in logged events and can be
/// leveraged offchain to make decrytptions faster for the user and the auditor.
#[derive(Serde, Drop, Copy, Default, starknet::Store)]
pub struct AEBalance {
    ciphertext: u512,
    nonce: u256,
}

/// Transforms an AEBalance into an Option<AEBalance>. Only used for state
/// reading offchain.
pub impl IntoOptionAEBalance of Into<AEBalance, Option<AEBalance>> {
    fn into(self: AEBalance) -> Option<AEBalance> {
        let zero = u512 { limb0: 0, limb1: 0, limb2: 0, limb3: 0 };
        if (self.ciphertext == zero) || (self.nonce == 0_u256) {
            return None;
        }
        Some(self)
    }
}

/// Necessary trait for deriving StorePacking for AEBalance. Explicitates how a
/// u512 number should be packed/unpacked by Starknet. Because storage slots
/// hold at most 252 bits, we could further optimize this trivial implementation
/// to ocuppy one less felt, but we chose a simpler implementation.
impl StorePackingU512 of StorePacking<u512, (u128, u128, u128, u128)> {
    fn pack(value: u512) -> (u128, u128, u128, u128) {
        (value.limb0, value.limb1, value.limb2, value.limb3)
    }

    #[inline]
    fn unpack(value: (u128, u128, u128, u128)) -> u512 {
        let (limb0, limb1, limb2, limb3) = value;
        u512 { limb0, limb1, limb2, limb3 }
    }
}

/// Trivial implementation of Default for u512.
impl U512Default of Default<u512> {
    fn default() -> u512 {
        u512 { limb0: 0, limb1: 0, limb2: 0, limb3: 0 }
    }
}
