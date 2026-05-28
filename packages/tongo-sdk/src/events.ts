export const EventType = {
    Fund: "fund",
    OutsideFund: "outsideFund",
    Rollover: "rollover",
    Withdraw: "withdraw",
    Ragequit: "ragequit",
    TransferIn: "transferIn",
    TransferOut: "transferOut",
    ExternalTransferIn: "externalTransferIn",
    BalanceDeclared: "balanceDeclared",
    TransferDeclared: "transferDeclared",
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];
