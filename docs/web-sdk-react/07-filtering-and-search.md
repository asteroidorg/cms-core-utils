---
title: Filtering and search
description: Narrow list queries with exact-match filters, regex search, and status conditions — all merged into a single server-side data argument.
order: 7
---

# Filtering and search

`filter` and `search` are list-only options on `useCmsContent` / `fetchCmsContent`. They're merged into a single server-side `data` argument, so you can use them together freely.

| Option | Behavior | Mode |
| --- | --- | --- |
| `filter` | Shallow equality on field values. | List only |
| `search` | Per-field regex with case mode flags. | List only |
| `status` | Restrict to `DRAFT` / `PUBLISHED` / `ARCHIVED`. Default `PUBLISHED`. | List only |

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
    { field: "body", value: "\\bhooks\\b" },        // word boundary
  ],
  select: ["title", "slug"],
});
```

### Mode flags

`mode` follows MongoDB regex options:

| Mode | Meaning |
| --- | --- |
| `i` | Case-insensitive |
| `m` | Multiline |
| `s` | Dotall (`.` matches newlines) |
| `x` | Extended (ignore whitespace in pattern) |

If omitted, `mode` defaults to `"i"`.

---

## Combining filter and search

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

A single value, not an array. Default is `"PUBLISHED"`. The SDK doesn't expose an "any status" mode — that requires a server-side change.

---

## Pagination and cache interaction

`filter`, `search`, and `status` all participate in the cache key. Apollo treats two queries with different filter values as distinct entries — pagination state isn't shared across filter changes.

If you flip a filter while paging through results, the cache for the previous filter remains live (until evicted). For large lists with many filter permutations, consider evicting on filter change:

```ts
import { useApolloClient } from "@apollo/client/react";

const apollo = useApolloClient();
apollo.cache.evict({ fieldName: "contentEntries" });
apollo.cache.gc();
```

See [Advanced topics](/docs/web-sdk-react/advanced#cache-eviction-after-mutations) for more.

---

## Sanitizing untrusted search input

`search.value` is passed to the server as a regex string. If it comes from user input, escape regex metacharacters first:

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
  // Narrowing
  status: "PUBLISHED",
  filter: { category: "engineering", featured: true },
  search: [{ field: "title", value: "edge", mode: "i" }],
  // Paging
  limit: 20,
  offset: 0,
  // Shape
  select: ["title", "slug", "publishedAt"],
});
```

---

## Comparison: filter vs. search

| | `filter` | `search` |
| --- | --- | --- |
| **Match type** | Exact equality | Regex pattern |
| **Values** | `string`, `number`, `boolean`, `null` | Regex string with mode flags |
| **Use case** | Category, status, boolean flags | Full-text search, partial matching |
| **Escaping** | Not needed | Required for untrusted input |
| **Performance** | Faster (direct comparison) | Slower (regex evaluation) |

---

## FAQ

**Can I filter by multiple values for the same field?**
Not directly — `filter` does exact equality. Use `search` with a regex like `"value1|value2"` for OR matching.

**Why does switching filters not reset pagination?**
Apollo caches each filter combination separately. Call `refetch()` or evict the cache on filter change for a clean slate.

**Can I use `filter` and `search` with `fetchCmsContent`?**
Yes. The same options work identically on the server.

**What if `search.value` is empty?**
An empty string matches everything. Check for empty input before adding it to the search array.
