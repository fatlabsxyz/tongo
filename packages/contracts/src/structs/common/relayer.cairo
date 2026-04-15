use crate::structs::traits::SerializedData;

#[derive(Drop, Serde, Copy, Debug)]
pub struct RelayData {
    pub fee_to_sender: u128,
}

pub impl SerializeRelayData of SerializedData<Option<RelayData>> {
    fn serialize_data(self: @Option<RelayData>) -> Span<felt252> {
        match self {
            None => { return array![1].span(); },
            Some(relay) => {
                let mut arr: Array<felt252> = array![0];
                arr.append((*relay.fee_to_sender).into());
                return arr.span();
            },
        }
    }
}
