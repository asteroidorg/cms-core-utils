import { describe, expect, it } from "vitest";
import { createImageResolver } from "./cmsImage";

describe("createImageResolver", () => {
  const resolve = createImageResolver({ cmsUrl: "https://cms.example.com/" });

  it("builds a canonical url from an id", () => {
    expect(resolve("abc123")).toBe("https://cms.example.com/media/canonical/abc123");
  });
  it("passes absolute urls through unchanged", () => {
    expect(resolve("https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png");
  });
  it("returns empty string for empty input", () => {
    expect(resolve("")).toBe("");
    expect(resolve(undefined)).toBe("");
  });
  it("returns empty string for an id when no cmsUrl is configured", () => {
    expect(createImageResolver({})("abc123")).toBe("");
  });
});
