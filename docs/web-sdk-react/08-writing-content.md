---
title: Writing content
description: Create, update, and delete CMS entries from React with useCmsMutate — plus patterns for refreshing related reads, optimistic UI, and cache invalidation.
order: 8
---

# Writing content

`useCmsMutate` is the mutation counterpart to `useCmsContent`. It builds a typed GraphQL mutation for `createContentEntry`, `updateContentEntry`, or `deleteContentEntry`, returns the same `[mutate, result]` surface as Apollo's `useMutation`, and reuses the field selector syntax from [Selectors and references »](./06-selectors-and-references.md).

It lives on the **client** subpath:

```ts
import { useCmsMutate } from "@asteroidcms/core-utils/client";
```

> Write operations need a **write-scoped** API key. Do not ship a write key to the browser. For privileged writes, proxy through a server route — your Next.js Route Handler can use `fetchCmsContent` or call Apollo directly with a server-side key.

---

## API

```ts
useCmsMutate<TData = unknown>({
  schema_slug,           // required: target schema slug
  mutationType,          // "create" | "update" | "delete" (default: "create")
  entryId,               // required for "update" and "delete"
  select,                // selection returned after the mutation
  fullData,              // also include the raw `data` blob in the result
  variables,             // initial variables; overridable per-call
}): { mutate, loading, error, data: TData | undefined, ... }
```

The returned `mutate` is Apollo's mutation function — call it to fire the request, optionally with per-call `variables`.

---

## Create

```tsx
"use client";

import { useCmsMutate } from "@asteroidcms/core-utils/client";

type Post = { id: string; slug: string; title: string };

export function NewPostForm() {
  const { mutate, loading, error, data } = useCmsMutate<Post>({
    schema_slug: "blog-posts",
    mutationType: "create",
    select: ["title", "slug"],
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    await mutate({
      variables: {
        data: {
          title: form.get("title"),
          slug: form.get("slug"),
          body: form.get("body"),
        },
      },
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="title" required />
      <input name="slug" required />
      <textarea name="body" />
      <button disabled={loading}>{loading ? "Saving…" : "Create"}</button>
      {error && <p>{error.message}</p>}
      {data && <p>Created: {data.title}</p>}
    </form>
  );
}
```

The hook always includes `id`, `status`, `version`, `created_at`, `updated_at`, and the entry's `schema { id, slug }` in the response. Your `select` adds to that base set.

---

## Update

Updates require the entry's `id` (not its slug):

```tsx
const { mutate, loading } = useCmsMutate({
  schema_slug: "blog-posts",
  mutationType: "update",
  entryId: post.id,
  select: ["title", "body"],
});

await mutate({
  variables: {
    data: {
      title: "Edited title",
      // any fields you omit are left untouched
    },
  },
});
```

`data` is a partial patch. To clear a field, pass `null` explicitly (`{ subtitle: null }`).

> The hook prints a console warning if you call `mutate` for `update`/`delete` without `entryId`. The server will reject the request — it does not surface a friendlier error on its own.

---

## Delete

```tsx
const { mutate, loading } = useCmsMutate({
  schema_slug: "blog-posts",
  mutationType: "delete",
  entryId: post.id,
});

async function onDelete() {
  if (!confirm("Delete this post?")) return;
  await mutate();
}
```

No `data` variable is sent for deletes — Apollo will ignore an extra `variables.data` if you pass it.

---

## Refreshing reads after a write

The CMS doesn't know which of your `useCmsContent` queries depend on the mutated entry. You have three options.

### 1. Refetch the affected queries

```tsx
const list = useCmsContent({ schema_slug: "blog-posts", select: ["title", "slug"] });

const { mutate } = useCmsMutate({
  schema_slug: "blog-posts",
  mutationType: "create",
});

await mutate({ variables: { data: { title: "Hi" } } });
await list.refetch();
```

### 2. Use Apollo's `refetchQueries`

```tsx
await mutate({
  variables: { data: { title: "Hi" } },
  refetchQueries: ["GetblogpostsEntries"],
});
```

Query names are generated as `Get{schema_slug}Entries` (list) and `Get{schema_slug}Entry` (single). The schema slug is interpolated verbatim — no kebab→camel conversion.

### 3. Update the cache directly

For low-latency UX, pair `optimisticResponse` with an `update` function:

```tsx
await mutate({
  variables: { data: { title: "Untitled" } },
  optimisticResponse: {
    result: {
      __typename: "ContentEntry",
      id: "temp-id",
      status: "DRAFT",
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      schema: { id: "tmp", slug: "blog-posts" },
      title: "Untitled",
    },
  },
  update(cache, { data }) {
    // patch the list query in cache here
  },
});
```

Optimistic responses unblock the UI instantly; if the server rejects, Apollo rolls back.

---

## Selecting nested data after a mutation

The same selector syntax from `useCmsContent` works here:

```tsx
useCmsMutate({
  schema_slug: "blog-posts",
  mutationType: "update",
  entryId,
  select: [
    "title",
    { field: "author", single: true, select: ["name", "avatar"] },
  ],
});
```

After the mutation succeeds, `data.author` is populated by re-resolving the expansion against the saved entry.

---

## `fullData` on writes

Useful for forms that re-hydrate from the server's canonical version after save:

```tsx
const { mutate, data } = useCmsMutate<{ id: string; data: Record<string, unknown> }>({
  schema_slug: "blog-posts",
  mutationType: "update",
  entryId,
  fullData: true,
});

useEffect(() => {
  if (data) setFormState(data.data);
}, [data]);
```

---

## Handling errors

`useCmsMutate` returns the same `error` field as `useMutation`. For app-wide error handling, wire the provider's `onError`:

```tsx
<AsteroidCMSProvider
  cmsUrl={url}
  apiKey={key}
  onError={(err) => toast.error(extractMessage(err))}
>
  …
</AsteroidCMSProvider>
```

Per-call handling stays local:

```tsx
try {
  await mutate({ variables: { data } });
} catch (err) {
  // network error or thrown rejection
}
if (result.error) {
  // GraphQL errors (e.g. validation)
}
```

Apollo also exposes `error.graphQLErrors` for structured server-side validation messages.

---

## Caveats

- **`mutationType` cannot change mid-mutation.** Switch types between calls, not during a single `mutate()` lifecycle.
- **No built-in optimistic UI.** Use Apollo's `optimisticResponse` — the SDK doesn't ship a higher-level wrapper.
- **The mutation name is schema-slug derived.** `refetchQueries: ["GetblogpostsEntries"]` matches the slug `blog-posts`. Hyphens are kept.
- **`entryId` is the entry's id, not its slug.** Slugs may collide across schemas; ids never do.
- **Hooks live on `/client`.** Importing `useCmsMutate` from the root path will fail; use `@asteroidcms/core-utils/client`.

Continue to **[Images »](./09-images.md)**.
