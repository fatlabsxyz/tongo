export const tongoAbi = [
    {
        "type": "impl",
        "name": "TongoImpl",
        "interface_name": "tongo::tongo::ITongo::ITongo"
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
                "name": "auditPart",
                "type": "core::option::Option::<tongo::structs::operations::audit::Audit>"
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
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::common::cipherbalance::CipherBalance>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "None",
                "type": "()"
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
        "name": "tongo::structs::common::state::State",
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
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "audit",
                "type": "core::option::Option::<tongo::structs::common::cipherbalance::CipherBalance>"
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
        "type": "interface",
        "name": "tongo::tongo::ITongo::ITongo",
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
                "name": "get_owner",
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
                "name": "fund_from_outside",
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
                "name": "get_audit",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::option::Option::<tongo::structs::common::cipherbalance::CipherBalance>"
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
                "name": "get_state",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::structs::common::state::State"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "auditor_key",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>"
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
                "name": "auditor_key",
                "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>"
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
                "name": "transferBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            },
            {
                "name": "transferBalanceSelf",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            },
            {
                "name": "hintTransfer",
                "type": "tongo::structs::aecipher::AEBalance",
                "kind": "data"
            },
            {
                "name": "hintLeftover",
                "type": "tongo::structs::aecipher::AEBalance",
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
                "name": "from",
                "type": "core::starknet::contract_address::ContractAddress",
                "kind": "key"
            },
            {
                "name": "amount",
                "type": "core::integer::u128",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::OutsideFundEvent",
        "kind": "struct",
        "members": [
            {
                "name": "to",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
            {
                "name": "from",
                "type": "core::starknet::contract_address::ContractAddress",
                "kind": "key"
            },
            {
                "name": "amount",
                "type": "core::integer::u128",
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
            },
            {
                "name": "rollovered",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
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
                "type": "core::integer::u128",
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
                "type": "core::integer::u128",
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
        "name": "tongo::structs::events::BalanceDeclared",
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
                "name": "auditorPubKey",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "data"
            },
            {
                "name": "declaredCipherBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            },
            {
                "name": "hint",
                "type": "tongo::structs::aecipher::AEBalance",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::TransferDeclared",
        "kind": "struct",
        "members": [
            {
                "name": "from",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "key"
            },
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
                "name": "auditorPubKey",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "data"
            },
            {
                "name": "declaredCipherBalance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance",
                "kind": "data"
            },
            {
                "name": "hint",
                "type": "tongo::structs::aecipher::AEBalance",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::AuditorPubKeySet",
        "kind": "struct",
        "members": [
            {
                "name": "keyNumber",
                "type": "core::integer::u128",
                "kind": "key"
            },
            {
                "name": "AuditorPubKey",
                "type": "tongo::structs::common::pubkey::PubKey",
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
                "name": "OutsideFundEvent",
                "type": "tongo::structs::events::OutsideFundEvent",
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
            },
            {
                "name": "BalanceDeclared",
                "type": "tongo::structs::events::BalanceDeclared",
                "kind": "nested"
            },
            {
                "name": "TransferDeclared",
                "type": "tongo::structs::events::TransferDeclared",
                "kind": "nested"
            },
            {
                "name": "AuditorPubKeySet",
                "type": "tongo::structs::events::AuditorPubKeySet",
                "kind": "nested"
            }
        ]
    }
] as const;
