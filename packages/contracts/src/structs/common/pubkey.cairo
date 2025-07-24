use core::traits::{Into, TryInto};
use core::ec::{NonZeroEcPoint, EcPointTrait, EcPoint};

#[derive(Drop, Debug, Copy, Hash, starknet::Store)]
pub struct PubKey {
    pub x:felt252,
    pub y:felt252,
}

impl PubKeyTryIntoNZ of TryInto<PubKey, NonZeroEcPoint> {
    fn try_into(self: PubKey) -> Option<NonZeroEcPoint> {
        EcPointTrait::new_nz(self.x, self.y)
    }
}

impl NonZeroEcIntoPubKey of Into<NonZeroEcPoint, PubKey> {
    fn into(self: NonZeroEcPoint) -> PubKey {
        let (x, y) = self.coordinates();
        PubKey {x, y}
    }
}

impl EcPointTryIntoPubKey of TryInto<EcPoint, PubKey> {
    fn try_into(self: EcPoint) -> Option<PubKey> {
        let option: Option<NonZeroEcPoint> = self.try_into();
        if option.is_none() {
           return None(());
        } else {
            let (x,y) = option.unwrap().coordinates();
            Some(PubKey{x, y} )
        }
    }
}

pub impl SerdePubKey of Serde<PubKey> {
    fn serialize(self: @PubKey, ref output: Array<felt252>) {
        output.append(*self.x);
        output.append(*self.y);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<PubKey> {
        let x  = (*serialized.pop_front()?);
        let y = (*serialized.pop_front()?);
        let option = EcPointTrait::new_nz(x,y);
        assert(option.is_some(),'PubKey not an EcPoint');
        return Some(PubKey{x, y});
    }
}

