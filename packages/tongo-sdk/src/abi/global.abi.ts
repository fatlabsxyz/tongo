export const globalAbi = [
    {
        "type": "impl",
        "name": "GlobalImpl",
        "interface_name": "tongo::tongo::IGlobal::IGlobal"
    },
    {
        "type": "struct",
        "name": "core::integer::u256",
        "members": [
            {
                "name": "low",
                "type": "core::integer::u128"
            },
            {
                "name": "high",
                "type": "core::integer::u128"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::bool",
        "variants": [
            {
                "name": "False",
                "type": "()"
            },
            {
                "name": "True",
                "type": "()"
            }
        ]
    },
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
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::common::pubkey::PubKey>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "None",
                "type": "()"
            }
        ]
    },
    {
        "type": "struct",
        "name": "core::integer::u512",
        "members": [
            {
                "name": "limb0",
                "type": "core::integer::u128"
            },
            {
                "name": "limb1",
                "type": "core::integer::u128"
            },
            {
                "name": "limb2",
                "type": "core::integer::u128"
            },
            {
                "name": "limb3",
                "type": "core::integer::u128"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::aecipher::AEBalance",
        "members": [
            {
                "name": "ciphertext",
                "type": "core::integer::u512"
            },
            {
                "name": "nonce",
                "type": "core::integer::u256"
            }
        ]
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
        "name": "tongo::structs::operations::fund::ProofOfFund",
        "members": [
            {
                "name": "Ax",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "sx",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::common::relayer::RelayData",
        "members": [
            {
                "name": "fee_to_sender",
                "type": "core::integer::u128"
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
        "name": "tongo::structs::operations::audit::ProofOfAudit",
        "members": [
            {
                "name": "Ax",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "AL0",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "AL1",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "AR1",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "sx",
                "type": "core::felt252"
            },
            {
                "name": "sb",
                "type": "core::felt252"
            },
            {
                "name": "sr",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::audit::Audit",
        "members": [
            {
                "name": "auditedBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "hint",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::audit::ProofOfAudit"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::operations::audit::Audit>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::operations::audit::Audit"
            },
            {
                "name": "None",
                "type": "()"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::fund::Fund",
        "members": [
            {
                "name": "ledger",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "amount",
                "type": "core::integer::u128"
            },
            {
                "name": "hint",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::fund::ProofOfFund"
            },
            {
                "name": "relayData",
                "type": "tongo::structs::common::relayer::RelayData"
            },
            {
                "name": "auditPart",
                "type": "core::option::Option::<tongo::structs::operations::audit::Audit>"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::fund::OutsideFund",
        "members": [
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "amount",
                "type": "core::integer::u128"
            },
            {
                "name": "ledger",
                "type": "core::starknet::contract_address::ContractAddress"
            }
        ]
    },
    {
        "type": "struct",
        "name": "core::array::Span::<tongo::structs::common::starkpoint::StarkPoint>",
        "members": [
            {
                "name": "snapshot",
                "type": "@core::array::Array::<tongo::structs::common::starkpoint::StarkPoint>"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::verifier::range::bitProof",
        "members": [
            {
                "name": "A0",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A1",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "c0",
                "type": "core::felt252"
            },
            {
                "name": "s0",
                "type": "core::felt252"
            },
            {
                "name": "s1",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "core::array::Span::<tongo::verifier::range::bitProof>",
        "members": [
            {
                "name": "snapshot",
                "type": "@core::array::Array::<tongo::verifier::range::bitProof>"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::verifier::range::Range",
        "members": [
            {
                "name": "commitments",
                "type": "core::array::Span::<tongo::structs::common::starkpoint::StarkPoint>"
            },
            {
                "name": "proofs",
                "type": "core::array::Span::<tongo::verifier::range::bitProof>"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::withdraw::ProofOfWithdraw",
        "members": [
            {
                "name": "A_x",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_r",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_v",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "sx",
                "type": "core::felt252"
            },
            {
                "name": "sb",
                "type": "core::felt252"
            },
            {
                "name": "sr",
                "type": "core::felt252"
            },
            {
                "name": "range",
                "type": "tongo::verifier::range::Range"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::withdraw::Withdraw",
        "members": [
            {
                "name": "from",
                "type": "tongo::structs::common::pubkey::PubKey"
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
                "name": "hint",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "auxiliarCipher",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::withdraw::ProofOfWithdraw"
            },
            {
                "name": "relayData",
                "type": "tongo::structs::common::relayer::RelayData"
            },
            {
                "name": "auditPart",
                "type": "core::option::Option::<tongo::structs::operations::audit::Audit>"
            },
            {
                "name": "ledger",
                "type": "core::starknet::contract_address::ContractAddress"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::ragequit::ProofOfRagequit",
        "members": [
            {
                "name": "Ax",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "AR",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "sx",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::ragequit::Ragequit",
        "members": [
            {
                "name": "from",
                "type": "tongo::structs::common::pubkey::PubKey"
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
                "name": "hint",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::ragequit::ProofOfRagequit"
            },
            {
                "name": "relayData",
                "type": "tongo::structs::common::relayer::RelayData"
            },
            {
                "name": "ledger",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "auditPart",
                "type": "core::option::Option::<tongo::structs::operations::audit::Audit>"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::transfer::ProofOfTransfer",
        "members": [
            {
                "name": "A_x",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_r",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_r2",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_b",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_b2",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_v",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_v2",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_bar",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "s_x",
                "type": "core::felt252"
            },
            {
                "name": "s_r",
                "type": "core::felt252"
            },
            {
                "name": "s_b",
                "type": "core::felt252"
            },
            {
                "name": "s_b2",
                "type": "core::felt252"
            },
            {
                "name": "s_r2",
                "type": "core::felt252"
            },
            {
                "name": "range",
                "type": "tongo::verifier::range::Range"
            },
            {
                "name": "range2",
                "type": "tongo::verifier::range::Range"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::transfer::Transfer",
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
                "name": "ledger",
                "type": "core::starknet::contract_address::ContractAddress"
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
                "name": "hintTransfer",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "hintLeftover",
                "type": "tongo::structs::aecipher::AEBalance"
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
                "name": "proof",
                "type": "tongo::structs::operations::transfer::ProofOfTransfer"
            },
            {
                "name": "relayData",
                "type": "tongo::structs::common::relayer::RelayData"
            },
            {
                "name": "auditPart",
                "type": "core::option::Option::<tongo::structs::operations::audit::Audit>"
            },
            {
                "name": "auditPartTransfer",
                "type": "core::option::Option::<tongo::structs::operations::audit::Audit>"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::rollover::ProofOfRollOver",
        "members": [
            {
                "name": "Ax",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "sx",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::rollover::Rollover",
        "members": [
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "ledger",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "hint",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::rollover::ProofOfRollOver"
            }
        ]
    },
    {
        "type": "interface",
        "name": "tongo::tongo::IGlobal::IGlobal",
        "items": [
            {
                "type": "function",
                "name": "ERC20",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::starknet::contract_address::ContractAddress"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_rate",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::integer::u256"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_bit_size",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::integer::u32"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "is_known_ledger",
                "inputs": [
                    {
                        "name": "ledger",
                        "type": "core::starknet::contract_address::ContractAddress"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::bool"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "deploy_ledger",
                "inputs": [
                    {
                        "name": "owner",
                        "type": "core::starknet::contract_address::ContractAddress"
                    },
                    {
                        "name": "auditorKey",
                        "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>"
                    },
                    {
                        "name": "salt",
                        "type": "core::felt252"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::starknet::contract_address::ContractAddress"
                    }
                ],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "fund",
                "inputs": [
                    {
                        "name": "fund",
                        "type": "tongo::structs::operations::fund::Fund"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "outside_fund",
                "inputs": [
                    {
                        "name": "outsideFund",
                        "type": "tongo::structs::operations::fund::OutsideFund"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "withdraw",
                "inputs": [
                    {
                        "name": "withdraw",
                        "type": "tongo::structs::operations::withdraw::Withdraw"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "ragequit",
                "inputs": [
                    {
                        "name": "ragequit",
                        "type": "tongo::structs::operations::ragequit::Ragequit"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "transfer",
                "inputs": [
                    {
                        "name": "transfer",
                        "type": "tongo::structs::operations::transfer::Transfer"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "rollover",
                "inputs": [
                    {
                        "name": "rollover",
                        "type": "tongo::structs::operations::rollover::Rollover"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            }
        ]
    },
    {
        "type": "constructor",
        "name": "constructor",
        "inputs": [
            {
                "name": "ERC20",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "rate",
                "type": "core::integer::u256"
            },
            {
                "name": "bit_size",
                "type": "core::integer::u32"
            },
            {
                "name": "ledger_class",
                "type": "core::starknet::class_hash::ClassHash"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::tongo::Global::Global::Event",
        "kind": "enum",
        "variants": []
    }
] as const;
