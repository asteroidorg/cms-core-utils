---
title: Reading content
description: Use useCmsContent (client) or fetchCmsContent (server) to read a single entry or a paginated list, with conditional fetching, pagination, and the full Apollo result surface.
order: 5
---

# Reading content

The SDK gives you two reading APIs that share the same options shape:

| Use this | When | Import from |
| --- | --- | --- |
| `useCmsContent` | Interactive components, hooks-friendly contexts. | `@asteroidcms/core-utils/client` |
| `fetchCmsContent` | Server Components, scripts, build-time fetching. | `@asteroidcms/core-utils` |

Pick the one that matches the runtime — the options object is identical. This page focuses on `useCmsContent`. Server-side details are in [Next.js server rendering](/docs/web-sdk-react/nextjs-server-rendering).

---

## Two modes

| Mode | Trigger | Returns |
| --- | --- | --- |
| **Single entry** | Pass `entrySlug` | One entry (or `undefined`) |
| **List** | Omit `entrySlug` | An array, with optional `limit`, `offset`, `status`, `filter`, `search` |

The hook is generic — pass your row shape for end-to-end type inference.

---

## API reference

```ts
useCmsContent<T = unknown>({
  schema_slug,           // required — the schema's slug (e.g. "blog-posts")
  entrySlug,             // optional — switches to single-entry mode
  select,                // field selectors and reference expansions
  fullData,              // include the raw `data` JSON blob
  limit, offset,         // list pagination
  status,                // "DRAFT" | "PUBLISHED" | "ARCHIVED" (default PUBLISHED)
  filter,                // equality filter
  search,                // regex search conditions
  variables,             // extra GraphQL variables (rarely needed)
}): {
  loading: boolean;
  error: ApolloError | undefined;
  data: T | undefined;
  refetch: (vars?) => Promise<...>;
  fetchMore: (...) => Promise<...>;
  networkStatus: NetworkStatus;
}
```

You never see `data.entry` or `data.entries` — the hook normalizes both into a flat `data`.

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

  if (loading) return <p>Loading...</p>;
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

For a single-entry call, the hook builds a query like:

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

### Infinite scroll with `fetchMore`

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

> For `fetchMore` results to **merge** rather than replace, configure a `typePolicies` merge function on `contentEntries` via the provider's `cacheConfig`. See [Advanced topics](/docs/web-sdk-react/advanced#pagination-merging).

---

## Status filtering

By default only `PUBLISHED` entries are returned. Switch with `status`:

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  status: "DRAFT",
  select: ["title"],
});
```

| Status | Description |
| --- | --- |
| `"PUBLISHED"` | Default. Live content visible to end users. |
| `"DRAFT"` | Work-in-progress, not yet published. |
| `"ARCHIVED"` | Retired content, hidden from default queries. |

> `status` applies **only** in list mode. In single-entry mode (with `entrySlug`), the entry is returned regardless of status.

---

## Conditional fetching

The hook automatically skips when:

- `schema_slug` is falsy, or
- you're in single-entry mode and `entrySlug` is falsy.

This means you can call it unconditionally and let runtime state decide:

```tsx
const { data: post } = useCmsContent<Post>({
  schema_slug: "blog-posts",
  entrySlug: router.query.slug,   // undefined on first render → hook skips
  select: ["title", "body"],
});
```

---

## TypeScript tips

```ts
// Single entry — pass the row shape directly
useCmsContent<Post>({ schema_slug: "blog-posts", entrySlug: slug });

// List — wrap in an array
useCmsContent<Post[]>({ schema_slug: "blog-posts", limit: 10 });

// Reference expansions
type PostWithAuthor = {
  title: string;
  author: { name: string } | null;    // single: true → object | null
  tags: { name: string; slug: string }[];  // no single → array
};
```

`select` is `readonly` — `as const` is fine but not required. The SDK doesn't enforce that selectors match the type — treat the type as documentation of what the server returns.

---

## Known footguns

| Issue | Details |
| --- | --- |
| Schema-driven, not type-driven | The SDK doesn't know what fields exist on `schema_slug`. Misspelling a field returns `null`, not a build error. |
| `status` ignored for single entry | Worth repeating — single-entry mode returns the entry regardless of status. |
| `offset` pagination assumes stable sort | Without deterministic order, you may see duplicates. Sort server-side or use cursor-based pagination. |
| Filter values aren't regex-escaped | Use `filter` for exact equality, `search` for fuzzy matching. Untrusted input in `search.value` should be escaped. |

---

## FAQ

**What's the difference between `fullData` and `select`?**
`select` picks specific fields and keeps the payload small. `fullData: true` includes the entire raw `data` JSON blob — useful for admin views or debugging but heavier over the wire. They can be combined.

**Can I call `useCmsContent` multiple times in one component?**
Yes. Each call creates an independent Apollo query. They share the same cache when the provider is mounted correctly.

**How do I refresh data?**
Call `refetch()` from the hook's return value. For background refreshes, see [Advanced topics](/docs/web-sdk-react/advanced#polling).
