---
title: Reading content
description: Use useCmsContent (client) or fetchCmsContent (server) to read a single entry or a paginated list, with conditional fetching and the full Apollo result surface.
order: 5
---

# Reading content

The SDK gives you two reading APIs that share the same options shape:

| Use this              | When                                              | Import from                       |
| --------------------- | ------------------------------------------------- | --------------------------------- |
| `useCmsContent`       | Interactive components, hooks-friendly contexts.  | `@asteroidcms/core-utils/client`  |
| `fetchCmsContent`     | Server Components, scripts, build-time fetching.  | `@asteroidcms/core-utils`         |

Pick the one that matches the runtime; the options object is identical otherwise. The rest of this page focuses on `useCmsContent`. Server-side details are in [Next.js server rendering »](./04-nextjs-server-rendering.md).

---

## Two modes

- **Single entry** — pass `entrySlug`. Returns one entry (or `undefined`).
- **List** — omit `entrySlug`. Returns an array, with optional `limit`, `offset`, `status`, `filter`, and `search`.

The hook is generic; pass your row shape to get end-to-end inference.

---

## API

```ts
useCmsContent<T = unknown>({
  schema_slug,           // required: the schema's slug (e.g. "blog-posts")
  entrySlug,             // optional: switch to single-entry mode
  select,                // field selectors and reference expansions
  fullData,              // also include the raw `data` JSON blob
  limit, offset,         // list pagination
  status,                // "DRAFT" | "PUBLISHED" | "ARCHIVED" (default PUBLISHED)
  filter,                // equality filter, merged with `search`
  search,                // regex search conditions
  variables,             // extra GraphQL variables (rarely needed)
}): { loading, error, data: T | undefined, refetch, fetchMore, ... }
```

Selector and filter syntax is covered in dedicated pages — see [Selectors and references »](./06-selectors-and-references.md) and [Filtering and search »](./07-filtering-and-search.md).

---

## Single entry

```tsx
"use client";

import { useCmsContent } from "@asteroidcms/core-utils/client";

type Post = {
  title: string;
  body: string;
  hero?: string;
};

export function PostPage({ slug }: { slug: string }) {
  const { data: post, loading, error } = useCmsContent<Post>({
    schema_slug: "blog-posts",
    entrySlug: slug,
    select: ["title", "body", "hero"],
  });

  if (loading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;
  if (!post) return <p>Not found</p>;

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
```

### What gets sent

For a single-entry call, the hook builds and sends a query like:

```graphql
query GetblogpostsEntry($schema_slug: String!, $slug: String!) {
  entry: contentEntry(schema_slug: $schema_slug, slug: $slug) {
    title: dataField(slug: "title")
    body: dataField(slug: "body")
    hero: dataField(slug: "hero")
  }
}
```

You don't write this — the hook does. Knowing the shape helps when debugging via the network tab.

---

## List with pagination

```tsx
const { data: posts, loading } = useCmsContent<Post[]>({
  schema_slug: "blog-posts",
  limit: 10,
  offset: 0,
  status: "PUBLISHED",
  select: ["title", "slug", "publishedAt"],
});
```

Combined with Apollo's `fetchMore`, you can build infinite scroll:

```tsx
const { data, fetchMore } = useCmsContent<Post[]>({
  schema_slug: "blog-posts",
  limit: 10,
  offset: 0,
  select: ["title", "slug"],
});

function loadMore() {
  fetchMore({
    variables: { offset: data?.length ?? 0 },
  });
}
```

> For `fetchMore` results to **merge** rather than replace, configure a `typePolicies` `merge` function on `contentEntries` via the provider's `cacheConfig`. See [Advanced topics »](./11-advanced.md#pagination-merging).

---

## Status

By default only `PUBLISHED` entries are returned. Switch with `status`:

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  status: "DRAFT",
  select: ["title"],
});
```

`status` applies **only** in list mode. In single-entry mode (with `entrySlug`), the entry is returned regardless of status — your API gate is responsible for enforcing visibility.

---

## Return value

The hook returns Apollo's full `useQuery` result with `data` re-typed:

```ts
{
  loading: boolean;
  error: ApolloError | undefined;
  data: T | undefined;        // unwrapped — already `entry` or `entries`
  refetch: (vars?) => Promise<...>;
  fetchMore: (...) => Promise<...>;
  networkStatus: NetworkStatus;
  // ...other Apollo fields
}
```

You never see `data.entry` or `data.entries` — the hook normalizes both into a flat `data`.

---

## Conditional fetching

The hook automatically skips when:

- `schema_slug` is falsy, or
- you're in single-entry mode and `entrySlug` is falsy.

That means you can call it unconditionally and let runtime state decide:

```tsx
const { data: post } = useCmsContent<Post>({
  schema_slug: "blog-posts",
  entrySlug: router.query.slug,   // undefined on first render → hook skips
  select: ["title", "body"],
});
```

For more complex skip conditions, gate the render upstream — don't call the hook at all.

---

## TypeScript tips

- Pass the row shape: `useCmsContent<Post>({ ... })` for single, `useCmsContent<Post[]>({ ... })` for lists.
- `select` is `readonly` — `as const` is fine but not required.
- Reference expansions returning arrays should be typed as `{ field: T[] }`; with `single: true`, as `{ field: T | null }`.

---

## Known footguns

- **Schema-driven, not type-driven.** The SDK doesn't know what fields exist on `schema_slug`. Misspelling a field returns `null`, not a build error.
- **`status` is ignored for single-entry mode.** Worth repeating.
- **`offset` pagination assumes a stable sort.** If the underlying schema has no deterministic order, you may see duplicates or skips. Sort server-side, or upgrade to cursor-based pagination via custom Apollo policies.
- **Filter values that look like regex aren't escaped.** Use `filter` for exact equality and `search` for fuzzy matching. Untrusted input in `search.value` should be escaped (e.g. with `escape-string-regexp`).

Continue to **[Selectors and references »](./06-selectors-and-references.md)**.
