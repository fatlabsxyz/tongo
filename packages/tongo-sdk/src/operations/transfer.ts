import { CairoOption, Call, Contract } from "starknet";

import { ProofOfTransfer } from "../provers/transfer";
import { StarkPoint } from "../types.js";

import { AEBalance } from "../ae_balance.js";
import { Audit } from "./audit.js";
import { TongoAbiType } from "../abi/abi.types.js";
import { IOperation, OperationType } from "./operation.js";

export type ExternalData = TongoAbiType<"tongo::structs::operations::transfer::ExternalData">;
export type TransferOptions = TongoAbiType<"tongo::structs::operations::transfer::TransferOptions">;

export interface ITransferOperation extends IOperation {
  type: typeof OperationType.Transfer;
}

interface StarkCipherBalance {
  L: StarkPoint;
  R: StarkPoint;
}

/**
 * Represents the calldata of a transfer operation.
 * @interface TransferOpParams
 * @property {StarkPoint} from - The Tongo account to take tongos from
 * @property {StarkPoint} to - The Tongo account to send tongos to
 * @property {StarkCipherBalance} transferBalance - The amount to transfer encrypted for the pubkey of `to`
 * @property {StarkCipherBalance} transferBalanceSelf - The amount to transfer encrypted for the pubkey of `from`
 * @property {AEBalance} hintTransfer - AE encryption of the amount to transfer to `to`
 * @property {AEBalance} hintLeftover - AE encryption of the leftover balance of `from`
 * @property {ProofOfTransfer} proof - ZK proof for the transfer operation
 * @property {CairoOption<Audit>} auditPart - Optional Audit to declare the balance of the account after the tx
 * @property {CairoOption<Audit>} auditPartTransfer - Optional Audit to declare the transfer amount
 * @property {CairoOption<TransferOptions>} transfer_options - Options including relay and external data
 * @property {Contract} Tongo - The tongo instance to interact with
 */
interface TransferOpParams {
  from: StarkPoint;
  to: StarkPoint;
  transferBalance: StarkCipherBalance;
  transferBalanceSelf: StarkCipherBalance;
  auxiliarCipher: StarkCipherBalance;
  auxiliarCipher2: StarkCipherBalance;
  proof: ProofOfTransfer;
  hintTransfer: AEBalance;
  hintLeftover: AEBalance;
  auditPart: CairoOption<Audit>;
  auditPartTransfer: CairoOption<Audit>;
  transfer_options: CairoOption<TransferOptions>;
  Tongo: Contract;
}

//TODO: handle this better, maybe something similar to the cairo contracts
export function serializeTransferOptions(transfer_options: CairoOption<TransferOptions>): bigint[] {
  if (transfer_options.isNone()) { return [1n]; }

  let arr = [0n];
  const { relayData, externalData } = transfer_options.unwrap()!;
  if (relayData.isNone()) {
    arr.push(1n);
  } else {
    arr.push(0n);
    arr.push(BigInt(relayData.unwrap()!.fee_to_sender));
  }

  if (externalData.isNone()) {
    arr.push(1n);
  } else {
    arr.push(0n);
    arr.push(BigInt(externalData.unwrap()!.toTongo));
  }
  return arr;
}

export class TransferOperation implements ITransferOperation {
  type: typeof OperationType.Transfer = OperationType.Transfer;
  Tongo: Contract;
  from: StarkPoint;
  to: StarkPoint;
  transferBalance: StarkCipherBalance;
  transferBalanceSelf: StarkCipherBalance;
  auxiliarCipher: StarkCipherBalance;
  auxiliarCipher2: StarkCipherBalance;
  hintTransfer: AEBalance;
  hintLeftover: AEBalance;
  proof: ProofOfTransfer;
  auditPart: CairoOption<Audit>;
  auditPartTransfer: CairoOption<Audit>;
  transfer_options: CairoOption<TransferOptions>;

  constructor({
    from,
    to,
    transferBalance,
    transferBalanceSelf,
    proof,
    auditPart,
    auditPartTransfer,
    auxiliarCipher,
    auxiliarCipher2,
    Tongo,
    hintTransfer,
    hintLeftover,
    transfer_options,
  }: TransferOpParams) {
    this.from = from;
    this.to = to;
    this.transferBalance = transferBalance;
    this.transferBalanceSelf = transferBalanceSelf;
    this.auxiliarCipher = auxiliarCipher;
    this.auxiliarCipher2 = auxiliarCipher2;
    this.hintTransfer = hintTransfer;
    this.hintLeftover = hintLeftover;
    this.proof = proof;
    this.auditPart = auditPart;
    this.auditPartTransfer = auditPartTransfer;
    this.transfer_options = transfer_options;
    this.Tongo = Tongo;
  }

  toCalldata(): Call {
    return this.Tongo.populate("transfer", [
      {
        from: this.from,
        to: this.to,
        transferBalance: this.transferBalance,
        transferBalanceSelf: this.transferBalanceSelf,
        auxiliarCipher: this.auxiliarCipher,
        auxiliarCipher2: this.auxiliarCipher2,
        hintTransfer: this.hintTransfer,
        hintLeftover: this.hintLeftover,
        proof: this.proof,
        auditPart: this.auditPart,
        auditPartTransfer: this.auditPartTransfer,
      },
      this.transfer_options,
    ]);
  }
}
