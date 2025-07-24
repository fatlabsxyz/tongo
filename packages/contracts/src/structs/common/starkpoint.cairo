use core::traits::{Into, TryInto};
use core::ec::{EcPointTrait, NonZeroEcPoint, EcPoint};

#[derive(Drop, Debug, Copy, starknet::Store, Default)]
pub struct StarkPoint {
    pub x: felt252,
    pub y: felt252,
}

pub impl SerdeStarkPoint of Serde<StarkPoint> {
    fn serialize(self: @StarkPoint, ref output: Array<felt252>) {
        output.append(*self.x);
        output.append(*self.y);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<StarkPoint> {
        let x  = (*serialized.pop_front()?);
        let y = (*serialized.pop_front()?);
        let option: Option<NonZeroEcPoint> = EcPointTrait::new_nz(x,y);
        assert(option.is_some(),'StarkPoint not an EcPoint');
        return Some(StarkPoint{x, y});
    }
}

pub impl NonZeroEcIntoStarkPoint of Into<NonZeroEcPoint, StarkPoint> {
    fn into(self: NonZeroEcPoint) -> StarkPoint {
        let (x,y) = self.coordinates();
        StarkPoint {x, y}
    }
}

pub impl StarkPointTryIntoNZ of TryInto<StarkPoint, NonZeroEcPoint> {
    fn try_into(self: StarkPoint) -> Option<NonZeroEcPoint> {
        EcPointTrait::new_nz(self.x, self.y)
    }
}

pub impl StarkPointTryIntoEcPoint of TryInto<StarkPoint, EcPoint> {
    fn try_into(self: StarkPoint) -> Option<EcPoint> {
        EcPointTrait::new(self.x, self.y)
    }
}

pub impl EcPointTryIntoStarkPoint of TryInto<EcPoint, StarkPoint> {
    fn try_into(self: EcPoint) -> Option<StarkPoint> {
        let option: Option<NonZeroEcPoint> = self.try_into();
        if option.is_none() {
           return None(());
        } else {
            let (x,y) = option.unwrap().coordinates();
            Some(StarkPoint {x, y} )
        }
    }
}
