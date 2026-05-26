---
title: Selectors and references
description: Pick fields, alias them, and expand related entries with the SDK's declarative select syntax — shared by all read and write APIs.
order: 6
---

# Selectors and references

`select` is how you tell the SDK which fields to pull off an entry and how deeply to expand related entries. The same syntax works in `useCmsContent`, `fetchCmsContent`, `useCmsMutate`, `cmsMutate`, `buildCmsQuery`, and `buildCmsMutation`.

A selector is one of:

| Type | Example | What it does |
| --- | --- | --- |
| **String** | `"title"` | Plain field slug. Returned under the same key. |
| **Aliased field** | `{ field: "title", as: "heading" }` | Renames the field on the result. |
| **Reference expansion** | `{ field: "author", single: true, select: [...] }` | Pulls related entries inline. |

These compose recursively — expansions can contain expansions.

---

## Plain fields

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  select: ["title", "slug", "publishedAt"],
});
// Result: { title, slug, publishedAt }
```

The key in the result equals the field slug. Misspell a slug and you get `null`, not an error — the CMS doesn't validate field names at query time.

---

## Aliased fields

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  select: [
    { field: "title", as: "heading" },
    { field: "publishedAt", as: "date" },
  ],
});
// Result: { heading, date }
```

Use aliases to:

- Match an existing TypeScript shape without manual remapping.
- Disambiguate when two reference expansions would otherwise collide.
- Rename camelCase ↔ snake_case at the edge.

---

## Reference expansion

### 1:1 (object)

A blog post that references a single author:

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  entrySlug: slug,
  select: [
    "title",
    {
      field: "author",
      single: true,             // marks it as 1:1
      as: "writtenBy",
      select: ["name", "bio", "twitter"],
    },
  ],
});
// Result: { title, writtenBy: { name, bio, twitter } | null }
```

`single: true` means the result is an object (or `null`). Internally this emits `expandedReferenceObject(slug: "author") { ... }`.

### 1:N (array)

A blog post tagged with multiple categories:

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  entrySlug: slug,
  select: [
    "title",
    {
      field: "tags",            // omit `single` → array
      select: ["name", "slug"],
    },
  ],
});
// Result: { title, tags: [{ name, slug }, ...] }
```

Omitting `single` (or setting it to `false`) returns an array. Internally this emits `expandedReference(slug: "tags") { ... }`.

---

## Nested expansion

References can expand references — there's no SDK-imposed depth limit (the server may apply one):

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  entrySlug: slug,
  select: [
    "title",
    {
      field: "author",
      single: true,
      select: [
        "name",
        {
          field: "team",
          single: true,
          select: ["name", "slug"],
        },
      ],
    },
  ],
});
// Result: { title, author: { name, team: { name, slug } } }
```

> **Performance note:** Each expansion level adds resolver cost on the server. A 5-level deep expansion is rarely worth it — consider a denormalized field instead.

---

## `fullData`: skip the selection map

Want the raw JSON document for the entry? Set `fullData: true`:

```tsx
const { data } = useCmsContent<{ data: Record<string, unknown> }>({
  schema_slug: "blog-posts",
  entrySlug: slug,
  fullData: true,
});

console.log(data?.data);
```

Selectors and `fullData` can be combined — selectors are aliased onto the result, `data` contains everything.

> Prefer specific selectors over `fullData` for production reads. Each `dataField` call is cheaper for the server than serializing the whole document.

---

## Comparison: `select` vs. `fullData`

| | `select` | `fullData` |
| --- | --- | --- |
| **Payload size** | Only requested fields | Entire document |
| **Type safety** | Fields match your type | `Record<string, unknown>` |
| **Performance** | Faster — fewer fields resolved | Slower — full serialization |
| **Best for** | Production reads | Admin views, debugging, scripts |

---

## TypeScript: typing reference expansions

Keep your row type in sync with the selector tree:

```ts
type Author = { name: string; bio?: string };
type Tag = { name: string; slug: string };

type Post = {
  title: string;
  writtenBy: Author | null;     // single: true
  tags: Tag[];                  // no single → array
};

useCmsContent<Post>({
  schema_slug: "blog-posts",
  entrySlug: slug,
  select: [
    "title",
    { field: "author", as: "writtenBy", single: true, select: ["name", "bio"] },
    { field: "tags", select: ["name", "slug"] },
  ],
});
```

The SDK doesn't enforce that selectors match the type — treat the type as documentation of what the server should return.

---

## Reusing selectors

Selectors are plain arrays — share them across calls or modules:

```ts
import type { UseCmsContentOptions } from "@asteroidcms/core-utils";

export const POST_LIST_SELECT: NonNullable<UseCmsContentOptions["select"]> = [
  "slug",
  "title",
  "description",
  { field: "author", single: true, select: ["name", "avatar"] },
] as const;
```

Then drop them into multiple hooks/fetches:

```tsx
// Client-side
useCmsContent<Post[]>({ schema_slug: "blog-posts", select: POST_LIST_SELECT });

// Server-side
await fetchCmsContent<Post[]>(getClient, {
  schema_slug: "blog-posts",
  select: POST_LIST_SELECT,
});
```

Centralizing selectors keeps the wire payload identical between server-rendered pages and client-side rehydrations.

---

## FAQ

**What happens if I misspell a field name in `select`?**
You get `null` for that field. The CMS doesn't validate field names at query time, so there's no build error — just a silent `null`.

**Can I use `select` with `useCmsMutate` and `cmsMutate`?**
Yes. The same selector syntax works for mutation return values. After the mutation succeeds, the selected fields are populated from the saved entry.

**Is there a depth limit for nested expansions?**
The SDK has no limit, but the server may impose one. In practice, 2–3 levels is the sweet spot.
