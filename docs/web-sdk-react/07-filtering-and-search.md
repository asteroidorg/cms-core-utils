---
title: Filtering and search
description: Narrow a list query with exact-match filters, case-insensitive regex search, and status conditions — all merged into a single server-side data argument.
order: 7
---

# Filtering and search

`filter` and `search` are list-only options on `useCmsContent` / `fetchCmsContent`. They're merged into a single server-side `data` argument, so you can use them together freely.

| Option   | Behavior                                                            | Mode               |
| -------- | ------------------------------------------------------------------- | ------------------ |
| `filter` | Shallow equality on field values.                                   | List only          |
| `search` | Per-field regex with case mode flags.                               | List only          |
| `status` | Restrict to `DRAFT` / `PUBLISHED` / `ARCHIVED`. Default `PUBLISHED`. | List only          |

> All three are **ignored in single-entry mode** (when `entrySlug` is set). Single-entry visibility is enforced by your CMS, not by the SDK.

---

## Equality filter

```tsx
useCmsContent({
  schema_slug: "products",
  filter: { category: "boots", inStock: true },
  select: ["name", "price"],
});
```

Values may be `string`, `number`, `boolean`, or `null`. Comparison is strict equality on the server.

---

## Regex search

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  search: [
    { field: "title", value: "react", mode: "i" }, // case-insensitive
    { field: "body",  value: "\\bhooks\\b" },      // word boundary
  ],
  select: ["title", "slug"],
});
```

`mode` follows MongoDB regex options:

| Mode | Meaning             |
| ---- | ------------------- |
| `i`  | Case-insensitive    |
| `m`  | Multiline           |
| `s`  | Dotall              |
| `x`  | Extended            |

If omitted, `mode` defaults to `"i"`.

---

## Filter + search together

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  filter: { category: "engineering" },
  search: [{ field: "title", value: "edge" }],
  limit: 20,
  select: ["title", "slug"],
});
```

Internally the two are merged. **`search` conditions overwrite same-named keys in `filter`** — they're the more specific signal.

---

## Status

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  status: "DRAFT",
  select: ["title"],
});
```

A single value, not an array. Default is `"PUBLISHED"`. To return everything regardless of status, you'll need a server-side change — the SDK doesn't expose an "any status" mode.

---

## Pagination interacts with both

`filter`, `search`, and `status` all participate in the cache key. Apollo treats two queries with different filter values as distinct entries — pagination state isn't shared across filter changes.

If you flip a filter while paging through results, the cache for the previous filter remains live (until evicted). For huge lists with many filter permutations, consider evicting on filter change:

```ts
import { useApolloClient } from "@apollo/client/react";

const apollo = useApolloClient();
apollo.cache.evict({ fieldName: "contentEntries" });
apollo.cache.gc();
```

See [Advanced topics »](./11-advanced.md#cache-eviction-after-mutations) for more.

---

## Sanitizing untrusted search input

`search.value` is passed to the server as a regex string. If it comes from a user input, escape regex metacharacters first — otherwise a stray `(` or `*` blows up the query:

```ts
import escapeRegex from "escape-string-regexp";

useCmsContent({
  schema_slug: "blog-posts",
  search: [{ field: "title", value: escapeRegex(userInput) }],
  select: ["title", "slug"],
});
```

`filter` values are not regex and don't need escaping — they're compared exactly.

---

## Quick reference

```ts
useCmsContent({
  schema_slug: "blog-posts",
  // Narrowing:
  status: "PUBLISHED",
  filter: { category: "engineering", featured: true },
  search: [{ field: "title", value: "edge", mode: "i" }],
  // Paging:
  limit: 20,
  offset: 0,
  // Shape:
  select: ["title", "slug", "publishedAt"],
});
```

Continue to **[Writing content »](./08-writing-content.md)**.
