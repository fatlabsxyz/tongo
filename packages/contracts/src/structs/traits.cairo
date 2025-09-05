use crate::structs::common::starkpoint::StarkPoint;
use starknet::ContractAddress;

#[derive(Serde, Drop, Copy, Debug)]
pub struct GeneralPrefixData {
    pub chain_id: felt252,
    pub tongo_address: ContractAddress,
}

/// This trait is implemented by the Inputs structs. Computes the prefix of the public inputs by
/// hashing the relevant data. The result is used in the challenge computation as a prefix.
/// This is use to bind the proof to some public inputs, doing this replay/frontrun attacks are avoided.
pub trait Prefix<T> {
    fn compute_prefix(self: @T) -> felt252;
}

/// This trait is implemented by the Poofs structs. Computes the challenge of each
/// proof by hashing the comitments of the sigma protocol. Each
pub trait Challenge<T> {
    fn compute_challenge(self: @T, prefix: felt252) -> felt252;
}


/// Appends the x and y coordinates of a StarkPoint to the end of an array.
/// This is use as part of challenge computation.
#[generate_trait]
pub impl AppendPointImpl of AppendPoint {
    fn append_coordinates(ref self: Array<felt252>, point: @StarkPoint) {
        self.append(*point.x);
        self.append(*point.y);
    }
}

