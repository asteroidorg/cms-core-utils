---
title: Next.js server rendering
description: Fetch and mutate CMS content in Next.js Server Components, Route Handlers, and generateStaticParams using fetchCmsContent, cmsMutate, and a registered Apollo client.
order: 4
---

# Next.js server rendering

The SDK provides two server-side helpers that mirror the client hooks:

| Helper | Purpose | Client equivalent |
| --- | --- | --- |
| `fetchCmsContent` | Read entries | `useCmsContent` |
| `cmsMutate` | Create / update / delete entries | `useCmsMutate` |

Both live in the **server-safe** entry point (`@asteroidcms/core-utils`) and work anywhere Node runs:

- React Server Components
- Route Handlers / API routes
- `generateStaticParams`, `generateMetadata`
- Cron jobs, build scripts, sitemap generators

---

## Setup: register an Apollo client

Server fetches need a server-side Apollo client. Use `registerApolloClient` from `@apollo/client-integration-nextjs` to build a per-request, deduplicated client:

```ts
// app/lib/cms-server.ts
import "server-only";
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { registerApolloClient } from "@apollo/client-integration-nextjs";

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: `${process.env.CMS_API_BASE_URL}/graphql`,
      headers: { "x-api-key": process.env.CMS_API_KEY ?? "" },
      fetchOptions: { next: { revalidate: 60, tags: ["cms"] } },
    }),
  });
});
```

`import "server-only"` makes the file fail loudly if a client component ever imports it.

> A server-side API key can be **write-scoped**. The header never reaches the browser.

---

## Reading content

### Fetch a single entry

```tsx
// app/blog/[slug]/page.tsx
import { fetchCmsContent } from "@asteroidcms/core-utils";
import { getClient } from "@/app/lib/cms-server";

type Post = { title: string; body: string };

export default async function Page({ params }: { params: { slug: string } }) {
  const post = await fetchCmsContent<Post>(getClient, {
    schema_slug: "blog-posts",
    entrySlug: params.slug,
    select: ["title", "body"],
  });

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
```

`fetchCmsContent` unwraps the GraphQL envelope — you get the entry directly, not `{ data: { entry: ... } }`.

### Fetch a list

```ts
const posts = await fetchCmsContent<{ slug: string; title: string }[]>(
  getClient,
  {
    schema_slug: "blog-posts",
    limit: 20,
    status: "PUBLISHED",
    select: ["slug", "title"],
  },
);
```

The same `filter`, `search`, `limit`, `offset`, and `status` options from `useCmsContent` work here — see [Filtering and search](/docs/web-sdk-react/filtering-and-search).

### `generateStaticParams`

```ts
export async function generateStaticParams() {
  const posts = await fetchCmsContent<{ slug: string }[]>(getClient, {
    schema_slug: "blog-posts",
    limit: 1000,
    select: ["slug"],
  });
  return posts.map((p) => ({ slug: p.slug }));
}
```

### `generateMetadata`

```ts
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await fetchCmsContent<{ title: string; description?: string }>(
    getClient,
    {
      schema_slug: "blog-posts",
      entrySlug: params.slug,
      select: ["title", "description"],
    },
  );
  return { title: post.title, description: post.description };
}
```

---

## Writing content from the server

`cmsMutate` is the server-side counterpart to `useCmsMutate`. Use it in Route Handlers, webhooks, or any server context that needs to create, update, or delete entries.

### Create an entry

```ts
// app/api/newsletter/route.ts
import { cmsMutate } from "@asteroidcms/core-utils";
import { getClient } from "@/app/lib/cms-server";

export async function POST(req: Request) {
  const { email, name } = await req.json();

  const result = await cmsMutate<{ id: string }>(getClient, {
    schema_slug: "newsletter_subscribers",
    mutationType: "create",
    variables: { data: { email, name } },
  });

  return Response.json({ id: result.id });
}
```

### Update an entry

```ts
await cmsMutate(getClient, {
  schema_slug: "blog-posts",
  mutationType: "update",
  entryId: "abc123",
  variables: { data: { title: "Updated title" } },
  select: ["title", "slug"],
});
```

### Delete an entry

```ts
await cmsMutate(getClient, {
  schema_slug: "comments",
  mutationType: "delete",
  entryId: "xyz789",
});
```

> `cmsMutate` supports the same `select`, `fullData`, and selector syntax as `useCmsMutate`. See [Writing content](/docs/web-sdk-react/writing-content) for the full API.

---

## Revalidation strategies

### Time-based (ISR)

Set `next.revalidate` on the `HttpLink` (see the setup snippet above), or wrap individual calls with `unstable_cache`:

```ts
import { unstable_cache } from "next/cache";

const getPost = unstable_cache(
  (slug: string) =>
    fetchCmsContent<Post>(getClient, {
      schema_slug: "blog-posts",
      entrySlug: slug,
      select: ["title", "body"],
    }),
  ["cms-post"],
  { revalidate: 60, tags: ["cms:blog-posts"] },
);
```

### On-demand

Tag fetches at the link level (`tags: ["cms"]`) or per-call (`tags: ["cms:blog-posts"]`). Trigger refreshes from a webhook:

```ts
// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache";

export async function POST(req: Request) {
  const { tag } = await req.json();
  revalidateTag(tag);
  return Response.json({ ok: true });
}
```

---

## Render rich text on the server

The parser is server-safe — use `parseRichText` for fully static pages, or `<RichTextContent>` when you want client-side syntax highlighting:

```tsx
// Fully static (no JS shipped for this component)
import { parseRichText } from "@asteroidcms/core-utils";

const html = parseRichText(post.body, { classMap: { p: "my-3" } });
return <article dangerouslySetInnerHTML={{ __html: html }} />;
```

```tsx
// With highlight.js (JS shipped automatically by Next.js)
import { RichTextContent } from "@asteroidcms/core-utils/client";

return <RichTextContent html={post.body} as="article" />;
```

---

## Combining server and client

Both flows coexist naturally. A common pattern:

- Server-render the article body (`fetchCmsContent` + `<RichTextContent>`).
- Mount an interactive comments widget under `<AsteroidCMSProvider>` that uses `useCmsContent` for live updates and `useCmsMutate` to post new comments.

The two caches are independent — there's no shared store between the server's per-request Apollo client and the browser's provider cache.

---

## fetchCmsContent vs. cmsMutate

| | `fetchCmsContent` | `cmsMutate` |
| --- | --- | --- |
| **Purpose** | Read entries | Create / update / delete entries |
| **Signature** | `fetchCmsContent<T>(getClient, opts)` | `cmsMutate<T>(getClient, opts)` |
| **Returns** | The entry or array directly | The mutation result |
| **API key scope** | Read is enough | Needs write scope |
| **Caching** | Works with ISR / `unstable_cache` | Not cacheable (side effect) |

---

## FAQ

**Can I use `fetchCmsContent` outside Next.js?**
Yes. Pass any `() => ApolloClient` — e.g. `() => createApolloClient({ cmsUrl, apiKey })`. The `@apollo/client-integration-nextjs` bridge is only needed for per-request deduplication in Next.js.

**Should I add `import "server-only"` to every file that uses `fetchCmsContent`?**
Add it to the file that creates the Apollo client (the one with the write-scoped key). That's the security boundary. Individual page files don't need it unless they handle secrets directly.

**Can `cmsMutate` trigger revalidation?**
Not directly. Call `revalidateTag(...)` after the mutation in the same Route Handler to invalidate cached reads.
