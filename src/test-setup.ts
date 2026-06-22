// src/test-setup.ts
// Polyfill React.cache for test environments (React 18 does not ship cache outside RSC).
// React 19+ exports cache natively; this shim makes tests pass on React 18.
import { vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  if (typeof original.cache === "function") return original;

  // Simple per-call memoizer that mimics React.cache identity semantics
  // (no args => always same instance, which is what our factory uses).
  const cache = <T extends (...args: never[]) => unknown>(fn: T): T => {
    let result: unknown;
    let called = false;
    return ((...args: never[]) => {
      if (!called) { called = true; result = fn(...args); }
      return result;
    }) as T;
  };

  return { ...original, cache };
});
