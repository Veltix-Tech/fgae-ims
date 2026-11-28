import { describe, expect, it } from "vitest";
import { parseAllowedOrigins } from "../../src/config/origins.js";

describe("parseAllowedOrigins", () => {
  it("returns an empty array when no origins are configured", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
  });

  it("parses one allowed origin", () => {
    expect(
      parseAllowedOrigins("http://localhost:5173"),
    ).toEqual(["http://localhost:5173"]);
  });

  it("supports multiple comma-separated origins", () => {
    expect(
      parseAllowedOrigins(
        "http://localhost:5173,https://example.com",
      ),
    ).toEqual([
      "http://localhost:5173",
      "https://example.com",
    ]);
  });

  it("removes duplicate origins", () => {
    expect(
      parseAllowedOrigins(
        "http://localhost:5173,http://localhost:5173",
      ),
    ).toEqual(["http://localhost:5173"]);
  });

  it("rejects origins containing paths", () => {
    expect(() =>
      parseAllowedOrigins("https://example.com/frontend"),
    ).toThrow();
  });

  it("rejects invalid origins", () => {
    expect(() =>
      parseAllowedOrigins("not-a-valid-origin"),
    ).toThrow();
  });

  it("rejects wildcard origins", () => {
    expect(() =>
      parseAllowedOrigins("*"),
    ).toThrow();
  });
});