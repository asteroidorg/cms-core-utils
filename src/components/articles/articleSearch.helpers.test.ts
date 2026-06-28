import { describe, expect, it } from "vitest";
import { readSearchParam, buildSearchUrl } from "./articleSearch.helpers";

describe("readSearchParam", () => {
  it("returns the value of the param when present", () => {
    expect(readSearchParam("?q=hello", "q")).toBe("hello");
  });

  it("decodes encoded values", () => {
    expect(readSearchParam("?q=hello%20world", "q")).toBe("hello world");
  });

  it("returns an empty string when the param is absent", () => {
    expect(readSearchParam("?page=2", "q")).toBe("");
  });

  it("returns an empty string for an empty search", () => {
    expect(readSearchParam("", "q")).toBe("");
  });

  it("works with a search string that has no leading '?'", () => {
    expect(readSearchParam("q=hi", "q")).toBe("hi");
  });
});

describe("buildSearchUrl", () => {
  it("sets the param and appends it to the pathname", () => {
    expect(buildSearchUrl("", "/blog", "q", "react")).toBe("/blog?q=react");
  });

  it("preserves other existing params", () => {
    expect(buildSearchUrl("?page=2", "/blog", "q", "react")).toBe(
      "/blog?page=2&q=react",
    );
  });

  it("updates an existing value of the same param", () => {
    expect(buildSearchUrl("?q=old", "/blog", "q", "new")).toBe("/blog?q=new");
  });

  it("removes the param when the query is empty", () => {
    expect(buildSearchUrl("?q=old", "/blog", "q")).toBe("/blog");
  });

  it("keeps other params when clearing the search param", () => {
    expect(buildSearchUrl("?q=old&page=2", "/blog", "q")).toBe("/blog?page=2");
  });

  it("returns the bare pathname when there are no params left", () => {
    expect(buildSearchUrl("", "/blog", "q", "")).toBe("/blog");
  });

  it("trims surrounding whitespace from the query", () => {
    expect(buildSearchUrl("", "/blog", "q", "  spaced  ")).toBe("/blog?q=spaced");
  });

  it("treats a whitespace-only query as empty and removes the param", () => {
    expect(buildSearchUrl("?q=old", "/blog", "q", "   ")).toBe("/blog");
  });

  it("encodes special characters in the query", () => {
    expect(buildSearchUrl("", "/blog", "q", "a b")).toBe("/blog?q=a+b");
  });
});
