// src/server/defineArticleSource.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("../fetchCmsContent", () => ({ fetchCmsContent: vi.fn() }));
import { fetchCmsContent } from "../fetchCmsContent";
import {
  buildSearchConditions,
  defineArticleSource,
  fetchArticles,
  fetchArticle,
  fetchRelatedArticles,
} from "./defineArticleSource";

const mockFetch = vi.mocked(fetchCmsContent);
beforeEach(() => mockFetch.mockReset());

const fakeClient = { getClient: () => ({}) as never, cmsUrl: "https://cms.example.com" };
const fakeSeo = { siteName: "Acme", baseUrl: "https://acme.example" } as never;

const source = defineArticleSource({
  client: fakeClient,
  schemaSlug: "blog",
  listSelect: ["slug", "title"],
  detailSelect: ["slug", "title", "content"],
  seo: fakeSeo,
});

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
    const s = defineArticleSource({
      client: fakeClient,
      schemaSlug: "blog",
      listSelect: ["slug", "title"],
      detailSelect: ["slug", "title", "content"],
      seo: fakeSeo,
    });
    expect(s.searchFields).toEqual(["title", "description"]);
    expect(s.status).toBe("PUBLISHED");
    expect(s.articleType).toBe("Article");
    expect(s.relatedLimit).toBe(3);
  });
  it("keeps explicit overrides", () => {
    const s = defineArticleSource({
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
    expect(s.searchFields).toEqual(["title"]);
    expect(s.status).toBe("DRAFT");
    expect(s.articleType).toBe("NewsArticle");
    expect(s.relatedLimit).toBe(5);
  });
});

describe("fetchArticles", () => {
  it("returns the array on success", async () => {
    const posts = [{ slug: "a", title: "A" }, { slug: "b", title: "B" }];
    mockFetch.mockResolvedValueOnce(posts as never);
    const result = await fetchArticles(source);
    expect(result).toEqual(posts);
  });

  it("returns [] when fetchCmsContent resolves a non-array (null)", async () => {
    mockFetch.mockResolvedValueOnce(null as never);
    const result = await fetchArticles(source);
    expect(result).toEqual([]);
  });

  it("passes search conditions when searchQuery is provided", async () => {
    mockFetch.mockResolvedValueOnce([] as never);
    await fetchArticles(source, { searchQuery: "hello" });
    const opts = mockFetch.mock.calls[0][1];
    expect(opts).toMatchObject({
      search: [
        { field: "title", value: "hello", mode: "i" },
        { field: "description", value: "hello", mode: "i" },
      ],
    });
  });

  it("passes filter.category when categorySlug is provided", async () => {
    mockFetch.mockResolvedValueOnce([] as never);
    await fetchArticles(source, { categorySlug: "tech" });
    const opts = mockFetch.mock.calls[0][1];
    expect(opts).toMatchObject({ filter: { category: "tech" } });
  });

  it("passes limit: 0 through (explicit-undefined check)", async () => {
    mockFetch.mockResolvedValueOnce([] as never);
    await fetchArticles(source, { limit: 0 });
    const opts = mockFetch.mock.calls[0][1];
    expect(opts).toMatchObject({ limit: 0 });
  });

  it("does not include limit key when limit is not provided", async () => {
    mockFetch.mockResolvedValueOnce([] as never);
    await fetchArticles(source);
    const opts = mockFetch.mock.calls[0][1];
    expect(opts).not.toHaveProperty("limit");
  });
});

describe("fetchArticle", () => {
  it("returns the entry on success", async () => {
    const post = { slug: "my-post", title: "My Post", content: "..." };
    mockFetch.mockResolvedValueOnce(post as never);
    const result = await fetchArticle(source, "my-post");
    expect(result).toEqual(post);
  });

  it("returns null when fetchCmsContent rejects (throws)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("not found") as never);
    const result = await fetchArticle(source, "missing");
    expect(result).toBeNull();
  });

  it("returns null when fetchCmsContent resolves undefined", async () => {
    mockFetch.mockResolvedValueOnce(undefined as never);
    const result = await fetchArticle(source, "missing");
    expect(result).toBeNull();
  });
});

describe("fetchRelatedArticles", () => {
  it("returns [] when the post has no category", async () => {
    const post = { slug: "a", title: "A" } as never;
    const result = await fetchRelatedArticles(source, post, "a");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns [] when source relatedLimit <= 0", async () => {
    const zeroSource = defineArticleSource({
      client: fakeClient,
      schemaSlug: "blog",
      listSelect: ["slug", "title"],
      detailSelect: ["slug", "title", "content"],
      seo: fakeSeo,
      relatedLimit: 0,
    });
    const post = { slug: "a", title: "A", category: { slug: "tech" } } as never;
    const result = await fetchRelatedArticles(zeroSource, post, "a");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("requests relatedLimit + 1, filters out current slug, and slices to relatedLimit", async () => {
    const limitedSource = defineArticleSource({
      client: fakeClient,
      schemaSlug: "blog",
      listSelect: ["slug", "title"],
      detailSelect: ["slug", "title", "content"],
      seo: fakeSeo,
      relatedLimit: 2,
    });
    const currentPost = { slug: "current", title: "Current", category: { slug: "tech" } } as never;
    // Return 3 items (relatedLimit + 1 = 3): includes current slug + 2 others
    const returned = [
      { slug: "current", title: "Current" },
      { slug: "other-1", title: "Other 1" },
      { slug: "other-2", title: "Other 2" },
    ];
    mockFetch.mockResolvedValueOnce(returned as never);

    const result = await fetchRelatedArticles(limitedSource, currentPost, "current");

    // Verify requested limit was relatedLimit + 1 = 3
    const opts = mockFetch.mock.calls[0][1];
    expect(opts).toMatchObject({ limit: 3, filter: { category: "tech" } });

    // Current slug filtered out, remaining sliced to relatedLimit (2)
    expect(result).toEqual([
      { slug: "other-1", title: "Other 1" },
      { slug: "other-2", title: "Other 2" },
    ]);
  });
});
