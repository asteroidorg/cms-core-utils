// src/server/cmsServerClient.test.ts
import { vi } from "vitest";
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
      let computed = false;
      let value: unknown;
      return ((...args: Parameters<T>) => {
        if (!computed) { computed = true; value = fn(...args); }
        return value;
      }) as T;
    },
  };
});

import { describe, expect, it } from "vitest";
import { createCmsServerClient } from "./cmsServerClient";

describe("createCmsServerClient", () => {
  it("throws when cmsUrl or apiKey is missing", () => {
    // @ts-expect-error intentionally invalid
    expect(() => createCmsServerClient({ apiKey: "k" })).toThrow();
    // @ts-expect-error intentionally invalid
    expect(() => createCmsServerClient({ cmsUrl: "https://x" })).toThrow();
  });

  it("normalizes cmsUrl and returns a memoized getClient", () => {
    const client = createCmsServerClient({ cmsUrl: "https://cms.example.com/", apiKey: "k" });
    expect(client.cmsUrl).toBe("https://cms.example.com");
    expect(client.getClient()).toBe(client.getClient());
  });

  it("uses a provided getClient escape hatch", () => {
    const fake = { query: vi.fn() } as unknown as ReturnType<typeof Object>;
    const getClient = () => fake as never;
    const client = createCmsServerClient({ cmsUrl: "https://cms.example.com", apiKey: "k", getClient });
    expect(client.getClient()).toBe(fake);
  });
});
