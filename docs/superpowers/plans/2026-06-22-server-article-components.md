# Server Article Components & Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-rendered, source-driven article listing and article-page components to `@asteroidcms/core-utils` so the CMS API key never reaches the browser, search runs server-side via URL params, and the same render props work in both server and client components.

**Architecture:** Extract today's client-only article logic into runtime-agnostic modules (pure state builders + pure view renderers, no `"use client"`). Thin client wrappers keep current behavior; new `async` server components fetch from a `defineArticleSource` descriptor backed by a server-only `createCmsServerClient`. A new `@asteroidcms/core-utils/server` entry (guarded with `import "server-only"`) exposes the server surface; a `"use client"` `ArticleSearchBox` island drives URL-`searchParams` search.

**Tech Stack:** TypeScript, React 18, `@apollo/client` v4, GraphQL, Next.js (optional peer), tsup (build), vitest (new — unit tests for pure logic), `react-dom/server` (render smoke tests).

## Global Constraints

- Package name: `@asteroidcms/core-utils`. Pre-1.0; breaking changes allowed with CHANGELOG + version bump.
- Peer deps (do not add as hard deps): `@apollo/client ^4`, `graphql ^16`, `react >=18`, `react-dom >=18`, `next >=14` (optional).
- The server entry MUST begin with `import "server-only";` and MUST NOT carry a top-level `"use client"` banner.
- The CMS key is server-only: server config reads a non-`NEXT_PUBLIC` env var. Never document `NEXT_PUBLIC_*` for the key in new docs.
- Render-prop param objects MUST include an injected `cmsImage: (idOrUrl?: string) => string`. Render props must not depend on `useCmsImage()`.
- Existing client exports from `@asteroidcms/core-utils/client` and server-safe exports from `@asteroidcms/core-utils` must keep resolving (paths may move internally).
- tsup strips module-level directives during treeshake; `"use client"` is restored by post-build prepend (see `tsup.config.ts`). Preserve that mechanism for any client bundle.
- Comments and copy stay ASCII (matches repo convention, see commit `63363c2`).

## File Structure

Created:
- `src/components/articles/articles.types.ts` — shared post/state/render-prop types + `ArticleImageResolver`.
- `src/components/articles/articles.state.ts` — pure: filters, featured split, category grouping, `buildArticlesViewState`.
- `src/components/articles/articles.view.tsx` — pure listing renderer (NO `"use client"`).
- `src/components/articles/article.view.tsx` — pure article-body renderer (NO `"use client"`).
- `src/components/articles/ArticleSearchBox.tsx` — `"use client"` debounced URL search island.
- `src/components/articles/AsteroidArticlesListing.tsx` — `"use client"` listing wrapper (moved + re-pointed).
- `src/components/articles/AsteroidArticlePage.tsx` — `"use client"` article wrapper (moved + re-pointed).
- `src/components/articles/AsteroidArticlesListingServer.tsx` — async server listing.
- `src/components/articles/AsteroidArticlePageServer.tsx` — async server article page.
- `src/server/cmsServerClient.ts` — `createCmsServerClient`.
- `src/server/defineArticleSource.ts` — `defineArticleSource` + fetch + search-filter helpers.
- `src/server/articleMetadata.ts` — `generateListingMetadata`, `generateArticleMetadata`.
- `src/server.ts` — `/server` entry (re-exports; `import "server-only"`).
- `vitest.config.ts` — test config.
- Test files colocated under `src/**` as `*.test.ts(x)`.

Modified:
- `src/utils/cmsImage.ts` — add `createImageResolver`.
- `src/client.ts` — re-point article component paths; export `ArticleSearchBox`.
- `src/components/AsteroidArticlesListing.tsx`, `src/components/AsteroidArticlePage.tsx` — deleted after move (re-pointed in `/client`).
- `package.json` — `./server` export, vitest devDep, `test` script.
- `tsup.config.ts` — `server` entry.
- `docs/web-sdk-react/04-nextjs-server-rendering.md`, `docs/web-sdk-react/12-seo-and-page-components.md`, new server guide, `README.md`, `CHANGELOG.md`.

---

### Task 1: vitest setup + shared article state module

**Files:**
- Create: `vitest.config.ts`
- Create: `src/components/articles/articles.types.ts`
- Create: `src/components/articles/articles.state.ts`
- Test: `src/components/articles/articles.state.test.ts`
- Modify: `package.json` (add `vitest` devDep + `test` script)

**Interfaces:**
- Consumes: existing types from `src/components/AsteroidArticlesListing.tsx` (moving them here).
- Produces:
  - `interface AsteroidArticlePost { slug: string; title: string; description?: string; featured_image?: string; featured?: boolean; published_date?: string | null; category?: { slug: string; name: string; description?: string } }`
  - `interface AsteroidArticleCategoryGroup<TPost> { categoryName: string; categorySlug: string; posts: TPost[] }`
  - `type ArticleImageResolver = (idOrUrl?: string) => string`
  - `interface ArticlesViewState<TPost> { posts: TPost[]; featured: TPost | null; rest: TPost[]; categoryGroups: AsteroidArticleCategoryGroup<TPost>[]; isEmpty: boolean; isSearching: boolean; searchQuery: string }`
  - `function defaultGetCategoryName(post): string | undefined`
  - `function defaultGroupPostsByCategory<TPost>(posts): AsteroidArticleCategoryGroup<TPost>[]`
  - `function applyPostFilters<TPost>(posts, { categorySlug?, articleSlug? }): TPost[]`
  - `function splitFeaturedAndRest<TPost>(posts): { featured: TPost | null; rest: TPost[] }`
  - `function buildArticlesViewState<TPost>(posts, opts: { categorySlug?: string; articleSlug?: string; searchQuery?: string; groupPostsByCategory?: (posts: TPost[]) => AsteroidArticleCategoryGroup<TPost>[] }): ArticlesViewState<TPost>`

- [ ] **Step 1: Add vitest and test script**

Edit `package.json` — add to `devDependencies`: `"vitest": "^2.1.0"`. Add to `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Install**

Run: `npm install`
Expected: vitest added, no peer errors.

- [ ] **Step 3: Create vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: Write the failing test**

```ts
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
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- src/components/articles/articles.state.test.ts`
Expected: FAIL — cannot resolve `./articles.state` / `./articles.types`.

- [ ] **Step 6: Create the types module**

```ts
// src/components/articles/articles.types.ts
import type { ReactNode } from "react";

/** Resolves a CMS asset id (or passthrough URL) to an absolute media URL. */
export type ArticleImageResolver = (idOrUrl?: string) => string;

/** Minimal article post shape shared across Asteroid CMS apps. */
export interface AsteroidArticlePost {
  slug: string;
  title: string;
  description?: string;
  featured_image?: string;
  featured?: boolean;
  published_date?: string | null;
  category?: {
    slug: string;
    name: string;
    description?: string;
  };
}

export interface AsteroidArticleCategoryGroup<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  categoryName: string;
  categorySlug: string;
  posts: TPost[];
}

/** Runtime-agnostic computed state shared by client + server listing. */
export interface ArticlesViewState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  featured: TPost | null;
  rest: TPost[];
  categoryGroups: AsteroidArticleCategoryGroup<TPost>[];
  isEmpty: boolean;
  isSearching: boolean;
  /** The effective (already-debounced, for client) search query. */
  searchQuery: string;
}

export type AsteroidArticlesEmptyReason = "error" | "no-posts" | "no-results";

// Render-prop param shapes (each carries the injected cmsImage resolver).
export interface AsteroidArticlesSearchParams {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: { preventDefault: () => void }) => void;
}

export interface AsteroidArticlesHeaderParams {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  search: ReactNode;
}

export interface AsteroidArticlesFeaturedCardParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  post: TPost;
  cmsImage: ArticleImageResolver;
}

export interface AsteroidArticlesPostCardParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  post: TPost;
  index: number;
  group: AsteroidArticleCategoryGroup<TPost>;
  cmsImage: ArticleImageResolver;
}

export interface AsteroidArticlesPostGridParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  group: AsteroidArticleCategoryGroup<TPost>;
  children: ReactNode;
}

export interface AsteroidArticlesCategoryHeadingParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  group: AsteroidArticleCategoryGroup<TPost>;
}

export interface AsteroidArticlesCategoryGroupParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  group: AsteroidArticleCategoryGroup<TPost>;
  defaultContent: ReactNode;
}

export interface AsteroidArticlesEmptyParams {
  reason: AsteroidArticlesEmptyReason;
  searchQuery?: string;
  error?: unknown;
}

export interface AsteroidArticlesContentParams {
  featured: ReactNode;
  groups: ReactNode;
  noSearchResults: ReactNode;
}
```

- [ ] **Step 7: Create the state module**

```ts
// src/components/articles/articles.state.ts
import type {
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  ArticlesViewState,
} from "./articles.types";

export function defaultGetCategoryName(
  post: Pick<AsteroidArticlePost, "category">,
): string | undefined {
  return post.category?.name?.trim() || undefined;
}

export function defaultGroupPostsByCategory<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(posts: TPost[]): AsteroidArticleCategoryGroup<TPost>[] {
  const groups = new Map<string, AsteroidArticleCategoryGroup<TPost>>();

  for (const post of posts) {
    const categoryName = defaultGetCategoryName(post) || "Other";
    const categorySlug = post.category?.slug || "other";
    const existing = groups.get(categorySlug);

    if (existing) {
      existing.posts.push(post);
    } else {
      groups.set(categorySlug, { categoryName, categorySlug, posts: [post] });
    }
  }

  return Array.from(groups.values());
}

export function applyPostFilters<TPost extends AsteroidArticlePost>(
  posts: TPost[],
  { categorySlug, articleSlug }: { categorySlug?: string; articleSlug?: string },
): TPost[] {
  let filtered = posts;
  if (categorySlug) {
    filtered = filtered.filter((post) => post.category?.slug === categorySlug);
  }
  if (articleSlug) {
    filtered = filtered.filter((post) => post.slug === articleSlug);
  }
  return filtered;
}

export function splitFeaturedAndRest<TPost extends AsteroidArticlePost>(
  posts: TPost[],
): { featured: TPost | null; rest: TPost[] } {
  const featured = posts.find((post) => post.featured) ?? null;
  const rest = featured
    ? posts.filter((post) => post.slug !== featured.slug)
    : [...posts];
  return { featured, rest };
}

export interface BuildArticlesViewStateOptions<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  categorySlug?: string;
  articleSlug?: string;
  searchQuery?: string;
  groupPostsByCategory?: (posts: TPost[]) => AsteroidArticleCategoryGroup<TPost>[];
}

export function buildArticlesViewState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(
  rawPosts: TPost[],
  options: BuildArticlesViewStateOptions<TPost>,
): ArticlesViewState<TPost> {
  const {
    categorySlug,
    articleSlug,
    searchQuery = "",
    groupPostsByCategory = defaultGroupPostsByCategory,
  } = options;

  const posts = applyPostFilters(rawPosts, { categorySlug, articleSlug });
  const { featured, rest } = splitFeaturedAndRest(posts);
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  const categoryGroups = isSearching
    ? posts.length === 0
      ? []
      : [
          {
            categoryName: `Search results for "${trimmedQuery}"`,
            categorySlug: "search-results",
            posts,
          },
        ]
    : groupPostsByCategory(rest);

  return {
    posts,
    featured,
    rest,
    categoryGroups,
    isEmpty: !featured && rest.length === 0,
    isSearching,
    searchQuery: trimmedQuery,
  };
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- src/components/articles/articles.state.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/components/articles/articles.types.ts src/components/articles/articles.state.ts src/components/articles/articles.state.test.ts
git commit -m "feat(articles): extract runtime-agnostic article state + types, add vitest"
```

---

### Task 2: Image resolver helper

**Files:**
- Modify: `src/utils/cmsImage.ts`
- Test: `src/utils/cmsImage.test.ts`

**Interfaces:**
- Consumes: existing `cmsImage(id, { cmsUrl, mediaPath })`.
- Produces: `function createImageResolver(opts: { cmsUrl?: string; mediaPath?: string }): (idOrUrl?: string) => string` — returns a resolver that passes absolute `http(s)://` URLs through unchanged, returns `""` for empty input, and otherwise builds a canonical media URL. With no `cmsUrl`, returns `""` for non-absolute ids.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/cmsImage.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/cmsImage.test.ts`
Expected: FAIL — `createImageResolver` is not exported.

- [ ] **Step 3: Implement `createImageResolver`**

Append to `src/utils/cmsImage.ts`:

```ts
/**
 * Build a runtime-agnostic image resolver. Passes absolute http(s) URLs
 * through unchanged; otherwise resolves a CMS asset id to a canonical media
 * URL. Returns "" when input is empty or no `cmsUrl` is configured.
 */
export function createImageResolver(options: {
  cmsUrl?: string;
  mediaPath?: string;
}): (idOrUrl?: string) => string {
  return (idOrUrl?: string) => {
    if (!idOrUrl) return "";
    if (/^https?:\/\//i.test(idOrUrl)) return idOrUrl;
    if (!options.cmsUrl) return "";
    return cmsImage(idOrUrl, { cmsUrl: options.cmsUrl, mediaPath: options.mediaPath });
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/cmsImage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/cmsImage.ts src/utils/cmsImage.test.ts
git commit -m "feat(utils): add createImageResolver (runtime-agnostic image resolver)"
```

---

### Task 3: Shared listing view renderer

**Files:**
- Create: `src/components/articles/articles.view.tsx`
- Test: `src/components/articles/articles.view.test.tsx`

**Interfaces:**
- Consumes: types from `articles.types.ts`, `ArticlesViewState`.
- Produces:
  - `interface ArticlesListingRenderProps<TPost>` — the shared render-prop set: `renderRoot?`, `renderHeader?`, `renderSearch?`, `renderFeaturedCard?`, `renderPostCard` (required), `renderCategoryHeading?`, `renderPostGrid?`, `renderCategoryGroup?`, `renderSkeleton?`, `renderEmpty?`, `renderContent?`, plus static `eyebrow?`, `title?`, `description?`. Each card/grid render prop receives params that include `cmsImage`.
  - `function renderArticlesListingBody<TPost>(args: { state: ArticlesViewState<TPost>; loading: boolean; hasError: boolean; error: unknown; cmsImage: ArticleImageResolver; searchNode: ReactNode; seoNode: ReactNode; jsonLdNode: ReactNode; renderProps: ArticlesListingRenderProps<TPost> }): ReactNode`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/articles/articles.view.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderArticlesListingBody } from "./articles.view";
import { buildArticlesViewState } from "./articles.state";
import type { AsteroidArticlePost } from "./articles.types";

const posts: AsteroidArticlePost[] = [
  { slug: "a", title: "Alpha", featured: true, category: { slug: "news", name: "News" } },
  { slug: "b", title: "Beta", category: { slug: "news", name: "News" } },
];

function render(loading = false, hasError = false) {
  const state = buildArticlesViewState(posts, {});
  return renderToStaticMarkup(
    <>{renderArticlesListingBody({
      state,
      loading,
      hasError,
      error: undefined,
      cmsImage: (x) => x ?? "",
      searchNode: null,
      seoNode: null,
      jsonLdNode: null,
      renderProps: {
        renderPostCard: ({ post }) => <article>{post.title}</article>,
        renderFeaturedCard: ({ post }) => <h2>{post.title}</h2>,
        renderSkeleton: () => <div data-testid="skeleton" />,
      },
    })}</>,
  );
}

describe("renderArticlesListingBody", () => {
  it("renders featured + post cards when loaded", () => {
    const html = render();
    expect(html).toContain("<h2>Alpha</h2>");
    expect(html).toContain("<article>Beta</article>");
  });
  it("renders the skeleton while loading", () => {
    expect(render(true)).toContain("data-testid=\"skeleton\"");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/articles/articles.view.test.tsx`
Expected: FAIL — cannot resolve `./articles.view`.

- [ ] **Step 3: Implement the view renderer**

```tsx
// src/components/articles/articles.view.tsx
import { Fragment, type ReactNode } from "react";
import type {
  ArticleImageResolver,
  ArticlesViewState,
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  AsteroidArticlesCategoryGroupParams,
  AsteroidArticlesCategoryHeadingParams,
  AsteroidArticlesContentParams,
  AsteroidArticlesEmptyParams,
  AsteroidArticlesFeaturedCardParams,
  AsteroidArticlesHeaderParams,
  AsteroidArticlesPostCardParams,
  AsteroidArticlesPostGridParams,
} from "./articles.types";

export interface ArticlesListingRenderProps<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  renderRoot?: (params: { children: ReactNode }) => ReactNode;
  renderHeader?: (params: AsteroidArticlesHeaderParams) => ReactNode;
  renderFeaturedCard?: (params: AsteroidArticlesFeaturedCardParams<TPost>) => ReactNode;
  renderPostCard: (params: AsteroidArticlesPostCardParams<TPost>) => ReactNode;
  renderCategoryHeading?: (params: AsteroidArticlesCategoryHeadingParams<TPost>) => ReactNode;
  renderPostGrid?: (params: AsteroidArticlesPostGridParams<TPost>) => ReactNode;
  renderCategoryGroup?: (params: AsteroidArticlesCategoryGroupParams<TPost>) => ReactNode;
  renderSkeleton?: () => ReactNode;
  renderEmpty?: (params: AsteroidArticlesEmptyParams) => ReactNode;
  renderContent?: (params: AsteroidArticlesContentParams) => ReactNode;
}

export interface RenderArticlesListingArgs<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  state: ArticlesViewState<TPost>;
  loading: boolean;
  hasError: boolean;
  error: unknown;
  cmsImage: ArticleImageResolver;
  searchNode: ReactNode;
  seoNode: ReactNode;
  jsonLdNode: ReactNode;
  renderProps: ArticlesListingRenderProps<TPost>;
}

export function renderArticlesListingBody<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(args: RenderArticlesListingArgs<TPost>): ReactNode {
  const { state, loading, hasError, error, cmsImage, searchNode, seoNode, jsonLdNode, renderProps } = args;
  const {
    eyebrow,
    title,
    description,
    renderRoot,
    renderHeader,
    renderFeaturedCard,
    renderPostCard,
    renderCategoryHeading,
    renderPostGrid,
    renderCategoryGroup,
    renderSkeleton,
    renderEmpty,
    renderContent,
  } = renderProps;

  const headerNode = renderHeader
    ? renderHeader({ eyebrow, title, description, search: searchNode })
    : (
        <>
          {eyebrow}
          {title}
          {description}
          {searchNode}
        </>
      );

  const featuredNode =
    state.featured && !state.isSearching && renderFeaturedCard
      ? renderFeaturedCard({ post: state.featured, cmsImage })
      : null;

  const noSearchResultsNode =
    state.isSearching && !loading && state.posts.length === 0
      ? renderEmpty?.({ reason: "no-results", searchQuery: state.searchQuery }) ?? null
      : null;

  const groupsNode = noSearchResultsNode
    ? null
    : state.categoryGroups.map((group: AsteroidArticleCategoryGroup<TPost>) => {
        const postCards = group.posts.map((post, index) => (
          <Fragment key={post.slug ?? index}>
            {renderPostCard({ post, index, group, cmsImage })}
          </Fragment>
        ));

        const gridNode = renderPostGrid
          ? renderPostGrid({ posts: group.posts, group, children: postCards })
          : <>{postCards}</>;

        const headingNode = renderCategoryHeading
          ? renderCategoryHeading({ group })
          : group.categoryName;

        const defaultContent = (
          <>
            {headingNode}
            {gridNode}
          </>
        );

        return (
          <Fragment key={group.categorySlug}>
            {renderCategoryGroup ? renderCategoryGroup({ group, defaultContent }) : defaultContent}
          </Fragment>
        );
      });

  const contentNode =
    !loading && !hasError && (state.featured || state.rest.length > 0)
      ? renderContent
        ? renderContent({ featured: featuredNode, groups: groupsNode, noSearchResults: noSearchResultsNode })
        : (
            <>
              {featuredNode}
              {noSearchResultsNode}
              {groupsNode}
            </>
          )
      : null;

  const body = (
    <>
      {seoNode}
      {jsonLdNode}
      {headerNode}
      {loading ? renderSkeleton?.() : null}
      {!loading && (hasError || state.isEmpty)
        ? renderEmpty?.({
            reason: hasError ? "error" : "no-posts",
            searchQuery: state.searchQuery,
            error,
          })
        : null}
      {contentNode}
    </>
  );

  return renderRoot ? renderRoot({ children: body }) : <>{body}</>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/articles/articles.view.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/articles/articles.view.tsx src/components/articles/articles.view.test.tsx
git commit -m "feat(articles): add shared listing view renderer with injected cmsImage"
```

---

### Task 4: Shared article-body view renderer

**Files:**
- Create: `src/components/articles/article.view.tsx`
- Test: `src/components/articles/article.view.test.tsx`

**Interfaces:**
- Consumes: `ArticleImageResolver`.
- Produces:
  - `interface AsteroidArticlePagePost { slug: string; title: string; description?: string; content?: string; featured_image?: string; tags?: string; published_date?: string | null; category?: { slug: string; name: string }; author?: { name: string; bio?: string } }`
  - `interface ArticleBodyRenderProps<TPost>` — `backLink?`, `renderHeader?`, `renderMeta?`, `renderDescription?`, `renderFeaturedImage?`, `renderToc?`, `renderContent?`, `renderPreArticle?`, `renderMidArticle?`, `renderPostArticle?`, `renderTags?`, `renderAuthorDetails?`, `renderRelatedPosts?`, `renderCTA?`. Each `render*` receives `{ post, cmsImage }`; `renderRelatedPosts` additionally receives `relatedPosts`.
  - `function renderArticleBody<TPost>(args: { post: TPost; cmsImage: ArticleImageResolver; relatedPosts: TPost[]; seoNode: ReactNode; jsonLdNode: ReactNode; renderProps: ArticleBodyRenderProps<TPost> }): ReactNode`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/articles/article.view.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderArticleBody } from "./article.view";
import type { AsteroidArticlePagePost } from "./article.view";

const post: AsteroidArticlePagePost = { slug: "a", title: "Alpha", content: "<p>Body</p>" };

describe("renderArticleBody", () => {
  it("renders slots in order and passes relatedPosts", () => {
    const html = renderToStaticMarkup(
      <>{renderArticleBody({
        post,
        cmsImage: (x) => x ?? "",
        relatedPosts: [{ slug: "b", title: "Beta" }],
        seoNode: null,
        jsonLdNode: null,
        renderProps: {
          renderHeader: ({ post }) => <h1>{post.title}</h1>,
          renderContent: ({ post }) => <div dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />,
          renderRelatedPosts: ({ relatedPosts }) => <aside>{relatedPosts.map((p) => p.title).join(",")}</aside>,
        },
      })}</>,
    );
    expect(html).toContain("<h1>Alpha</h1>");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("<aside>Beta</aside>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/articles/article.view.test.tsx`
Expected: FAIL — cannot resolve `./article.view`.

- [ ] **Step 3: Implement the article-body renderer**

```tsx
// src/components/articles/article.view.tsx
import type { ReactNode } from "react";
import type { ArticleImageResolver } from "./articles.types";

export interface AsteroidArticlePagePost {
  slug: string;
  title: string;
  description?: string;
  content?: string;
  featured_image?: string;
  tags?: string;
  published_date?: string | null;
  category?: { slug: string; name: string };
  author?: { name: string; bio?: string };
}

type Slot<TPost> = (params: { post: TPost; cmsImage: ArticleImageResolver }) => ReactNode;

export interface ArticleBodyRenderProps<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  backLink?: ReactNode;
  renderHeader?: Slot<TPost>;
  renderMeta?: Slot<TPost>;
  renderDescription?: Slot<TPost>;
  renderFeaturedImage?: Slot<TPost>;
  renderToc?: Slot<TPost>;
  renderContent?: Slot<TPost>;
  renderPreArticle?: Slot<TPost>;
  renderMidArticle?: Slot<TPost>;
  renderPostArticle?: Slot<TPost>;
  renderTags?: Slot<TPost>;
  renderAuthorDetails?: Slot<TPost>;
  renderRelatedPosts?: (params: {
    post: TPost;
    relatedPosts: TPost[];
    cmsImage: ArticleImageResolver;
  }) => ReactNode;
  renderCTA?: Slot<TPost>;
}

export interface RenderArticleBodyArgs<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  post: TPost;
  cmsImage: ArticleImageResolver;
  relatedPosts: TPost[];
  seoNode: ReactNode;
  jsonLdNode: ReactNode;
  renderProps: ArticleBodyRenderProps<TPost>;
}

export function renderArticleBody<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(args: RenderArticleBodyArgs<TPost>): ReactNode {
  const { post, cmsImage, relatedPosts, seoNode, jsonLdNode, renderProps: r } = args;
  const slot = { post, cmsImage };

  return (
    <>
      {seoNode}
      {jsonLdNode}
      {r.backLink}
      {r.renderPreArticle?.(slot)}
      {r.renderHeader?.(slot)}
      {r.renderMeta?.(slot)}
      {r.renderDescription?.(slot)}
      {r.renderFeaturedImage?.(slot)}
      {r.renderToc?.(slot)}
      {r.renderContent?.(slot)}
      {r.renderMidArticle?.(slot)}
      {r.renderTags?.(slot)}
      {r.renderAuthorDetails?.(slot)}
      {r.renderRelatedPosts?.({ post, relatedPosts, cmsImage })}
      {r.renderCTA?.(slot)}
      {r.renderPostArticle?.(slot)}
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/articles/article.view.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/articles/article.view.tsx src/components/articles/article.view.test.tsx
git commit -m "feat(articles): add shared article-body renderer with relatedPosts + cmsImage"
```

---

### Task 5: Re-point client `AsteroidArticlesListing` at the shared core

**Files:**
- Create: `src/components/articles/AsteroidArticlesListing.tsx`
- Delete: `src/components/AsteroidArticlesListing.tsx`
- Modify: `src/client.ts`
- Test: extend `src/components/articles/articles.view.test.tsx` is not enough — gate by typecheck + build.

**Interfaces:**
- Consumes: `buildArticlesViewState`, `renderArticlesListingBody`, `ArticlesListingRenderProps`, `useCmsImage`, `createImageResolver`, `useAsteroidCMSConfig`, SEO builders, `Seo`, `JsonLd`.
- Produces:
  - `type AsteroidArticlesUsePostsResult<TPost> = { posts: TPost[]; featured?: TPost | null; rest?: TPost[]; loading: boolean; error?: unknown }`
  - `type AsteroidArticlesUsePosts<TPost> = (searchQuery: string) => AsteroidArticlesUsePostsResult<TPost>`
  - `interface AsteroidArticlesProps<TPost> extends ArticlesListingRenderProps<TPost> { usePosts; categorySlug?; articleSlug?; searchDebounceMs?; seo?; noindex?; renderSearch?; renderJsonLd?; groupPostsByCategory?; children? }`
  - `function AsteroidArticlesListing<TPost>(props): JSX.Element`
  - `function useAsteroidArticlesState<TPost>(...)` (kept; adds loading/error/setSearchQuery on top of `buildArticlesViewState`)

- [ ] **Step 1: Create the re-pointed client listing**

```tsx
// src/components/articles/AsteroidArticlesListing.tsx
"use client";

import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildArticleListingSeoValues,
  seoValuesToClientProps,
} from "../../seo/seo.builders";
import type { AsteroidSeoConfig } from "../../seo/seo.config";
import { JsonLd, Seo } from "../../seo/Seo";
import { buildCollectionJsonLd } from "../../seo/jsonld";
import { AsteroidCMSContext } from "../../provider/context";
import { useCmsImage } from "../../utils/cmsImage";
import { buildArticlesViewState } from "./articles.state";
import { renderArticlesListingBody, type ArticlesListingRenderProps } from "./articles.view";
import type {
  ArticlesViewState,
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  AsteroidArticlesSearchParams,
} from "./articles.types";

export type {
  AsteroidArticlePost,
  AsteroidArticleCategoryGroup,
} from "./articles.types";

export interface AsteroidArticlesUsePostsResult<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  featured?: TPost | null;
  rest?: TPost[];
  loading: boolean;
  error?: unknown;
}

export type AsteroidArticlesUsePosts<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> = (searchQuery: string) => AsteroidArticlesUsePostsResult<TPost>;

export interface AsteroidArticlesState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> extends ArticlesViewState<TPost> {
  loading: boolean;
  error: unknown;
  hasError: boolean;
  debouncedSearchQuery: string;
  setSearchQuery: (value: string) => void;
}

export interface AsteroidArticlesProps<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> extends ArticlesListingRenderProps<TPost> {
  usePosts: AsteroidArticlesUsePosts<TPost>;
  categorySlug?: string;
  articleSlug?: string;
  searchDebounceMs?: number;
  seo?: AsteroidSeoConfig;
  noindex?: boolean;
  renderSearch?: (params: AsteroidArticlesSearchParams) => ReactNode;
  renderJsonLd?: (state: AsteroidArticlesState<TPost>) => ReactNode;
  groupPostsByCategory?: (posts: TPost[]) => AsteroidArticleCategoryGroup<TPost>[];
  children?: (state: AsteroidArticlesState<TPost>) => ReactNode;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useAsteroidArticlesState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(props: Pick<
  AsteroidArticlesProps<TPost>,
  "usePosts" | "categorySlug" | "articleSlug" | "searchDebounceMs" | "groupPostsByCategory"
>): AsteroidArticlesState<TPost> {
  const { usePosts, categorySlug, articleSlug, searchDebounceMs = 800, groupPostsByCategory } = props;
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, searchDebounceMs);
  const { posts: rawPosts, loading, error } = usePosts(debouncedSearchQuery);

  const view = useMemo(
    () =>
      buildArticlesViewState(rawPosts, {
        categorySlug,
        articleSlug,
        searchQuery: debouncedSearchQuery,
        groupPostsByCategory,
      }),
    [rawPosts, categorySlug, articleSlug, debouncedSearchQuery, groupPostsByCategory],
  );

  return {
    ...view,
    loading,
    error,
    hasError: Boolean(error),
    debouncedSearchQuery: view.searchQuery,
    setSearchQuery,
  };
}

export function AsteroidArticlesListing<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(props: AsteroidArticlesProps<TPost>) {
  const { seo, categorySlug, noindex, renderSearch, renderJsonLd, children, ...renderProps } = props;
  const state = useAsteroidArticlesState(props);
  const cmsConfig = useContext(AsteroidCMSContext);
  const cmsImage = useCmsImage();

  if (children) return <>{children(state)}</>;

  const categoryName = categorySlug ? state.posts[0]?.category?.name?.trim() : undefined;

  const seoNode = seo ? (
    <Seo
      {...seoValuesToClientProps(
        buildArticleListingSeoValues(seo, { categoryName, categorySlug, noindex }),
      )}
    />
  ) : null;

  const jsonLdNode = seo
    ? renderJsonLd?.(state) ?? (
        <JsonLd
          data={buildCollectionJsonLd({
            name: categoryName || `${seo.siteName} ${seo.contentLabel ?? "Articles"}`,
            description: seo.defaultDescription || "",
            url: `${(seo.baseUrl || "").replace(/\/$/, "")}${seo.articlePath ?? "/blog"}${
              categorySlug ? `/category/${categorySlug}` : ""
            }`,
            siteUrl: (seo.baseUrl || "").replace(/\/$/, ""),
          })}
        />
      )
    : null;

  const searchNode = renderSearch
    ? renderSearch({
        value: state.searchQuery,
        onChange: state.setSearchQuery,
        onSubmit: (event) => event.preventDefault(),
      })
    : null;

  return (
    <>
      {renderArticlesListingBody({
        state,
        loading: state.loading,
        hasError: state.hasError,
        error: state.error,
        cmsImage,
        searchNode,
        seoNode,
        jsonLdNode,
        renderProps: renderProps as ArticlesListingRenderProps<TPost>,
      })}
    </>
  );
}
```

Note: `state.searchQuery` is the debounced/effective query; the client search input keeps its own raw value in the consumer's `renderSearch`. To preserve the previous behavior where the input shows the raw typed value, the consumer reads `value` from `renderSearch` params, which here is the effective query. If raw-input echo is required, keep the raw value local in the consumer. (This matches the existing brass `renderSearch` which is controlled by these params.)

- [ ] **Step 2: Delete the old client listing file**

Run: `git rm src/components/AsteroidArticlesListing.tsx`

- [ ] **Step 3: Re-point `/client` exports**

In `src/client.ts`, replace the `AsteroidArticlesListing` export block with:

```ts
export {
  AsteroidArticlesListing,
  useAsteroidArticlesState,
} from "./components/articles/AsteroidArticlesListing";
export type {
  AsteroidArticlesProps,
  AsteroidArticlesState,
  AsteroidArticlesUsePosts,
  AsteroidArticlesUsePostsResult,
} from "./components/articles/AsteroidArticlesListing";

export {
  defaultGroupPostsByCategory,
  defaultGetCategoryName,
} from "./components/articles/articles.state";
export type {
  AsteroidArticlePost,
  AsteroidArticleCategoryGroup,
} from "./components/articles/articles.types";
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If the old `src/components/AsteroidArticlePage.tsx` still imports moved types, it will be fixed in Task 6; until then it imports its own local types, so typecheck should pass. If it errors, proceed to Task 6 which moves it.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success; `dist/client.js` starts with `"use client";`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(articles): re-point client AsteroidArticlesListing at shared core"
```

---

### Task 6: Re-point client `AsteroidArticlePage` at the shared core

**Files:**
- Create: `src/components/articles/AsteroidArticlePage.tsx`
- Delete: `src/components/AsteroidArticlePage.tsx`
- Modify: `src/client.ts`

**Interfaces:**
- Consumes: `renderArticleBody`, `ArticleBodyRenderProps`, `AsteroidArticlePagePost`, `useCmsImage`, SEO builders, `Seo`, `JsonLd`, `buildArticleJsonLd`, `AsteroidCMSContext`.
- Produces:
  - `type AsteroidArticlePageUseArticleResult<TPost> = { data?: TPost | null; loading: boolean; error?: unknown }`
  - `type AsteroidArticlePageUseArticle<TPost> = (slug: string) => AsteroidArticlePageUseArticleResult<TPost>`
  - `interface AsteroidArticlePageProps<TPost> extends ArticleBodyRenderProps<TPost> { slug; useArticle; seo?; articleType?; noindex?; relatedPosts?; renderRoot?; renderSkeleton?; renderError?; renderJsonLd?; children? }`
  - `function AsteroidArticlePage<TPost>(props): JSX.Element`

- [ ] **Step 1: Create the re-pointed client article page**

```tsx
// src/components/articles/AsteroidArticlePage.tsx
"use client";

import { useContext, type ReactNode } from "react";
import { seoValuesToClientProps, buildArticleSeoValues } from "../../seo/seo.builders";
import type { AsteroidSeoConfig } from "../../seo/seo.config";
import { JsonLd, Seo } from "../../seo/Seo";
import { buildArticleJsonLd, type ArticleJsonLdType } from "../../seo/jsonld";
import { AsteroidCMSContext } from "../../provider/context";
import { useCmsImage } from "../../utils/cmsImage";
import {
  renderArticleBody,
  type ArticleBodyRenderProps,
  type AsteroidArticlePagePost,
} from "./article.view";

export type { AsteroidArticlePagePost } from "./article.view";

export type AsteroidArticlePageUseArticleResult<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> = { data?: TPost | null; loading: boolean; error?: unknown };

export type AsteroidArticlePageUseArticle<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> = (slug: string) => AsteroidArticlePageUseArticleResult<TPost>;

export interface AsteroidArticlePageProps<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> extends ArticleBodyRenderProps<TPost> {
  slug: string;
  useArticle: AsteroidArticlePageUseArticle<TPost>;
  seo?: AsteroidSeoConfig;
  articleType?: ArticleJsonLdType;
  noindex?: boolean;
  relatedPosts?: TPost[];
  renderRoot?: (params: { children: ReactNode }) => ReactNode;
  renderSkeleton?: () => ReactNode;
  renderError?: (params: { error?: unknown; reason: "error" | "not-found" }) => ReactNode;
  renderJsonLd?: (params: { post: TPost }) => ReactNode;
  children?: (state: AsteroidArticlePageUseArticleResult<TPost>) => ReactNode;
}

export function AsteroidArticlePage<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(props: AsteroidArticlePageProps<TPost>) {
  const {
    slug,
    useArticle,
    seo,
    articleType,
    noindex,
    relatedPosts = [],
    renderRoot,
    renderSkeleton,
    renderError,
    renderJsonLd,
    children,
    ...bodyRenderProps
  } = props;

  const { data: article, loading, error } = useArticle(slug);
  const cmsConfig = useContext(AsteroidCMSContext);
  const cmsImage = useCmsImage();
  const seoConfig = seo && !seo.cmsUrl && cmsConfig?.cmsUrl ? { ...seo, cmsUrl: cmsConfig.cmsUrl } : seo;

  if (children) return <>{children({ data: article, loading, error })}</>;

  if (loading) {
    const body = renderSkeleton?.() ?? null;
    return renderRoot ? <>{renderRoot({ children: body })}</> : <>{body}</>;
  }

  if (!article || error) {
    const body = renderError?.({ error, reason: error ? "error" : "not-found" }) ?? null;
    return renderRoot ? <>{renderRoot({ children: body })}</> : <>{body}</>;
  }

  const seoValues = seoConfig ? buildArticleSeoValues(article, seoConfig, slug, { noindex }) : null;
  const seoNode = seoValues ? <Seo {...seoValuesToClientProps(seoValues)} /> : null;
  const jsonLdNode = seoConfig
    ? renderJsonLd?.({ post: article }) ?? (
        <JsonLd
          data={buildArticleJsonLd({
            title: article.title,
            description: article.description || seoConfig.defaultDescription || "",
            url: `${(seoConfig.baseUrl || "").replace(/\/$/, "")}${seoConfig.articlePath ?? "/blog"}/${slug}`,
            siteName: seoConfig.siteName,
            siteUrl: (seoConfig.baseUrl || "").replace(/\/$/, ""),
            articleType,
            image: seoValues?.image,
            authorName: article.author?.name,
            publishedTime: article.published_date || undefined,
            tags: article.tags?.split(",").map((t) => t.trim()).filter(Boolean),
            category: article.category?.name,
          })}
        />
      )
    : null;

  const body = renderArticleBody({
    post: article,
    cmsImage,
    relatedPosts,
    seoNode,
    jsonLdNode,
    renderProps: bodyRenderProps as ArticleBodyRenderProps<TPost>,
  });

  return renderRoot ? <>{renderRoot({ children: body })}</> : <>{body}</>;
}
```

- [ ] **Step 2: Delete the old article page file**

Run: `git rm src/components/AsteroidArticlePage.tsx`

- [ ] **Step 3: Re-point `/client` exports**

In `src/client.ts`, replace the `AsteroidArticlePage` export block with:

```ts
export { AsteroidArticlePage } from "./components/articles/AsteroidArticlePage";
export type {
  AsteroidArticlePageProps,
  AsteroidArticlePagePost,
  AsteroidArticlePageUseArticle,
  AsteroidArticlePageUseArticleResult,
} from "./components/articles/AsteroidArticlePage";
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: no errors; `dist/client.js` starts with `"use client";`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(articles): re-point client AsteroidArticlePage at shared core"
```

---

### Task 7: `createCmsServerClient`

**Files:**
- Create: `src/server/cmsServerClient.ts`
- Test: `src/server/cmsServerClient.test.ts`

**Interfaces:**
- Consumes: `createApolloClient`, `resolveConfig` from `../apollo/createApolloClient`; React `cache`.
- Produces:
  - `interface CmsServerClientConfig { cmsUrl: string; apiKey: string; graphqlPath?: string; headers?: Record<string, string>; revalidate?: number; tags?: string[]; getClient?: () => ApolloClient }`
  - `interface CmsServerClient { getClient: () => ApolloClient; cmsUrl: string }`
  - `function createCmsServerClient(config: CmsServerClientConfig): CmsServerClient`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/cmsServerClient.test.ts
import { describe, expect, it, vi } from "vitest";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/cmsServerClient.test.ts`
Expected: FAIL — cannot resolve `./cmsServerClient`.

- [ ] **Step 3: Implement**

```ts
// src/server/cmsServerClient.ts
import type { ApolloClient } from "@apollo/client";
import { cache } from "react";
import { createApolloClient, resolveConfig } from "../apollo/createApolloClient";

export interface CmsServerClientConfig {
  cmsUrl: string;
  apiKey: string;
  graphqlPath?: string;
  headers?: Record<string, string>;
  /** Next.js ISR revalidate seconds, applied to the GraphQL fetch. */
  revalidate?: number;
  /** Next.js cache tags for on-demand revalidation. */
  tags?: string[];
  /** Escape hatch: provide a pre-built client (e.g. registerApolloClient). */
  getClient?: () => ApolloClient;
}

export interface CmsServerClient {
  getClient: () => ApolloClient;
  cmsUrl: string;
}

/**
 * Build a server-only CMS client for use with `fetchCmsContent` / `cmsMutate`.
 * The API key stays on the server. The client is memoized per-request via
 * React `cache()` for query deduplication.
 */
export function createCmsServerClient(config: CmsServerClientConfig): CmsServerClient {
  // resolveConfig validates cmsUrl + apiKey and normalizes the URL.
  const resolved = resolveConfig({
    cmsUrl: config.cmsUrl,
    apiKey: config.apiKey,
    graphqlPath: config.graphqlPath,
    headers: config.headers,
  });

  const next =
    config.revalidate !== undefined || config.tags !== undefined
      ? { revalidate: config.revalidate, tags: config.tags }
      : undefined;

  const factory =
    config.getClient ??
    (() =>
      createApolloClient({
        cmsUrl: resolved.cmsUrl,
        apiKey: resolved.apiKey,
        graphqlPath: resolved.graphqlPath,
        headers: resolved.headers,
        ...(next
          ? { apolloOptions: { defaultContext: { fetchOptions: { next } } } as never }
          : {}),
      }));

  return { getClient: cache(factory), cmsUrl: resolved.cmsUrl };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/server/cmsServerClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/cmsServerClient.ts src/server/cmsServerClient.test.ts
git commit -m "feat(server): add createCmsServerClient (server-only, memoized)"
```

---

### Task 8: `defineArticleSource` + fetch + search helpers

**Files:**
- Create: `src/server/defineArticleSource.ts`
- Test: `src/server/defineArticleSource.test.ts`

**Interfaces:**
- Consumes: `fetchCmsContent`, `UseCmsContentOptions`, `CmsSearchCondition`, `ContentStatus` from `../build-query`; `AsteroidSeoConfig`; `ArticleJsonLdType`; `CmsServerClient`; `AsteroidArticlePost`; `AsteroidArticlePagePost`.
- Produces:
  - `function buildSearchConditions(fields: string[], query?: string): CmsSearchCondition[] | undefined`
  - `interface ArticleSourceConfig<TPost, TDetail>` and `interface ArticleSource<TPost, TDetail>` (resolved, with defaults applied: `searchFields=["title","description"]`, `status="PUBLISHED"`, `articleType="Article"`, `relatedLimit=3`)
  - `function defineArticleSource<TPost, TDetail>(config): ArticleSource<TPost, TDetail>`
  - `function fetchArticles<TPost>(source, opts?: { searchQuery?: string; categorySlug?: string; limit?: number }): Promise<TPost[]>`
  - `function fetchArticle<TDetail>(source, slug: string): Promise<TDetail | null>`
  - `function fetchRelatedArticles<TDetail>(source, post: TDetail, slug: string): Promise<TDetail[]>`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/defineArticleSource.test.ts`
Expected: FAIL — cannot resolve `./defineArticleSource`.

- [ ] **Step 3: Implement**

```ts
// src/server/defineArticleSource.ts
import { fetchCmsContent } from "../fetchCmsContent";
import type {
  CmsSearchCondition,
  ContentStatus,
  UseCmsContentOptions,
} from "../build-query";
import type { AsteroidSeoConfig } from "../seo/seo.config";
import type { ArticleJsonLdType } from "../seo/jsonld";
import type { AsteroidArticlePost } from "../components/articles/articles.types";
import type { AsteroidArticlePagePost } from "../components/articles/article.view";
import type { CmsServerClient } from "./cmsServerClient";

type Select = NonNullable<UseCmsContentOptions["select"]>;

export interface ArticleSourceConfig<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  client: CmsServerClient;
  schemaSlug: string;
  listSelect: Select;
  detailSelect: Select;
  seo: AsteroidSeoConfig;
  searchFields?: string[];
  status?: ContentStatus;
  articleType?: ArticleJsonLdType;
  relatedLimit?: number;
  groupPostsByCategory?: (posts: TPost[]) => unknown;
}

export interface ArticleSource<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  client: CmsServerClient;
  schemaSlug: string;
  listSelect: Select;
  detailSelect: Select;
  seo: AsteroidSeoConfig;
  searchFields: string[];
  status: ContentStatus;
  articleType: ArticleJsonLdType;
  relatedLimit: number;
  groupPostsByCategory?: (posts: TPost[]) => unknown;
}

export function buildSearchConditions(
  fields: string[],
  query?: string,
): CmsSearchCondition[] | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return fields.map((field) => ({ field, value: trimmed, mode: "i" }));
}

export function defineArticleSource<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(config: ArticleSourceConfig<TPost, TDetail>): ArticleSource<TPost, TDetail> {
  return Object.freeze({
    client: config.client,
    schemaSlug: config.schemaSlug,
    listSelect: config.listSelect,
    detailSelect: config.detailSelect,
    seo: config.seo.cmsUrl ? config.seo : { ...config.seo, cmsUrl: config.client.cmsUrl },
    searchFields: config.searchFields ?? ["title", "description"],
    status: config.status ?? "PUBLISHED",
    articleType: config.articleType ?? "Article",
    relatedLimit: config.relatedLimit ?? 3,
    groupPostsByCategory: config.groupPostsByCategory,
  });
}

export async function fetchArticles<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(
  source: ArticleSource<TPost>,
  opts: { searchQuery?: string; categorySlug?: string; limit?: number } = {},
): Promise<TPost[]> {
  const search = buildSearchConditions(source.searchFields, opts.searchQuery);
  const data = await fetchCmsContent<TPost[]>(source.client.getClient, {
    schema_slug: source.schemaSlug,
    select: source.listSelect,
    status: source.status,
    ...(opts.limit ? { limit: opts.limit } : {}),
    ...(opts.categorySlug ? { filter: { category: opts.categorySlug } } : {}),
    ...(search ? { search } : {}),
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchArticle<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(source: ArticleSource<AsteroidArticlePost, TDetail>, slug: string): Promise<TDetail | null> {
  try {
    const data = await fetchCmsContent<TDetail>(source.client.getClient, {
      schema_slug: source.schemaSlug,
      entrySlug: slug,
      select: source.detailSelect,
      status: source.status,
    });
    return data ?? null;
  } catch {
    return null;
  }
}

export async function fetchRelatedArticles<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(
  source: ArticleSource<AsteroidArticlePost, TDetail>,
  post: TDetail,
  slug: string,
): Promise<TDetail[]> {
  const categorySlug = post.category?.slug?.trim();
  if (!categorySlug || source.relatedLimit <= 0) return [];
  const data = await fetchCmsContent<TDetail[]>(source.client.getClient, {
    schema_slug: source.schemaSlug,
    select: source.listSelect,
    status: source.status,
    limit: source.relatedLimit + 1,
    filter: { category: categorySlug },
  });
  return (Array.isArray(data) ? data : [])
    .filter((p) => p.slug !== slug)
    .slice(0, source.relatedLimit);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/server/defineArticleSource.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/defineArticleSource.ts src/server/defineArticleSource.test.ts
git commit -m "feat(server): add defineArticleSource + fetch/search helpers"
```

---

### Task 9: `ArticleSearchBox` client island

**Files:**
- Create: `src/components/articles/ArticleSearchBox.tsx`
- Modify: `src/client.ts` (export it)

**Interfaces:**
- Consumes: `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`), React.
- Produces:
  - `interface ArticleSearchBoxProps { paramKey?: string; placeholder?: string; debounceMs?: number; className?: string; render?: (params: { value: string; onChange: (v: string) => void; onSubmit: (e: { preventDefault: () => void }) => void }) => ReactNode }`
  - `function ArticleSearchBox(props: ArticleSearchBoxProps): JSX.Element`

This file is gated by typecheck + build (it depends on `next/navigation`, which is an optional peer; not unit-tested).

- [ ] **Step 1: Implement the client island**

```tsx
// src/components/articles/ArticleSearchBox.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface ArticleSearchBoxProps {
  /** URL query param the search writes to. Default: "q". */
  paramKey?: string;
  placeholder?: string;
  /** Debounce before navigating. Default: 500ms. */
  debounceMs?: number;
  className?: string;
  /** Override the default input UI. */
  render?: (params: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: { preventDefault: () => void }) => void;
  }) => ReactNode;
}

export function ArticleSearchBox({
  paramKey = "q",
  placeholder = "Search articles...",
  debounceMs = 500,
  className,
  render,
}: ArticleSearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get(paramKey) ?? "";
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      const trimmed = value.trim();
      if (trimmed) params.set(paramKey, trimmed);
      else params.delete(paramKey);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, debounceMs);
    return () => clearTimeout(timer);
    // Re-run only when the typed value or debounce changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs, paramKey, pathname]);

  const onSubmit = (event: { preventDefault: () => void }) => event.preventDefault();

  if (render) return <>{render({ value, onChange: setValue, onSubmit })}</>;

  return (
    <form onSubmit={onSubmit} className={className}>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  );
}
```

- [ ] **Step 2: Export from `/client`**

Add to `src/client.ts`:

```ts
export { ArticleSearchBox } from "./components/articles/ArticleSearchBox";
export type { ArticleSearchBoxProps } from "./components/articles/ArticleSearchBox";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the `next` peer is installed as a devDependency).

- [ ] **Step 4: Commit**

```bash
git add src/components/articles/ArticleSearchBox.tsx src/client.ts
git commit -m "feat(articles): add ArticleSearchBox URL-search client island"
```

---

### Task 10: Server listing + article components

**Files:**
- Create: `src/components/articles/AsteroidArticlesListingServer.tsx`
- Create: `src/components/articles/AsteroidArticlePageServer.tsx`

**Interfaces:**
- Consumes: `fetchArticles`, `fetchArticle`, `fetchRelatedArticles`, `ArticleSource`; `buildArticlesViewState`; `renderArticlesListingBody`, `ArticlesListingRenderProps`; `renderArticleBody`, `ArticleBodyRenderProps`; `createImageResolver`; SEO builders + JSON-LD builders; `ArticleSearchBox` (imported from the bare `@asteroidcms/core-utils/client` specifier — marked external in the server build); `AsteroidArticlePagePost`.
- Produces:
  - `interface AsteroidArticlesListingServerProps<TPost> extends ArticlesListingRenderProps<TPost> { source; searchQuery?; categorySlug?; articleSlug?; searchParamKey?; limit?; noindex?; renderSearch?; renderJsonLd?; searchBoxProps? }`
  - `async function AsteroidArticlesListingServer<TPost>(props): Promise<JSX.Element>`
  - `interface AsteroidArticlePageServerProps<TDetail> extends ArticleBodyRenderProps<TDetail> { source; slug; relatedLimit?; noindex?; renderError?; renderJsonLd? }`
  - `async function AsteroidArticlePageServer<TDetail>(props): Promise<JSX.Element>`

These are gated by typecheck + build (async server components; not unit-rendered).

- [ ] **Step 1: Map the self-import to source for typecheck**

`AsteroidArticlesListingServer` imports `ArticleSearchBox` from the bare
specifier `@asteroidcms/core-utils/client` so the client island keeps its own
`"use client"` module boundary (the build marks it external in Task 12). So
`tsc` can resolve that specifier to source before `dist` exists, add a `paths`
mapping. In `tsconfig.json`, inside `compilerOptions`, add:

```json
    "baseUrl": ".",
    "paths": {
      "@asteroidcms/core-utils/client": ["./src/client.ts"]
    },
```

(The build ignores `paths`; tsup keeps the specifier external per Task 12.)

- [ ] **Step 2: Implement the server listing**

```tsx
// src/components/articles/AsteroidArticlesListingServer.tsx
import { type ReactNode } from "react";
import { ArticleSearchBox, type ArticleSearchBoxProps } from "@asteroidcms/core-utils/client";
import {
  buildArticleListingSeoValues,
  seoValuesToClientProps,
} from "../../seo/seo.builders";
import { buildCollectionJsonLd } from "../../seo/jsonld";
import { Seo } from "../../seo/Seo";
import { createImageResolver } from "../../utils/cmsImage";
import { fetchArticles, type ArticleSource } from "../../server/defineArticleSource";
import { buildArticlesViewState } from "./articles.state";
import { renderArticlesListingBody, type ArticlesListingRenderProps } from "./articles.view";
import type {
  ArticlesViewState,
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  AsteroidArticlesSearchParams,
} from "./articles.types";

export interface AsteroidArticlesListingServerProps<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> extends ArticlesListingRenderProps<TPost> {
  source: ArticleSource<TPost>;
  searchQuery?: string;
  categorySlug?: string;
  articleSlug?: string;
  searchParamKey?: string;
  limit?: number;
  noindex?: boolean;
  searchBoxProps?: Omit<ArticleSearchBoxProps, "paramKey">;
  renderSearch?: (params: AsteroidArticlesSearchParams) => ReactNode;
  renderJsonLd?: (state: ArticlesViewState<TPost>) => ReactNode;
  groupPostsByCategory?: (posts: TPost[]) => AsteroidArticleCategoryGroup<TPost>[];
}

export async function AsteroidArticlesListingServer<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(props: AsteroidArticlesListingServerProps<TPost>) {
  const {
    source,
    searchQuery = "",
    categorySlug,
    articleSlug,
    searchParamKey = "q",
    limit,
    noindex,
    searchBoxProps,
    renderSearch,
    renderJsonLd,
    groupPostsByCategory,
    ...renderProps
  } = props;

  let rawPosts: TPost[] = [];
  let hasError = false;
  let error: unknown = undefined;
  try {
    rawPosts = await fetchArticles(source, { searchQuery, categorySlug, limit });
  } catch (err) {
    hasError = true;
    error = err;
  }

  const state = buildArticlesViewState(rawPosts, {
    categorySlug,
    articleSlug,
    searchQuery,
    groupPostsByCategory,
  });

  const cmsImage = createImageResolver({ cmsUrl: source.seo.cmsUrl ?? source.client.cmsUrl });
  const categoryName = categorySlug ? state.posts[0]?.category?.name?.trim() : undefined;

  const seoNode = (
    <Seo
      {...seoValuesToClientProps(
        buildArticleListingSeoValues(source.seo, { categoryName, categorySlug, noindex }),
      )}
    />
  );

  const collection = buildCollectionJsonLd({
    name: categoryName || `${source.seo.siteName} ${source.seo.contentLabel ?? "Articles"}`,
    description: source.seo.defaultDescription || "",
    url: `${(source.seo.baseUrl || "").replace(/\/$/, "")}${source.seo.articlePath ?? "/blog"}${
      categorySlug ? `/category/${categorySlug}` : ""
    }`,
    siteUrl: (source.seo.baseUrl || "").replace(/\/$/, ""),
  });
  const jsonLdNode =
    renderJsonLd?.(state) ?? (
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
    );

  const searchNode = renderSearch
    ? renderSearch({ value: searchQuery, onChange: () => {}, onSubmit: (e) => e.preventDefault() })
    : <ArticleSearchBox paramKey={searchParamKey} {...searchBoxProps} />;

  return (
    <>
      {renderArticlesListingBody({
        state,
        loading: false,
        hasError,
        error,
        cmsImage,
        searchNode,
        seoNode,
        jsonLdNode,
        renderProps: renderProps as ArticlesListingRenderProps<TPost>,
      })}
    </>
  );
}
```

- [ ] **Step 3: Implement the server article page**

```tsx
// src/components/articles/AsteroidArticlePageServer.tsx
import { type ReactNode } from "react";
import { buildArticleSeoValues, seoValuesToClientProps } from "../../seo/seo.builders";
import { buildArticleJsonLd, type ArticleJsonLdType } from "../../seo/jsonld";
import { Seo } from "../../seo/Seo";
import { createImageResolver } from "../../utils/cmsImage";
import {
  fetchArticle,
  fetchRelatedArticles,
  type ArticleSource,
} from "../../server/defineArticleSource";
import {
  renderArticleBody,
  type ArticleBodyRenderProps,
  type AsteroidArticlePagePost,
} from "./article.view";

export interface AsteroidArticlePageServerProps<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> extends ArticleBodyRenderProps<TDetail> {
  source: ArticleSource<AsteroidArticlePagePost, TDetail>;
  slug: string;
  articleType?: ArticleJsonLdType;
  noindex?: boolean;
  renderError?: (params: { error?: unknown; reason: "error" | "not-found" }) => ReactNode;
  renderJsonLd?: (params: { post: TDetail }) => ReactNode;
}

export async function AsteroidArticlePageServer<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(props: AsteroidArticlePageServerProps<TDetail>) {
  const { source, slug, articleType, noindex, renderError, renderJsonLd, ...bodyRenderProps } = props;

  const article = await fetchArticle(source, slug);
  if (!article) {
    return <>{renderError?.({ reason: "not-found" }) ?? null}</>;
  }

  const relatedPosts = await fetchRelatedArticles(source, article, slug);
  const cmsImage = createImageResolver({ cmsUrl: source.seo.cmsUrl ?? source.client.cmsUrl });
  const type = articleType ?? source.articleType;

  const seoValues = buildArticleSeoValues(article, source.seo, slug, { noindex });
  const seoNode = <Seo {...seoValuesToClientProps(seoValues)} />;

  const articleLd = buildArticleJsonLd({
    title: article.title,
    description: article.description || source.seo.defaultDescription || "",
    url: `${(source.seo.baseUrl || "").replace(/\/$/, "")}${source.seo.articlePath ?? "/blog"}/${slug}`,
    siteName: source.seo.siteName,
    siteUrl: (source.seo.baseUrl || "").replace(/\/$/, ""),
    articleType: type,
    image: seoValues.image,
    authorName: article.author?.name,
    publishedTime: article.published_date || undefined,
    tags: article.tags?.split(",").map((t) => t.trim()).filter(Boolean),
    category: article.category?.name,
  });
  const jsonLdNode =
    renderJsonLd?.({ post: article }) ?? (
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
    );

  return (
    <>
      {renderArticleBody({
        post: article,
        cmsImage,
        relatedPosts,
        seoNode,
        jsonLdNode,
        renderProps: bodyRenderProps as ArticleBodyRenderProps<TDetail>,
      })}
    </>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. The `@asteroidcms/core-utils/client` self-import resolves to `src/client.ts` via the `paths` mapping added in Step 1.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json src/components/articles/AsteroidArticlesListingServer.tsx src/components/articles/AsteroidArticlePageServer.tsx
git commit -m "feat(server): add AsteroidArticlesListingServer + AsteroidArticlePageServer"
```

---

### Task 11: Source-aware metadata helpers

**Files:**
- Create: `src/server/articleMetadata.ts`
- Test: `src/server/articleMetadata.test.ts`

**Interfaces:**
- Consumes: `Metadata` (type-only from `next`); `generateSeoMetadata` is reimplemented locally to avoid importing the `/next` module (keeps `/server` self-contained); SEO builders `buildArticleListingSeoValues`, `buildArticleSeoValues`; `fetchArticle`; `ArticleSource`.
- Produces:
  - `function generateListingMetadata(source, options?: { categoryName?: string; categorySlug?: string; noindex?: boolean }): Promise<Metadata>`
  - `function generateArticleMetadata(source, paramsOrSlug: string | { slug: string } | Promise<{ slug: string }>): Promise<Metadata>`
  - `function seoValuesToMetadata(values: ISeoValues, ogType: "website" | "article"): Metadata` (internal helper, exported for the test)

- [ ] **Step 1: Write the failing test**

```ts
// src/server/articleMetadata.test.ts
import { describe, expect, it } from "vitest";
import { seoValuesToMetadata } from "./articleMetadata";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/articleMetadata.test.ts`
Expected: FAIL — cannot resolve `./articleMetadata`.

- [ ] **Step 3: Implement**

```ts
// src/server/articleMetadata.ts
import type { Metadata } from "next";
import {
  buildArticleListingSeoValues,
  buildArticleSeoValues,
} from "../seo/seo.builders";
import type { ISeoValues } from "../seo/seo.config";
import { fetchArticle, type ArticleSource } from "./defineArticleSource";
import type { AsteroidArticlePagePost } from "../components/articles/article.view";

export function seoValuesToMetadata(
  v: ISeoValues,
  ogType: "website" | "article",
): Metadata {
  return {
    title: v.title,
    description: v.description,
    publisher: v.siteName,
    keywords: v.keywords,
    category: v.title,
    ...(v.manifestUrl ? { manifest: v.manifestUrl } : {}),
    robots: v.noindex ? { index: false, follow: true } : { index: true, follow: true },
    authors: { name: v.siteName },
    referrer: "origin",
    abstract: v.description,
    alternates: { canonical: v.url },
    openGraph: {
      title: v.title,
      description: v.description,
      url: v.url,
      siteName: v.siteName,
      locale: "en_US",
      type: ogType,
      ...(v.image ? { images: [{ url: v.image }] } : {}),
    },
    twitter: {
      title: v.title,
      description: v.description,
      site: v.twitter || undefined,
      card: v.image ? "summary_large_image" : "summary",
      ...(v.image ? { images: [v.image] } : {}),
    },
  };
}

export async function generateListingMetadata(
  source: ArticleSource,
  options?: { categoryName?: string; categorySlug?: string; noindex?: boolean },
): Promise<Metadata> {
  return seoValuesToMetadata(buildArticleListingSeoValues(source.seo, options), "website");
}

export async function generateArticleMetadata(
  source: ArticleSource<AsteroidArticlePagePost>,
  paramsOrSlug: string | { slug: string } | Promise<{ slug: string }>,
): Promise<Metadata> {
  const resolved = await paramsOrSlug;
  const slug = typeof resolved === "string" ? resolved : resolved.slug;
  const article = await fetchArticle(source, slug);
  if (!article) {
    return seoValuesToMetadata(buildArticleListingSeoValues(source.seo), "website");
  }
  return seoValuesToMetadata(buildArticleSeoValues(article, source.seo, slug), "article");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/server/articleMetadata.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/articleMetadata.ts src/server/articleMetadata.test.ts
git commit -m "feat(server): add source-aware listing + article metadata helpers"
```

---

### Task 12: `/server` entry + build wiring

**Files:**
- Create: `src/server.ts`
- Modify: `package.json` (add `./server` export)
- Modify: `tsup.config.ts` (add `server` entry)

**Interfaces:**
- Produces the public `@asteroidcms/core-utils/server` surface: `createCmsServerClient`, `defineArticleSource`, `fetchArticles`, `fetchArticle`, `fetchRelatedArticles`, `buildSearchConditions`, `AsteroidArticlesListingServer`, `AsteroidArticlePageServer`, `generateListingMetadata`, `generateArticleMetadata`, and their public types.

- [ ] **Step 1: Create the server entry**

```ts
// src/server.ts
// Server-only entry. Exposed as `@asteroidcms/core-utils/server`.
// `import "server-only"` makes this fail loudly if imported by a client module.
import "server-only";

export { createCmsServerClient } from "./server/cmsServerClient";
export type { CmsServerClient, CmsServerClientConfig } from "./server/cmsServerClient";

export {
  defineArticleSource,
  buildSearchConditions,
  fetchArticles,
  fetchArticle,
  fetchRelatedArticles,
} from "./server/defineArticleSource";
export type {
  ArticleSource,
  ArticleSourceConfig,
} from "./server/defineArticleSource";

export { AsteroidArticlesListingServer } from "./components/articles/AsteroidArticlesListingServer";
export type { AsteroidArticlesListingServerProps } from "./components/articles/AsteroidArticlesListingServer";

export { AsteroidArticlePageServer } from "./components/articles/AsteroidArticlePageServer";
export type { AsteroidArticlePageServerProps } from "./components/articles/AsteroidArticlePageServer";

export {
  generateListingMetadata,
  generateArticleMetadata,
} from "./server/articleMetadata";
```

- [ ] **Step 2: Add the `./server` export to `package.json`**

In `package.json` `exports`, after the `./next` block, add:

```json
    "./server": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js",
      "require": "./dist/server.cjs"
    }
```

- [ ] **Step 3: Add the server entry to `tsup.config.ts`**

Append a fourth config object to the array in `tsup.config.ts`:

```ts
  {
    ...shared,
    entry: { server: "src/server.ts" },
    clean: false,
    // `next` and the package's own client subpath stay external so the
    // client island keeps its own "use client" module boundary.
    external: [...shared.external, "next", "server-only", "@asteroidcms/core-utils/client"],
  },
```

Add `"server-only"` to the install if not present:

Run: `npm install -D server-only`
Expected: `server-only` added to devDependencies (it is a tiny marker package; consumers in Next already have it transitively, but the build needs it resolvable).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success. Verify:
- `dist/server.js` exists and starts with `import "server-only"` (NOT `"use client"`).
- `dist/server.d.ts` exists.
- `dist/client.js` still starts with `"use client";`.

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('dist/server.js','utf8');if(s.startsWith('\"use client\"'))throw new Error('server bundle must not be a client module');console.log('server entry OK')"`
Expected: prints `server entry OK`.

- [ ] **Step 5: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all vitest suites pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsup.config.ts src/server.ts
git commit -m "feat(server): add /server entry point and build wiring"
```

---

### Task 13: Update README entry table, CHANGELOG, and root re-exports check

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Update the entry-point table in `README.md`**

Find the entry-points / exports table and add a row:

```md
| `@asteroidcms/core-utils/server` | Server components: `AsteroidArticlesListingServer`, `AsteroidArticlePageServer`, `defineArticleSource`, `createCmsServerClient`, `generateListingMetadata`, `generateArticleMetadata`. Server-only (the CMS key never reaches the browser). |
```

If the README has a "client components" section listing `AsteroidArticlesListing`, add a one-line note that render-prop params now expose `cmsImage` and that a server equivalent exists under `/server`.

- [ ] **Step 2: Add a CHANGELOG entry**

Prepend under the latest unreleased/next version heading in `CHANGELOG.md`:

```md
### Added
- `@asteroidcms/core-utils/server` entry: `AsteroidArticlesListingServer`,
  `AsteroidArticlePageServer`, `defineArticleSource`, `createCmsServerClient`,
  and source-aware `generateListingMetadata` / `generateArticleMetadata`.
  Server components fetch on the server so the CMS API key never reaches the
  browser; search is driven by URL `searchParams` via `ArticleSearchBox`.

### Changed
- Article render-prop params now include an injected `cmsImage(idOrUrl)`
  resolver. Render props should use it instead of calling `useCmsImage()`,
  so the same render functions work in both client and server components.
```

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document /server entry and cmsImage render-prop change"
```

---

### Task 14: Server-rendering + SEO docs

**Files:**
- Modify: `docs/web-sdk-react/04-nextjs-server-rendering.md`
- Modify: `docs/web-sdk-react/12-seo-and-page-components.md`
- Create: `docs/web-sdk-react/13-server-article-components.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Add a "Source-driven server components" section to `04-nextjs-server-rendering.md`**

After the existing "Reading content" section, add a subsection that shows: defining `cmsServerClient` with `createCmsServerClient` (server-only `CMS_API_KEY`, not `NEXT_PUBLIC`), `defineArticleSource`, and a minimal `app/blog/page.tsx` using `AsteroidArticlesListingServer` with `searchParams`. Use this exact source snippet:

```ts
// cms/blogSource.ts
import { createCmsServerClient, defineArticleSource } from "@asteroidcms/core-utils/server";
import { blogSeo } from "@/configs/seo-config";

export const cmsServerClient = createCmsServerClient({
  cmsUrl: process.env.CMS_API_BASE_URL!,
  apiKey: process.env.CMS_API_KEY!, // server-only, NOT NEXT_PUBLIC
  revalidate: 300,
  tags: ["cms:blog"],
});

export const blogSource = defineArticleSource({
  client: cmsServerClient,
  schemaSlug: "blog",
  listSelect: ["slug", "title", "description", "featured", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] }],
  detailSelect: ["slug", "title", "description", "content", "tags", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] },
    { field: "author", single: true, select: ["name", "bio"] }],
  seo: blogSeo,
  articleType: "BlogPosting",
});
```

- [ ] **Step 2: Write the new guide `13-server-article-components.md`**

Create with frontmatter (`title: Server article components`, `order: 13`) and these sections, each with runnable snippets matching the implemented API:
- "Why server components" (key never leaves server; SEO-indexable URL search).
- "Define a source once" (reuse the snippet above).
- "Listing page" — `app/blog/page.tsx` with `searchParams` → `AsteroidArticlesListingServer source={blogSource} searchQuery={q}`, `export const generateMetadata = () => generateListingMetadata(blogSource)`.
- "Category page" — `categorySlug` from route params.
- "Article page" — `AsteroidArticlePageServer source={blogSource} slug={slug}` with `renderRelatedPosts={({ relatedPosts, cmsImage }) => ...}`, `generateArticleMetadata(blogSource, params)`.
- "Search" — explain the `ArticleSearchBox` default + `renderSearch`/`searchBoxProps` overrides, `searchParamKey`.
- "Images in render props" — use the injected `cmsImage`, not `useCmsImage()`.
- "News / docs" — show a second source with `schemaSlug: "news"`, `articleType: "NewsArticle"`, `articlePath` via `seo`.

- [ ] **Step 3: Update `12-seo-and-page-components.md`**

- Add `@asteroidcms/core-utils/server` to the entries table.
- Add a "Server vs client article components" note: server components emit JSON-LD via `<script type="application/ld+json">` and metadata via `generate*Metadata`; client components use `<Seo>` + `<JsonLd>`. Keep the existing "one head strategy per route" rule.
- Note the `cmsImage`-in-params change in the component prop reference.

- [ ] **Step 4: Commit**

```bash
git add docs/web-sdk-react/04-nextjs-server-rendering.md docs/web-sdk-react/12-seo-and-page-components.md docs/web-sdk-react/13-server-article-components.md
git commit -m "docs: add server article components guide; update SEO + server-rendering docs"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
| --- | --- |
| `/server` entry + `server-only` boundary | 12 |
| Pure presentational core (state + view) | 1, 3, 4 |
| Client wrappers re-pointed at core | 5, 6 |
| `defineArticleSource` + fetch + search filter | 8 |
| `createCmsServerClient` | 7 |
| URL-searchParams search via `ArticleSearchBox` | 9, 10 |
| Server listing + category | 10 |
| Server article + related posts | 10 (uses `fetchRelatedArticles` from 8) |
| Source-aware metadata | 11 |
| JSON-LD via `<script>` on server | 10 |
| `cmsImage` injected into render props | 1 (types), 2 (resolver), 3/4 (wired), 5/6/10 (used) |
| Error handling (renderError/renderEmpty) | 5, 6, 10 |
| Backward compat (client kept) | 5, 6 |
| Build/packaging (`exports`, tsup) | 12 |
| Docs + CHANGELOG + README + env migration | 13, 14 |

No gaps.

**2. Placeholder scan:** No "TBD"/"TODO"/"handle edge cases" placeholders; every code step has complete code; every command has expected output.

**3. Type consistency:**
- `buildArticlesViewState` signature identical in Task 1 (definition), Task 5 (client use), Task 10 (server use).
- `renderArticlesListingBody` arg shape identical in Task 3 (definition), 5, 10.
- `renderArticleBody` arg shape identical in Task 4 (definition), 6, 10.
- `ArticleSource` / `createImageResolver` / `fetchArticles`/`fetchArticle`/`fetchRelatedArticles` names match between Task 7, 8, 10, 11.
- `cmsImage` param name consistent across types (Task 1/4) and all consumers.
- `ArticleSearchBox` props (`paramKey`, `searchBoxProps`) consistent between Task 9 and Task 10.

**Self-import resolution:** `AsteroidArticlesListingServer` imports `ArticleSearchBox` from the bare specifier `@asteroidcms/core-utils/client` to preserve the client island's `"use client"` boundary. Task 10 Step 1 adds a tsconfig `paths` mapping so `tsc` resolves it to `src/client.ts`; Task 12 marks the same specifier external so the build never inlines it. Both ends are covered — no build-ordering dependency for typecheck.
