import { describe, expect, it } from "vitest";
import { None, Some } from "../utils.ts";
import { codec, RagequitOptions, relayData, RelayData } from "./fixtures";

const ragequitOptionsType =
    "core::option::Option::<tongo::structs::operations::ragequit::RagequitOptions>" as const;

const ragequitOptionsNone = None<RagequitOptions>();

const ragequitOptionsSomeSomeRelayData = Some<RagequitOptions>({
    relayData: Some(relayData),
});

const ragequitOptionsSomeNoneRelayData = Some<RagequitOptions>({
    relayData: None<RelayData>(),
});

describe("RagequitOptions encode/decode round-trip", () => {
    it("None", () => {
        const encoded = codec.encode(ragequitOptionsType, ragequitOptionsNone);
        const decoded = codec.decode(ragequitOptionsType, encoded);
        expect(decoded).toEqual(ragequitOptionsNone);
    });

    it("Some(relayData: Some)", () => {
        const encoded = codec.encode(ragequitOptionsType, ragequitOptionsSomeSomeRelayData);
        const decoded = codec.decode(ragequitOptionsType, encoded);
        expect(decoded).toEqual(ragequitOptionsSomeSomeRelayData);
    });

    it("Some(relayData: None)", () => {
        const encoded = codec.encode(ragequitOptionsType, ragequitOptionsSomeNoneRelayData);
        const decoded = codec.decode(ragequitOptionsType, encoded);
        expect(decoded).toEqual(ragequitOptionsSomeNoneRelayData);
    });
});
