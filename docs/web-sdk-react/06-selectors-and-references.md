---
title: Selectors and references
description: Pick fields, alias them, and pull related entries inline with the SDK's declarative select syntax — shared by useCmsContent, fetchCmsContent, and useCmsMutate.
order: 6
---

# Selectors and references

`select` is how you tell the SDK which fields to pull off an entry, and how deeply to expand related entries. The same syntax works in `useCmsContent`, `fetchCmsContent`, `useCmsMutate`, and `buildCmsQuery`.

A selector is one of:

- **String** — a plain field slug. Returned under the same key.
- **Aliased field** — `{ field, as }` to rename it on the result.
- **Reference expansion** — `{ field, select, single?, as? }` to pull related entries.

These compose recursively.

---

## Plain fields

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  select: ["title", "slug", "publishedAt"],
});
// → { title, slug, publishedAt }
```

The key in the result equals the field slug. Misspell a slug and you get `null`, not an error — the CMS doesn't know the difference.

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
// → { heading, date }
```

Use aliases to:

- Match an existing TypeScript shape without manual remapping.
- Disambiguate when two reference expansions would otherwise collide.
- Rename camelCase ↔ snake_case at the edge.

---

## Reference expansion: 1:1 (object)

A blog post that references a single author:

```tsx
useCmsContent({
  schema_slug: "blog-posts",
  entrySlug: slug,
  select: [
    "title",
    {
      field: "author",
      single: true,             // ← marks it as 1:1
      as: "writtenBy",
      select: ["name", "bio", "twitter"],
    },
  ],
});
```

`data.writtenBy` is an object (or `null`).

Internally this emits `expandedReferenceObject(slug: "author") { ... }`.

---

## Reference expansion: 1:N (array)

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
```

`data.tags` is `{ name, slug }[]`.

Internally this emits `expandedReference(slug: "tags") { ... }`.

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
```

A 5-level deep expansion is rarely the right call — see [Performance tips »](./11-advanced.md#performance-tips).

---

## `fullData`: skip the selection map

Want the raw JSON document for the entry (useful for admin views, debugging, or one-off scripts)? Set `fullData: true`. The result includes a `data` key alongside any selectors you provided.

```tsx
const { data } = useCmsContent<{ data: Record<string, unknown> }>({
  schema_slug: "blog-posts",
  entrySlug: slug,
  fullData: true,
});

console.log(data?.data);
```

Selectors and `fullData` can be combined — selectors are aliased onto the result, `data` contains everything.

> Prefer specific selectors over `fullData` for production reads. Each `dataField` call is cheaper for the server than serializing the whole document, and you ship less JSON over the wire.

---

## TypeScript: typing reference expansions

A clean way to keep your row type in sync with the selector tree:

```ts
type Author = { name: string; bio?: string };
type Tag    = { name: string; slug: string };

type Post = {
  title: string;
  writtenBy: Author | null;     // single: true
  tags: Tag[];                  // single: false (array)
};

useCmsContent<Post>({
  schema_slug: "blog-posts",
  entrySlug: slug,
  select: [
    "title",
    { field: "author", as: "writtenBy", single: true, select: ["name", "bio"] },
    { field: "tags",   select: ["name", "slug"] },
  ],
});
```

The SDK doesn't enforce that the selectors match the type — that's still on you. Treat the type as documentation of what the server should return.

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
useCmsContent<Post[]>({ schema_slug: "blog-posts", select: POST_LIST_SELECT });
```

Centralizing selectors keeps the wire payload identical between server-rendered pages and client-side rehydrations.

Continue to **[Filtering and search »](./07-filtering-and-search.md)**.
