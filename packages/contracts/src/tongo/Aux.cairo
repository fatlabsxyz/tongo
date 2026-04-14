use core::serde::Serde;
use core::traits::{Destruct, Drop};

fn _serialize<T, +Serde<T>, +Drop<T>, +Destruct<T>>(s: T) -> Span<felt252> {
    let mut array: Array<felt252> = array![];
    s.serialize(ref array);
    array.span()
}


#[starknet::contract]
pub mod Aux {
    use crate::structs::operations::fund::InputsFund;
    use crate::structs::operations::ragequit::InputsRagequit;
    use crate::structs::operations::rollover::InputsRollOver;
    use crate::structs::operations::transfer::InputsTransfer;
    use crate::structs::operations::withdraw::InputsWithdraw;
    use crate::structs::traits::GeneralPrefixData;
    use super::_serialize;

    #[external(v0)]
    fn _expose_struct_fund(self: @ContractState, arg0: InputsFund) -> Span<felt252> {
        _serialize(arg0)
    }

    #[external(v0)]
    fn _expose_struct_transfer(self: @ContractState, arg0: InputsTransfer) -> Span<felt252> {
        _serialize(arg0)
    }

    #[external(v0)]
    fn _expose_struct_withdraw(self: @ContractState, arg0: InputsWithdraw) -> Span<felt252> {
        _serialize(arg0)
    }

    #[external(v0)]
    fn _expose_struct_ragequit(self: @ContractState, arg0: InputsRagequit) -> Span<felt252> {
        _serialize(arg0)
    }

    #[external(v0)]
    fn _expose_struct_rollover(self: @ContractState, arg0: InputsRollOver) -> Span<felt252> {
        _serialize(arg0)
    }

    #[external(v0)]
    fn _expose_struct_general_prefix_data(
        self: @ContractState, arg0: GeneralPrefixData,
    ) -> Span<felt252> {
        _serialize(arg0)
    }

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {
        assert!(false, "Non-deployable contract");
    }
}
