export const auxAbi = [
    {
        "type": "struct",
        "name": "tongo::structs::common::pubkey::PubKey",
        "members": [
            {
                "name": "x",
                "type": "core::felt252"
            },
            {
                "name": "y",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::traits::GeneralPrefixData",
        "members": [
            {
                "name": "chain_id",
                "type": "core::felt252"
            },
            {
                "name": "tongo_address",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "sender_address",
                "type": "core::starknet::contract_address::ContractAddress"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::fund::InputsFund",
        "members": [
            {
                "name": "y",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "amount",
                "type": "core::integer::u128"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "prefix_data",
                "type": "tongo::structs::traits::GeneralPrefixData"
            }
        ]
    },
    {
        "type": "struct",
        "name": "core::array::Span::<core::felt252>",
        "members": [
            {
                "name": "snapshot",
                "type": "@core::array::Array::<core::felt252>"
            }
        ]
    },
    {
        "type": "function",
        "name": "_expose_struct_fund",
        "inputs": [
            {
                "name": "arg0",
                "type": "tongo::structs::operations::fund::InputsFund"
            }
        ],
        "outputs": [
            {
                "type": "core::array::Span::<core::felt252>"
            }
        ],
        "state_mutability": "view"
    },
    {
        "type": "struct",
        "name": "tongo::structs::common::starkpoint::StarkPoint",
        "members": [
            {
                "name": "x",
                "type": "core::felt252"
            },
            {
                "name": "y",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::common::cipherbalance::CipherBalance",
        "members": [
            {
                "name": "L",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "R",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::transfer::InputsTransfer",
        "members": [
            {
                "name": "from",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "currentBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "transferBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "transferBalanceSelf",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "auxiliarCipher",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "auxiliarCipher2",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "bit_size",
                "type": "core::integer::u32"
            },
            {
                "name": "prefix_data",
                "type": "tongo::structs::traits::GeneralPrefixData"
            },
            {
                "name": "data",
                "type": "core::array::Span::<core::felt252>"
            }
        ]
    },
    {
        "type": "function",
        "name": "_expose_struct_transfer",
        "inputs": [
            {
                "name": "arg0",
                "type": "tongo::structs::operations::transfer::InputsTransfer"
            }
        ],
        "outputs": [
            {
                "type": "core::array::Span::<core::felt252>"
            }
        ],
        "state_mutability": "view"
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::withdraw::InputsWithdraw",
        "members": [
            {
                "name": "y",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "to",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "amount",
                "type": "core::integer::u128"
            },
            {
                "name": "currentBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "auxiliarCipher",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "bit_size",
                "type": "core::integer::u32"
            },
            {
                "name": "prefix_data",
                "type": "tongo::structs::traits::GeneralPrefixData"
            },
            {
                "name": "data",
                "type": "core::array::Span::<core::felt252>"
            }
        ]
    },
    {
        "type": "function",
        "name": "_expose_struct_withdraw",
        "inputs": [
            {
                "name": "arg0",
                "type": "tongo::structs::operations::withdraw::InputsWithdraw"
            }
        ],
        "outputs": [
            {
                "type": "core::array::Span::<core::felt252>"
            }
        ],
        "state_mutability": "view"
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::ragequit::InputsRagequit",
        "members": [
            {
                "name": "y",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "to",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "amount",
                "type": "core::integer::u128"
            },
            {
                "name": "currentBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "prefix_data",
                "type": "tongo::structs::traits::GeneralPrefixData"
            },
            {
                "name": "data",
                "type": "core::array::Span::<core::felt252>"
            }
        ]
    },
    {
        "type": "function",
        "name": "_expose_struct_ragequit",
        "inputs": [
            {
                "name": "arg0",
                "type": "tongo::structs::operations::ragequit::InputsRagequit"
            }
        ],
        "outputs": [
            {
                "type": "core::array::Span::<core::felt252>"
            }
        ],
        "state_mutability": "view"
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::rollover::InputsRollOver",
        "members": [
            {
                "name": "y",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "prefix_data",
                "type": "tongo::structs::traits::GeneralPrefixData"
            }
        ]
    },
    {
        "type": "function",
        "name": "_expose_struct_rollover",
        "inputs": [
            {
                "name": "arg0",
                "type": "tongo::structs::operations::rollover::InputsRollOver"
            }
        ],
        "outputs": [
            {
                "type": "core::array::Span::<core::felt252>"
            }
        ],
        "state_mutability": "view"
    },
    {
        "type": "function",
        "name": "_expose_struct_general_prefix_data",
        "inputs": [
            {
                "name": "arg0",
                "type": "tongo::structs::traits::GeneralPrefixData"
            }
        ],
        "outputs": [
            {
                "type": "core::array::Span::<core::felt252>"
            }
        ],
        "state_mutability": "view"
    },
    {
        "type": "constructor",
        "name": "constructor",
        "inputs": []
    },
    {
        "type": "event",
        "name": "tongo::tongo::Aux::Aux::Event",
        "kind": "enum",
        "variants": []
    }
] as const;
