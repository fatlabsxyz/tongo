import { describe, expect, it } from "vitest";
import { None, Some } from "../utils.ts";
import { codec, relayData, RelayData, WithdrawOptions } from "./fixtures";

const withdrawOptionsType = "core::option::Option::<tongo::structs::operations::withdraw::WithdrawOptions>" as const;

const withdrawOptionsNone = None<WithdrawOptions>();

const withdrawOptionsSomeSomeRelayData = Some<WithdrawOptions>({
  relayData: Some(relayData),
});

const withdrawOptionsSomeNoneRelayData = Some<WithdrawOptions>({
  relayData: None<RelayData>(),
});

describe('WithdrawOptions encode/decode round-trip', () => {

  it("None", () => {
    const encoded = codec.encode(withdrawOptionsType, withdrawOptionsNone);
    const decoded = codec.decode(withdrawOptionsType, encoded);
    expect(decoded).toEqual(withdrawOptionsNone);
  });

  it("Some(relayData: Some)", () => {
    const encoded = codec.encode(withdrawOptionsType, withdrawOptionsSomeSomeRelayData);
    const decoded = codec.decode(withdrawOptionsType, encoded);
    expect(decoded).toEqual(withdrawOptionsSomeSomeRelayData);
  });

  it("Some(relayData: None)", () => {
    const encoded = codec.encode(withdrawOptionsType, withdrawOptionsSomeNoneRelayData);
    const decoded = codec.decode(withdrawOptionsType, encoded);
    expect(decoded).toEqual(withdrawOptionsSomeNoneRelayData);
  });

});
