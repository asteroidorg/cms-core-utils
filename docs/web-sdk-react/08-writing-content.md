---
title: Writing content
description: Create, update, and delete CMS entries from React with useCmsMutate and from the server with cmsMutate — plus patterns for cache invalidation and optimistic UI.
order: 8
---

# Writing content

The SDK provides two mutation APIs:

| Use this | When | Import from |
| --- | --- | --- |
| `useCmsMutate` | Client Components, interactive forms | `@asteroidcms/core-utils/client` |
| `cmsMutate` | Server Components, Route Handlers, webhooks, scripts | `@asteroidcms/core-utils` |

Both build a typed GraphQL mutation for `createContentEntry`, `updateContentEntry`, or `deleteContentEntry` and reuse the field selector syntax from [Selectors and references](/docs/web-sdk-react/selectors-and-references).

> **Security:** Write operations need a **write-scoped** API key. Do not ship a write key to the browser. For privileged writes, proxy through a server route — your Route Handler can use `cmsMutate` with a server-side key.

---

## Client-side: `useCmsMutate`

### API

```ts
useCmsMutate<TData = unknown>({
  schema_slug,           // required — target schema slug
  mutationType,          // "create" | "update" | "delete" (default: "create")
  entryId,               // required for "update" and "delete"
  select,                // fields returned after the mutation
  fullData,              // include the raw `data` blob in the result
  variables,             // initial variables; overridable per-call
}): {
  mutate: MutationFunction;
  loading: boolean;
  error: ApolloError | undefined;
  data: TData | undefined;
}
```

The returned `mutate` is Apollo's mutation function — call it to fire the request.

### Create

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
      <button disabled={loading}>{loading ? "Saving..." : "Create"}</button>
      {error && <p>{error.message}</p>}
      {data && <p>Created: {data.title}</p>}
    </form>
  );
}
```

The hook always includes `id`, `status`, `version`, `created_at`, `updated_at`, and the entry's `schema { id, slug }` in the response. Your `select` adds to that base set.

### Update

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
      // omitted fields are left untouched
    },
  },
});
```

`data` is a partial patch. To clear a field, pass `null` explicitly (`{ subtitle: null }`).

### Delete

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

No `data` variable is sent for deletes.

---

## Server-side: `cmsMutate`

`cmsMutate` is the async counterpart for server contexts. It accepts a `getClient` function (same as `fetchCmsContent`) and returns the mutation result directly.

```ts
import { cmsMutate } from "@asteroidcms/core-utils";
import { getClient } from "@/app/lib/cms-server";

// Create
const entry = await cmsMutate<{ id: string }>(getClient, {
  schema_slug: "newsletter_subscribers",
  mutationType: "create",
  variables: { data: { email: "user@example.com", name: "Alice" } },
});

// Update
await cmsMutate(getClient, {
  schema_slug: "blog-posts",
  mutationType: "update",
  entryId: "abc123",
  variables: { data: { title: "Updated title" } },
});

// Delete
await cmsMutate(getClient, {
  schema_slug: "comments",
  mutationType: "delete",
  entryId: "xyz789",
});
```

`cmsMutate` supports the same `select`, `fullData`, and selector syntax as `useCmsMutate`.

---

## Refreshing reads after a write

The CMS doesn't know which `useCmsContent` queries depend on the mutated entry. You have three options:

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

### 3. Optimistic response + cache update

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

## `useCmsMutate` vs. `cmsMutate`

| | `useCmsMutate` | `cmsMutate` |
| --- | --- | --- |
| **Runtime** | Client (React) | Server (Node) |
| **Returns** | `{ mutate, loading, error, data }` | `Promise<T>` |
| **Apollo integration** | Full hooks, cache updates, optimistic UI | Direct call, no cache |
| **API key scope** | Read or write (browser) | Write-scoped (server) |
| **Import** | `@asteroidcms/core-utils/client` | `@asteroidcms/core-utils` |

---

## Handling errors

### App-wide error handling

```tsx
<AsteroidCMSProvider
  cmsUrl={url}
  apiKey={key}
  onError={(err) => toast.error(extractMessage(err))}
>
  ...
</AsteroidCMSProvider>
```

### Per-call handling

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

Apollo exposes `error.graphQLErrors` for structured server-side validation messages.

---

## `buildCmsMutation`: build mutations without executing them

`buildCmsMutation` is the pure function that powers `useCmsMutate` and `cmsMutate`. Use it when you need the GraphQL document and variables but want to execute through your own pipeline.

```ts
import { buildCmsMutation } from "@asteroidcms/core-utils";

const { mutation, variables } = buildCmsMutation({
  schema_slug: "blog-posts",
  mutationType: "create",
  select: ["title", "slug"],
  variables: { data: { title: "Hello", slug: "hello" } },
});

// Execute with your own client
const { data } = await apolloClient.mutate({ mutation, variables });
```

---

## Caveats

| Issue | Details |
| --- | --- |
| `mutationType` can't change mid-mutation | Switch types between calls, not during a single `mutate()` lifecycle. |
| No built-in optimistic UI | Use Apollo's `optimisticResponse` — the SDK doesn't ship a higher-level wrapper. |
| Mutation name is schema-slug derived | `refetchQueries: ["GetblogpostsEntries"]` matches slug `blog-posts`. Hyphens are kept. |
| `entryId` is the entry's ID, not its slug | Slugs may collide across schemas; IDs never do. |
| Hooks live on `/client` | Importing `useCmsMutate` from the root path will fail. |

---

## FAQ

**Can I do mutations from a Server Component directly?**
No. Server Components can't call `useCmsMutate` (it's a hook). Use `cmsMutate` in a Route Handler or Server Action instead.

**What does the base response include?**
Every mutation response includes `id`, `status`, `version`, `created_at`, `updated_at`, and `schema { id, slug }` — plus any fields from your `select`.

**How do I clear a field?**
Pass `null` explicitly in the `data` object: `{ subtitle: null }`. Omitting a field leaves it untouched.

**Can I use `cmsMutate` outside Next.js?**
Yes. Pass any `() => { mutate: (...) => ... }` — the function just needs to expose a `mutate` method compatible with Apollo's signature.
