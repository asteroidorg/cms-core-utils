# ArticleSearchBox — plain-React compatibility

**Date:** 2026-06-28
**Status:** Approved (design)

## Problem

`src/components/articles/ArticleSearchBox.tsx` is exported from the generic
`@asteroidcms/core-utils/client` entry but statically imports
`usePathname`/`useRouter`/`useSearchParams` from `next/navigation`. When a
plain-React app (Vite, CRA, React Router) bundles `/client`, that bare
`next/navigation` import fails to resolve because `next` is an optional peer
dependency that isn't installed. The component is therefore unusable outside
Next.js.

## Constraint (hard)

The current Next.js listing must keep working unchanged. In Next, search is
URL-driven: `AsteroidArticlesListingServer` is rendered by a Server Component
page (e.g. `brass-web` `app/(route)/blog/page.tsx`) that reads `searchParams.q`.
The search box changes `?q=` via `router.replace(...)`, which triggers a Server
Component re-render / refetch. Plain `window.history.replaceState` updates the
URL bar and client `useSearchParams` but does **not** re-run a Server Component,
so a pure-native rewrite would silently break Next search. Both paths must be
preserved.

## Design

Split the single Next-coupled component into a shared headless core plus two
thin variants — one framework-agnostic (default), one Next-bound.

### 1. Pure URL helpers — `articleSearch.helpers.ts` (no React, no DOM)

- `readSearchParam(search: string, key: string): string` — parse a
  `location.search` string, return the param or `""`.
- `buildSearchUrl(currentSearch: string, pathname: string, key: string, query: string): string`
  — clone existing params, `set`/`delete` `key` from the trimmed `query`, return
  `pathname` or `pathname?qs`. Shared by both variants so URL semantics (other
  params preserved, empty query clears the key) are identical and unit-tested.

### 2. Shared UI + state — `articleSearch.shared.tsx`

- `ArticleSearchBoxProps` interface (existing fields) **plus** a new optional
  `onQueryChange?(query: string): void` so a router-less React SPA can react to
  the debounced/trimmed value.
- `useArticleSearchValue({ debounceMs, initial, commit })` — owns the
  `value`/`setValue` state and the debounce `useEffect`; calls the injected
  `commit(trimmedQuery)` (which also fires `onQueryChange`). No framework imports.
- `ArticleSearchBoxView` — the form/input markup and `render`-prop branch,
  byte-identical to today so markup and the `render` API are unchanged.

### 3. Framework-agnostic component — `ArticleSearchBox.tsx` (`/client`)

- `"use client"`. No `next` import.
- Initial value `""` (deterministic for SSR); a mount `useEffect` reads
  `readSearchParam(window.location.search, paramKey)` and seeds state — avoids
  hydration mismatch when the URL already has `?q=`.
- `commit(query)`: compute `buildSearchUrl(window.location.search,
  window.location.pathname, paramKey, query)`, call
  `window.history.replaceState(history.state, "", url)`, dispatch a `popstate`
  event (so react-router / Next client hooks sync), then `onQueryChange?.(query)`.
  All guarded by `typeof window !== "undefined"`.

### 4. Next-bound component — `ArticleSearchBoxNext.tsx` (`/next`)

- `"use client"`. Uses `usePathname`/`useSearchParams`/`useRouter`.
- `commit(query)`: reuse `buildSearchUrl(searchParamsRef.current.toString(),
  pathname, paramKey, query)` (the latest `useSearchParams` held in a ref, as
  today) and `router.replace(url, { scroll: false })` — preserving exact current
  Next behavior. Initial value from `useSearchParams().get(paramKey)`.

### 5. Packaging — honor the `/next` import path

The `/next` bundle (`src/next.ts`) is a **server-context** module (no
`"use client"`): its `generateSeoMetadata` helpers run in `generateMetadata`. A
`useRouter` client component cannot share that boundary. So the Next search box
ships as its **own `"use client"` bundle**, re-exported from `next.ts` — mirroring
how `server.ts` re-exports the client island from `@asteroidcms/core-utils/client`
kept external.

- New internal entry `src/next-client.ts`:
  `export { ArticleSearchBox, type ArticleSearchBoxProps } from "./components/articles/ArticleSearchBoxNext";`
- `tsup.config.ts`: add a `next-client` entry with `"use client"` prepended and
  `next` external (same treatment as the `client` entry).
- `package.json` `exports`: add `"./next-client"` (types/import/require).
- `src/next.ts`: `export { ArticleSearchBox, type ArticleSearchBoxProps } from "@asteroidcms/core-utils/next-client";`
  and mark `@asteroidcms/core-utils/next-client` external in the `next` tsup
  entry. Consumers import from `@asteroidcms/core-utils/next`.

### 6. Consumer updates (keep current listing working)

- `src/client.ts`: keep exporting the framework-agnostic `ArticleSearchBox`
  (now React-safe).
- `src/components/articles/AsteroidArticlesListingServer.tsx`: import
  `ArticleSearchBox` from `@asteroidcms/core-utils/next-client` (Next-only server
  code) so RSC refetch is preserved. Keep this external in the `server` tsup
  entry.
- `brass-web` `src/feature/blog/components/BrassBlogSearch.tsx`: switch import to
  `@asteroidcms/core-utils/next` (render prop unchanged → behavior identical).

## Testing

- Unit-test the pure helpers with vitest (node env, matches existing tests):
  `readSearchParam` (present / absent / empty `search`) and `buildSearchUrl`
  (sets, deletes when empty, preserves other params, trims, no `?` when empty).
- DOM/hook behavior is not unit-tested (repo has no jsdom; existing component
  tests use `renderToStaticMarkup`). Verify the agnostic component renders to
  static markup without throwing, and confirm `/client` has no `next` import.

## Out of scope

- A general pluggable `navigation` adapter prop (react-router-specific binding).
  The native History API default already works under react-router via the
  dispatched `popstate`; a dedicated adapter can be added later if needed.
