---
title: Next.js server rendering
description: Fetch CMS content in Next.js Server Components, Route Handlers, and generateStaticParams using fetchCmsContent and a registered Apollo client.
order: 4
---

# Next.js server rendering

`fetchCmsContent` is the non-React equivalent of `useCmsContent`. It lives in the **server-safe** entry point and runs anywhere Node runs:

- React Server Components
- Route Handlers / API routes
- `generateStaticParams`, `generateMetadata`
- Cron jobs, build scripts, sitemap generators

It accepts the same options object as `useCmsContent` and returns a `Promise` resolving to the entry (or list).

---

## Setup: register an Apollo client

Server fetches need a server-side Apollo client. Use `registerApolloClient` from `@apollo/client-integration-nextjs` to build a per-request, deduplicated client. Put this in one shared file:

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
      // Optional: let Next.js handle revalidation/tagging.
      fetchOptions: { next: { revalidate: 60, tags: ["cms"] } },
    }),
  });
});
```

`import "server-only"` makes the file fail loudly if a client component ever imports it.

> A server-side API key can be **write-scoped**. The header never reaches the browser.

---

## Fetch a single entry

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

`fetchCmsContent` unwraps the GraphQL envelope — you get the entry directly, not `{ data: { entry: … } }`.

---

## Fetch a list

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

The same `filter`, `search`, `limit`, `offset`, and `status` options from `useCmsContent` work here — see [Filtering and search »](./07-filtering-and-search.md).

---

## `generateStaticParams`

```ts
import { fetchCmsContent } from "@asteroidcms/core-utils";
import { getClient } from "@/app/lib/cms-server";

export async function generateStaticParams() {
  const posts = await fetchCmsContent<{ slug: string }[]>(getClient, {
    schema_slug: "blog-posts",
    limit: 1000,
    select: ["slug"],
  });
  return posts.map((p) => ({ slug: p.slug }));
}
```

---

## `generateMetadata`

```ts
import type { Metadata } from "next";
import { fetchCmsContent } from "@asteroidcms/core-utils";
import { getClient } from "@/app/lib/cms-server";

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

The parser side of rich text is server-safe — import `parseRichText` or `<RichTextContent>` from the appropriate entry:

```tsx
import { fetchCmsContent } from "@asteroidcms/core-utils";
import { RichTextContent } from "@asteroidcms/core-utils/client";
import { getClient } from "@/app/lib/cms-server";

export default async function Page() {
  const post = await fetchCmsContent<{ body: string }>(getClient, {
    schema_slug: "blog-posts",
    entrySlug: "hello",
    select: ["body"],
  });

  return <RichTextContent html={post.body} as="article" />;
}
```

`<RichTextContent>` itself is a client component (it runs highlight.js after mount), but it's safe to render from a Server Component — Next.js will ship the necessary JS automatically.

If you don't need syntax highlighting on the client, use the pure parser instead:

```tsx
import { parseRichText } from "@asteroidcms/core-utils";

const html = parseRichText(post.body, { classMap: { p: "my-3" } });
return <article dangerouslySetInnerHTML={{ __html: html }} />;
```

That keeps the page fully static — no highlight.js shipped to the client.

---

## Combining with client-side hooks

Both flows can coexist. A common pattern:

- Server-render the article body (`fetchCmsContent` + `<RichTextContent>`).
- Mount an interactive comments widget under `<AsteroidCMSProvider>` that uses `useCmsContent` to subscribe to live updates.

The two caches are independent — there's no shared store between the server's per-request Apollo client and the browser's `<AsteroidCMSProvider>` cache.

Continue to **[Reading content »](./05-reading-content.md)**.
