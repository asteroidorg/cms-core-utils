// src/server/articleMetadata.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { seoValuesToMetadata } from "./articleMetadata";

vi.mock("../fetchCmsContent", () => ({ fetchCmsContent: vi.fn() }));
import { fetchCmsContent } from "../fetchCmsContent";
const mockFetch = vi.mocked(fetchCmsContent);

import { defineArticleSource } from "./defineArticleSource";
import {
  generateListingMetadata,
  generateArticleMetadata,
} from "./articleMetadata";

const source = defineArticleSource({
  client: { getClient: () => ({}) as never, cmsUrl: "https://cms.example.com" },
  schemaSlug: "blog",
  listSelect: ["slug", "title"],
  detailSelect: ["slug", "title"],
  seo: {
    siteName: "Acme",
    baseUrl: "https://acme.example",
    articlePath: "/blog",
  } as never,
});

describe("generateListingMetadata", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns Metadata with openGraph.type === 'website' and non-empty title/canonical", async () => {
    const meta = await generateListingMetadata(source);
    expect((meta.openGraph as { type?: string })?.type).toBe("website");
    expect(typeof meta.title).toBe("string");
    expect((meta.title as string).length).toBeGreaterThan(0);
    expect(meta.alternates?.canonical).toBeTruthy();
  });
});

describe("generateArticleMetadata", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns article metadata (openGraph.type === 'article') when article is found, slug as string", async () => {
    mockFetch.mockResolvedValue({ slug: "x", title: "Hello" } as never);
    const meta = await generateArticleMetadata(source, "x");
    expect((meta.openGraph as { type?: string })?.type).toBe("article");
    expect(meta.title as string).toContain("Hello");
  });

  it("falls back to listing metadata (openGraph.type === 'website') when fetchArticle returns null", async () => {
    mockFetch.mockResolvedValue(null as never);
    const meta = await generateArticleMetadata(source, "missing-slug");
    expect((meta.openGraph as { type?: string })?.type).toBe("website");
  });

  it("accepts slug as Promise<{ slug }> and resolves to article metadata", async () => {
    mockFetch.mockResolvedValue({ slug: "x", title: "Hello" } as never);
    const meta = await generateArticleMetadata(source, Promise.resolve({ slug: "x" }));
    expect((meta.openGraph as { type?: string })?.type).toBe("article");
    expect(meta.title as string).toContain("Hello");
  });
});

describe("seoValuesToMetadata", () => {
  it("maps seo values to Next Metadata with the given og type", () => {
    const meta = seoValuesToMetadata(
      {
        title: "T",
        siteName: "S",
        twitter: "@s",
        description: "D",
        url: "https://x/y",
        keywords: "k",
        image: "https://x/img.png",
      },
      "article",
    );
    expect(meta.title).toBe("T");
    expect(meta.alternates?.canonical).toBe("https://x/y");
    expect((meta.openGraph as { type?: string })?.type).toBe("article");
    expect(meta.robots).toEqual({ index: true, follow: true });
  });
  it("sets noindex robots when flagged", () => {
    const meta = seoValuesToMetadata(
      { title: "T", siteName: "S", twitter: "", description: "D", url: "u", keywords: "k", noindex: true },
      "website",
    );
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});
