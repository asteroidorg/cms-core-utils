# Server article components & sources — design

**Date:** 2026-06-22
**Package:** `@asteroidcms/core-utils`
**Branch context:** `feat/seo-page-components`
**Status:** Approved design, pre-implementation

---

## Problem

The article surface added in the recent merge — `AsteroidArticlePage` and
`AsteroidArticlesListing` — ships as **client components** (`"use client"`).
Being client-only, they push consuming apps toward client-side data fetching
through `AsteroidCMSProvider`, which requires the CMS API key in the browser.

The reference consumer (`brass-web`) demonstrates the consequence: it exposes
`NEXT_PUBLIC_CMS_X_API_KEY` and mounts `AsteroidCMSProvider` with it, shipping
the key to the browser. brass-web has already half-escaped this — it fetches
blog data server-side (`apollo-server.ts` + `blog.server.ts`, server-only key)
and passes posts as props into the client listing, which then does **in-memory
client search**. But the provider (and the public key) remain, largely to feed
`useCmsImage` (which only needs `cmsUrl`, not the key).

We want a server-rendered article surface where:

- The API key never reaches the browser.
- Search runs on the server and is fully SEO-indexable.
- Integration is high-abstraction: define a content source once, then "just
  take required parameters and the article is displayed."
- The same design flexibility (render props) works for **both** server and
  client components, seamlessly.
- The surface is content-type agnostic: blogs, news, docs all integrate the
  same way.

## Goals

1. Ship server components (`AsteroidArticlesListingServer`,
   `AsteroidArticlePageServer`) that fetch on the server with a server-only key.
2. URL-`searchParams`-driven server search with a package-provided debounced
   client search-box island.
3. A `defineArticleSource` descriptor + `createCmsServerClient` that own
   fetching, search, related posts, JSON-LD, and metadata from one config.
4. Extract a runtime-agnostic presentational core so server and client
   components share one body of view + state logic.
5. Keep client components working (with one intentional, cleaner break).
6. Update all docs and add a migration path off the public key.

## Non-goals

- Migrating `brass-web` onto the new API (separate follow-up; brass-web is the
  reference for requirements only).
- Changing the form/mutation surface (`useCmsMutate`, `cmsMutate`).
- Changing the rich-text parser, image utils, or GraphQL query builders beyond
  what the source layer needs.

---

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| Search | How server search works | URL `searchParams` → server refetch; package ships a debounced client `ArticleSearchBox` island that writes `?q=`. |
| Abstraction | How much the package owns fetching | Package owns fetch via a server `source` config (`defineArticleSource` + `createCmsServerClient`). |
| Compatibility | Breaking changes allowed? | Refactor freely; keep both client + server; extract a shared presentational core. |
| Scope | brass-web migration | Package + docs only. |
| Related posts | Source ownership | Server article component fetches same-category related posts and injects them into `renderRelatedPosts`. |
| Images | `cmsImage` in render props | Inject a resolved `cmsImage(idOrUrl)` into every render-prop param; render props stop calling the `useCmsImage` hook. |

---

## Architecture

### Approach

**Pure presentational core + thin server/client wrappers.** This is the only
approach viable in the Next.js App Router — a component cannot be both
`"use client"` and `async`, so server and client variants must be distinct
components sharing extracted logic.

- Extract the full view tree and state logic into runtime-agnostic modules
  (no hooks, no `"use client"`).
- **Client wrapper**: `useState` + debounce + injected `usePosts` hook (today's
  behavior, re-pointed at the core).
- **Server wrapper**: `async` component that fetches from a `source` +
  `searchQuery`, builds the same state, renders the same core. Renders the
  client `ArticleSearchBox` island for search input.

Same render props, same param shapes, one body of view + state logic.

*Rejected alternatives:* a single `mode`-switched component (impossible across
the server/client boundary); "server pre-fetch → client component does search"
(contradicts the URL-driven server-search decision and keeps the SPA-style
in-memory search that doesn't scale).

### Module & entry-point layout

```
src/components/articles/
  articles.types.ts                  # shared post/state/render-prop types (server-safe)
  articles.state.ts                  # pure: filters, featured split, category grouping, search-group
  articles.view.tsx                  # pure renderers (header/featured/groups/grid/empty/skeleton) — NO "use client"
  ArticleSearchBox.tsx               # "use client" — debounced island that writes ?q= to the URL
  AsteroidArticlesListing.tsx        # "use client" wrapper (existing behavior, re-pointed at core)
  AsteroidArticlePage.tsx            # "use client" wrapper (existing behavior, re-pointed at core)
  AsteroidArticlesListingServer.tsx  # async RSC, source-driven
  AsteroidArticlePageServer.tsx      # async RSC, source-driven

src/server/
  cmsServerClient.ts                 # createCmsServerClient({ cmsUrl, apiKey, revalidate, tags })
  defineArticleSource.ts             # source descriptor + helpers
  articleMetadata.ts                 # source-aware generate*Metadata (wraps /next builders)
  index.ts                           # /server entry — `import "server-only"` at top
```

The existing files `src/components/AsteroidArticlesListing.tsx` and
`src/components/AsteroidArticlePage.tsx` are split into the `articles/` modules
above; their public client exports remain available from `/client`.

### Entry points

| Entry | Import specifier | Adds / changes |
|-------|------------------|----------------|
| Server-safe root | `@asteroidcms/core-utils` | unchanged (builders, `fetchCmsContent`, etc.) |
| Client | `@asteroidcms/core-utils/client` | client components re-point at core; render-prop params now include `cmsImage` |
| Next.js | `@asteroidcms/core-utils/next` | unchanged |
| **Server (new)** | `@asteroidcms/core-utils/server` | `AsteroidArticlesListingServer`, `AsteroidArticlePageServer`, `defineArticleSource`, `createCmsServerClient`, `generateListingMetadata`, `generateArticleMetadata` |

The `/server` entry begins with `import "server-only"` so it can never be
bundled into a client component. Server components import the `"use client"`
`ArticleSearchBox` (the standard RSC → client-component composition).

`package.json` `exports` gains a `./server` condition; `tsup.config.ts` gains a
`server` entry. The server bundle must **not** carry a top-level `"use client"`
banner (only `ArticleSearchBox` does).

---

## The `source`

A single descriptor drives listing, category, detail, search, related posts,
JSON-LD, and metadata.

```ts
// cms/blogSource.ts  (server-only module in the consumer app)
import { createCmsServerClient, defineArticleSource } from "@asteroidcms/core-utils/server";
import { blogSeo } from "@/configs/seo-config";
import { BLOG_LIST_SELECT, BLOG_DETAIL_SELECT } from "./blog.select";

export const cmsServerClient = createCmsServerClient({
  cmsUrl: process.env.CMS_API_BASE_URL!,
  apiKey: process.env.CMS_API_KEY!,        // server-only, NOT NEXT_PUBLIC
  revalidate: 300,
  tags: ["cms:blog"],
});

export const blogSource = defineArticleSource({
  client: cmsServerClient,
  schemaSlug: "blog",
  listSelect: BLOG_LIST_SELECT,
  detailSelect: BLOG_DETAIL_SELECT,
  searchFields: ["title", "description"],  // default
  seo: blogSeo,
  articleType: "BlogPosting",              // schema.org subtype for detail JSON-LD
  status: "PUBLISHED",                     // default
  relatedLimit: 3,                         // default; same-category related posts
  // optional: groupPostsByCategory
});
```

### `createCmsServerClient(config)`

- Wraps the existing `createApolloClient` in React `cache()` for per-request
  dedupe; returns a `getClient` compatible with `fetchCmsContent(getClient, …)`.
- `config`: `{ cmsUrl, apiKey, graphqlPath?, headers?, revalidate?, tags? }`.
- When `next` is available, sets `fetchOptions: { next: { revalidate, tags } }`
  on the `HttpLink` so ISR / on-demand revalidation works.
- Validates `cmsUrl` + `apiKey`; throws loudly if either is missing (reuses
  `resolveConfig`).
- Returned shape: `{ getClient }` (the source stores it as `source.client`).

### `defineArticleSource(config)`

Returns a frozen `ArticleSource` object. Fields:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `client` | `CmsServerClient` | required | server Apollo client (`createCmsServerClient`) |
| `schemaSlug` | `string` | required | CMS schema slug (`"blog"`, `"news"`, …) |
| `listSelect` | `UseCmsContentOptions["select"]` | required | listing field selection |
| `detailSelect` | `UseCmsContentOptions["select"]` | required | detail field selection |
| `searchFields` | `string[]` | `["title","description"]` | fields searched server-side |
| `seo` | `AsteroidSeoConfig` | required | drives metadata + JSON-LD |
| `articleType` | `ArticleJsonLdType` | `"Article"` | detail JSON-LD subtype |
| `status` | `ContentStatus` | `"PUBLISHED"` | content status filter |
| `relatedLimit` | `number` | `3` | related posts fetched on detail pages |
| `groupPostsByCategory` | fn | `defaultGroupPostsByCategory` | category grouping |

The source carries `seo.cmsUrl` (or the server client's `cmsUrl`) so the
injected `cmsImage` resolves featured-image ids on the server.

---

## Data flow — listing

```tsx
// app/blog/page.tsx  (server component)
import { AsteroidArticlesListingServer, generateListingMetadata } from "@asteroidcms/core-utils/server";
import { blogSource } from "@/cms/blogSource";

export const generateMetadata = () => generateListingMetadata(blogSource);

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <AsteroidArticlesListingServer
      source={blogSource}
      searchQuery={q}                                  // drives server refetch
      categorySlug={undefined}                         // or from route params
      renderPostCard={({ post, cmsImage }) => (
        <Card post={post} img={cmsImage(post.featured_image)} />
      )}
      renderFeaturedCard={...}
      renderHeader={...}
      /* same render-prop set as the client component */
    />
  );
}
```

Flow:

1. Server component reads `searchQuery` from props (consumer passes
   `searchParams.q`).
2. Fetches via `fetchCmsContent(source.client.getClient, …)`, applying the CMS
   `search` filter built from `source.searchFields` when `searchQuery` is set.
3. Builds state with the shared `articles.state` functions (filters, featured
   split, category grouping, search-result grouping).
4. Renders the shared `articles.view` with the consumer's render props.
5. Renders `<ArticleSearchBox paramKey="q" />` by default (overridable via
   `renderSearch`). The island debounces input and `router.replace`s `?q=…`,
   re-rendering the server component. No key in the browser.

`searchParamKey` prop defaults to `"q"`. The server component is responsible
for reading the query value (passed in by the consumer from `searchParams`);
the island only writes it.

---

## Data flow — article + related

```tsx
// app/blog/[slug]/page.tsx
import { AsteroidArticlePageServer, generateArticleMetadata } from "@asteroidcms/core-utils/server";
import { RichTextContent } from "@asteroidcms/core-utils/client";
import { blogSource } from "@/cms/blogSource";

export const generateMetadata = ({ params }: { params: Promise<{ slug: string }> }) =>
  generateArticleMetadata(blogSource, params);

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <AsteroidArticlePageServer
      source={blogSource}
      slug={slug}
      renderHeader={({ post }) => <h1>{post.title}</h1>}
      renderContent={({ post }) => <RichTextContent html={post.content ?? ""} />}
      renderRelatedPosts={({ relatedPosts, cmsImage }) => (
        <RelatedGrid posts={relatedPosts} cmsImage={cmsImage} />
      )}
    />
  );
}
```

Flow:

1. Fetches the article (`entrySlug: slug`, `source.detailSelect`).
2. Fetches related posts: same `category.slug`, `limit: relatedLimit`, excluding
   the current slug, server-side.
3. Injects `relatedPosts` into the `renderRelatedPosts` param — the consumer
   writes zero extra queries.
4. Missing article → `renderError({ reason: "not-found" })`; the consumer may
   call Next's `notFound()` from within that slot.

---

## SEO — seamless from the same source

- **Metadata** (title / canonical / OG / Twitter):
  - `generateListingMetadata(source, { categorySlug?, searchQuery? })`
  - `generateArticleMetadata(source, paramsOrSlug)`
  - Thin wrappers over the existing `/next` builders
    (`buildArticleListingSeoValues`, `buildArticleSeoValues`,
    `generateSeoMetadata`). One source → correct metadata for blog/news/docs.
- **JSON-LD**: server components emit `<script type="application/ld+json">`
  directly (server-safe, via existing `buildCollectionJsonLd` /
  `buildArticleJsonLd`) — no client `<JsonLd>` needed. `renderJsonLd` override
  retained.
- **Client components** keep `<Seo>` + `<JsonLd>` for SPA / Vite routes. The
  existing "one head strategy per route" rule (do not combine `generateMetadata`
  and `<Seo>`) stays documented.

---

## Render-prop param change (the one intentional break)

Every render-prop param object gains an injected `cmsImage(idOrUrl: string)`:

- **Server**: resolved from `source` `cmsUrl` (`cmsImage` util).
- **Client**: resolved from the nearest `AsteroidCMSProvider` `cmsUrl`.

Consequence: render props must **stop** calling the `useCmsImage()` hook and use
the injected `cmsImage` param instead. This makes render-prop functions
runtime-agnostic — the same function works in both the server and client
components. Migration: replace `const cmsImage = useCmsImage()` with destructured
`cmsImage` from the render-prop param.

Affected params (both listing and article): `renderPostCard`,
`renderFeaturedCard`, `renderContent`, `renderFeaturedImage`,
`renderRelatedPosts`, and any slot that renders images.

---

## Error handling

- Server fetches wrapped in `try/catch`; failures route to
  `renderError` / `renderEmpty` for parity with the client components.
- `createCmsServerClient` fails loudly when `cmsUrl` or `apiKey` is missing.
- The `/server` entry's `import "server-only"` makes accidental client bundling
  a build-time error.

---

## Backward compatibility & migration

- Client `AsteroidArticlesListing` / `AsteroidArticlePage` keep working; their
  exports stay on `/client`.
- The single intentional break is the `cmsImage`-in-params render-prop shape
  (cleaner, runtime-agnostic). Documented as a migration step.
- Version bump (minor or major per the break) + CHANGELOG entry.
- `.env` guidance moves consumers from `NEXT_PUBLIC_CMS_X_API_KEY` to a
  server-only `CMS_API_KEY`. Apps that only render articles server-side no
  longer need `AsteroidCMSProvider` or any public key.

---

## Docs to update

- `docs/web-sdk-react/04-nextjs-server-rendering.md` — add source-driven server
  components alongside the existing manual `fetchCmsContent` recipes.
- `docs/web-sdk-react/12-seo-and-page-components.md` — server components, the
  `/server` entry, `defineArticleSource`, source-aware metadata,
  `cmsImage`-in-params.
- New guide: "Server article components & sources" (define a source once; wire
  listing / category / detail / search / related; news + docs examples).
- Migration section: client → server, public key → server-only key,
  `useCmsImage()` → `cmsImage` param.
- `README.md` entry-point table + `CHANGELOG.md`.

---

## Build / packaging changes

- `package.json` `exports`: add `./server` → `dist/server.{js,cjs,d.ts}`.
- `tsup.config.ts`: add `server` entry; ensure only `ArticleSearchBox` carries
  `"use client"` and the server bundle does not.
- `peerDependenciesMeta`: `@apollo/client-integration-nextjs` stays optional;
  `createCmsServerClient` works without it (plain `createApolloClient` + React
  `cache()`), using it only when present for per-request dedupe.

---

## Open implementation notes (not blockers)

- Confirm whether `createCmsServerClient` should optionally accept a
  pre-built `getClient` (escape hatch mirroring the provider's `client` prop).
- Decide exact `ArticleSearchBox` debounce default (reuse the client's `800ms`).
- Verify the search filter shape matches the CMS resolver (the existing
  `build-query` `regex/value/mode` shape is reused).
