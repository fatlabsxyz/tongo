export const tongoAbi = [
    {
        "type": "impl",
        "name": "TongoImpl",
        "interface_name": "tongo::tongo::ITongo::ITongo"
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
        "name": "tongo::structs::aecipher::AEHints",
        "members": [
            {
                "name": "ae_balance",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "ae_audit_balance",
                "type": "tongo::structs::aecipher::AEBalance"
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
                "name": "Ar",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "Ab",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_auditor",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "AUX_A",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "sx",
                "type": "core::felt252"
            },
            {
                "name": "sr",
                "type": "core::felt252"
            },
            {
                "name": "sb",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::fund::Fund",
        "members": [
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "auxBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "auditedBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "amount",
                "type": "core::felt252"
            },
            {
                "name": "ae_hints",
                "type": "tongo::structs::aecipher::AEHints"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::fund::ProofOfFund"
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
                "name": "proof",
                "type": "tongo::structs::operations::rollover::ProofOfRollOver"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::operations::ragequit::ProofOfRagequit",
        "members": [
            {
                "name": "A_x",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_cr",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "s_x",
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
                "name": "amount",
                "type": "core::felt252"
            },
            {
                "name": "to",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "ae_hints",
                "type": "tongo::structs::aecipher::AEHints"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::ragequit::ProofOfRagequit"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::proofbit::ProofOfBit",
        "members": [
            {
                "name": "V",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
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
        "name": "core::array::Span::<tongo::structs::proofbit::ProofOfBit>",
        "members": [
            {
                "name": "snapshot",
                "type": "@core::array::Array::<tongo::structs::proofbit::ProofOfBit>"
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
                "name": "A_auditor",
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
                "type": "core::array::Span::<tongo::structs::proofbit::ProofOfBit>"
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
                "type": "core::felt252"
            },
            {
                "name": "auditedBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "ae_hints",
                "type": "tongo::structs::aecipher::AEHints"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::withdraw::ProofOfWithdraw"
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
                "name": "A_audit",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "A_self_audit",
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
                "type": "core::array::Span::<tongo::structs::proofbit::ProofOfBit>"
            },
            {
                "name": "range2",
                "type": "core::array::Span::<tongo::structs::proofbit::ProofOfBit>"
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
                "name": "transferBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "transferBalanceSelf",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "auditedBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "auditedBalanceSelf",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "ae_hints",
                "type": "tongo::structs::aecipher::AEHints"
            },
            {
                "name": "proof",
                "type": "tongo::structs::operations::transfer::ProofOfTransfer"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::aecipher::AEBalance>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "None",
                "type": "()"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::tongo::ITongo::State",
        "members": [
            {
                "name": "balance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "pending",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "audit",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "ae_balance",
                "type": "core::option::Option::<tongo::structs::aecipher::AEBalance>"
            },
            {
                "name": "ae_audit_balance",
                "type": "core::option::Option::<tongo::structs::aecipher::AEBalance>"
            }
        ]
    },
    {
        "type": "interface",
        "name": "tongo::tongo::ITongo::ITongo",
        "items": [
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
                "name": "rollover",
                "inputs": [
                    {
                        "name": "rollover",
                        "type": "tongo::structs::operations::rollover::Rollover"
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
                "name": "get_balance",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_audit",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_pending",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_nonce",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::integer::u64"
                    }
                ],
                "state_mutability": "view"
            },
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
                "name": "get_state",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::tongo::ITongo::State"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "change_auditor_key",
                "inputs": [
                    {
                        "name": "new_auditor_key",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "auditor_key",
                "inputs": [],
                "outputs": [
                    {
                        "type": "tongo::structs::common::pubkey::PubKey"
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
            }
        ]
    },
    {
        "type": "constructor",
        "name": "constructor",
        "inputs": [
            {
                "name": "owner",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "auditor_key",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "ERC20",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "rate",
                "type": "core::integer::u256"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::TransferEvent",
        "kind": "struct",
        "members": [
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
            {
                "name": "from",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64",
                "kind": "key"
            },
            {
                "name": "auditorPubKey",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "data"
            },
            {
                "name": "auditedBalanceLeft",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            },
            {
                "name": "auditedBalanceSend",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::FundEvent",
        "kind": "struct",
        "members": [
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64",
                "kind": "key"
            },
            {
                "name": "amount",
                "type": "core::integer::u64",
                "kind": "data"
            },
            {
                "name": "auditorPubKey",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "data"
            },
            {
                "name": "auditedBalanceLeft",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::RolloverEvent",
        "kind": "struct",
        "members": [
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64",
                "kind": "key"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::WithdrawEvent",
        "kind": "struct",
        "members": [
            {
                "name": "from",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64",
                "kind": "key"
            },
            {
                "name": "amount",
                "type": "core::integer::u64",
                "kind": "data"
            },
            {
                "name": "to",
                "type": "core::starknet::contract_address::ContractAddress",
                "kind": "data"
            },
            {
                "name": "auditorPubKey",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "data"
            },
            {
                "name": "auditedBalanceLeft",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::RagequitEvent",
        "kind": "struct",
        "members": [
            {
                "name": "from",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64",
                "kind": "key"
            },
            {
                "name": "amount",
                "type": "core::integer::u64",
                "kind": "data"
            },
            {
                "name": "to",
                "type": "core::starknet::contract_address::ContractAddress",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::tongo::Tongo::Tongo::Event",
        "kind": "enum",
        "variants": [
            {
                "name": "TransferEvent",
                "type": "tongo::structs::events::TransferEvent",
                "kind": "nested"
            },
            {
                "name": "FundEvent",
                "type": "tongo::structs::events::FundEvent",
                "kind": "nested"
            },
            {
                "name": "RolloverEvent",
                "type": "tongo::structs::events::RolloverEvent",
                "kind": "nested"
            },
            {
                "name": "WithdrawEvent",
                "type": "tongo::structs::events::WithdrawEvent",
                "kind": "nested"
            },
            {
                "name": "RagequitEvent",
                "type": "tongo::structs::events::RagequitEvent",
                "kind": "nested"
            }
        ]
    }
] as const;
