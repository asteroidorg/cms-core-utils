// src/components/articles/articles.state.test.ts
import { describe, expect, it } from "vitest";
import {
  applyPostFilters,
  buildArticlesViewState,
  defaultGroupPostsByCategory,
  splitFeaturedAndRest,
} from "./articles.state";
import type { AsteroidArticlePost } from "./articles.types";

const post = (over: Partial<AsteroidArticlePost> & { slug: string }): AsteroidArticlePost => ({
  title: over.slug,
  ...over,
});

const posts: AsteroidArticlePost[] = [
  post({ slug: "a", title: "Alpha", featured: true, category: { slug: "news", name: "News" } }),
  post({ slug: "b", title: "Beta", category: { slug: "news", name: "News" } }),
  post({ slug: "c", title: "Gamma", category: { slug: "docs", name: "Docs" } }),
];

describe("applyPostFilters", () => {
  it("filters by category slug", () => {
    expect(applyPostFilters(posts, { categorySlug: "news" }).map((p) => p.slug)).toEqual(["a", "b"]);
  });
  it("filters by article slug", () => {
    expect(applyPostFilters(posts, { articleSlug: "c" }).map((p) => p.slug)).toEqual(["c"]);
  });
});

describe("splitFeaturedAndRest", () => {
  it("pulls the featured post out of the rest", () => {
    const { featured, rest } = splitFeaturedAndRest(posts);
    expect(featured?.slug).toBe("a");
    expect(rest.map((p) => p.slug)).toEqual(["b", "c"]);
  });
});

describe("defaultGroupPostsByCategory", () => {
  it("groups by category slug", () => {
    const groups = defaultGroupPostsByCategory(posts);
    expect(groups.map((g) => g.categorySlug)).toEqual(["news", "docs"]);
    expect(groups[0].posts.map((p) => p.slug)).toEqual(["a", "b"]);
  });
});

describe("buildArticlesViewState", () => {
  it("groups non-featured posts when not searching", () => {
    const state = buildArticlesViewState(posts, {});
    expect(state.featured?.slug).toBe("a");
    expect(state.isSearching).toBe(false);
    expect(state.categoryGroups.flatMap((g) => g.posts.map((p) => p.slug))).toEqual(["b", "c"]);
  });
  it("returns a single search-results group when searching", () => {
    const state = buildArticlesViewState(posts, { searchQuery: "term" });
    expect(state.isSearching).toBe(true);
    expect(state.categoryGroups).toHaveLength(1);
    expect(state.categoryGroups[0].categorySlug).toBe("search-results");
    expect(state.categoryGroups[0].posts).toHaveLength(3);
  });
  it("marks empty when no posts", () => {
    expect(buildArticlesViewState([], {}).isEmpty).toBe(true);
  });
});
