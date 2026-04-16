import { describe, expect, it } from "vitest";
import { None, Some } from "../utils.ts";
import {
    codec,
    externalData,
    ExternalData,
    relayData,
    RelayData,
    TransferOptions,
} from "./fixtures";

const transferOptionsType =
    "core::option::Option::<tongo::structs::operations::transfer::TransferOptions>" as const;

const transferOptionsNone = None<TransferOptions>();

const transferOptionsSomeSomeRelayDataSomeExternalData = Some<TransferOptions>({
    relayData: Some(relayData),
    externalData: Some(externalData),
});

const transferOptionsSomeNoneRelayDataSomeExternalData = Some<TransferOptions>({
    relayData: None<RelayData>(),
    externalData: Some(externalData),
});

const transferOptionsSomeSomeRelayDataNoneExternalData = Some<TransferOptions>({
    relayData: Some(relayData),
    externalData: None<ExternalData>(),
});

// edge case really, but we should support it and test it works
const transferOptionsSomeNoneRelayDataNoneExternalData = Some<TransferOptions>({
    relayData: None<RelayData>(),
    externalData: None<ExternalData>(),
});

describe("TransferOptions encode/decode round-trip", () => {
    it("None", () => {
        const encoded = codec.encode(transferOptionsType, transferOptionsNone);
        const decoded = codec.decode(transferOptionsType, encoded);
        expect(decoded).toEqual(transferOptionsNone);
    });

    it("Some(relayData: Some, externalData: Some)", () => {
        const encoded = codec.encode(
            transferOptionsType,
            transferOptionsSomeSomeRelayDataSomeExternalData,
        );
        const decoded = codec.decode(transferOptionsType, encoded);
        expect(decoded).toEqual(transferOptionsSomeSomeRelayDataSomeExternalData);
    });

    it("Some(relayData: None, externalData: Some)", () => {
        const encoded = codec.encode(
            transferOptionsType,
            transferOptionsSomeNoneRelayDataSomeExternalData,
        );
        const decoded = codec.decode(transferOptionsType, encoded);
        expect(decoded).toEqual(transferOptionsSomeNoneRelayDataSomeExternalData);
    });

    it("Some(relayData: Some, externalData: None)", () => {
        const encoded = codec.encode(
            transferOptionsType,
            transferOptionsSomeSomeRelayDataNoneExternalData,
        );
        const decoded = codec.decode(transferOptionsType, encoded);
        expect(decoded).toEqual(transferOptionsSomeSomeRelayDataNoneExternalData);
    });

    it("Some(relayData: None, externalData: None)", () => {
        const encoded = codec.encode(
            transferOptionsType,
            transferOptionsSomeNoneRelayDataNoneExternalData,
        );
        const decoded = codec.decode(transferOptionsType, encoded);
        expect(decoded).toEqual(transferOptionsSomeNoneRelayDataNoneExternalData);
    });
});
