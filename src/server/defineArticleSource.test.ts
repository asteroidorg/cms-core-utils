// src/server/defineArticleSource.test.ts
import { describe, expect, it } from "vitest";
import { buildSearchConditions, defineArticleSource } from "./defineArticleSource";

const fakeClient = { getClient: () => ({}) as never, cmsUrl: "https://cms.example.com" };
const fakeSeo = { siteName: "Acme", baseUrl: "https://acme.example" } as never;

describe("buildSearchConditions", () => {
  it("returns undefined when query is empty", () => {
    expect(buildSearchConditions(["title"], "")).toBeUndefined();
    expect(buildSearchConditions(["title"], undefined)).toBeUndefined();
  });
  it("maps each field to a case-insensitive condition", () => {
    expect(buildSearchConditions(["title", "description"], "hi")).toEqual([
      { field: "title", value: "hi", mode: "i" },
      { field: "description", value: "hi", mode: "i" },
    ]);
  });
});

describe("defineArticleSource", () => {
  it("applies defaults", () => {
    const source = defineArticleSource({
      client: fakeClient,
      schemaSlug: "blog",
      listSelect: ["slug", "title"],
      detailSelect: ["slug", "title", "content"],
      seo: fakeSeo,
    });
    expect(source.searchFields).toEqual(["title", "description"]);
    expect(source.status).toBe("PUBLISHED");
    expect(source.articleType).toBe("Article");
    expect(source.relatedLimit).toBe(3);
  });
  it("keeps explicit overrides", () => {
    const source = defineArticleSource({
      client: fakeClient,
      schemaSlug: "news",
      listSelect: ["slug"],
      detailSelect: ["slug"],
      seo: fakeSeo,
      searchFields: ["title"],
      status: "DRAFT",
      articleType: "NewsArticle",
      relatedLimit: 5,
    });
    expect(source.searchFields).toEqual(["title"]);
    expect(source.status).toBe("DRAFT");
    expect(source.articleType).toBe("NewsArticle");
    expect(source.relatedLimit).toBe(5);
  });
});
