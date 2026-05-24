<div align="center">
  <h1>
    <div style="display: inline-flex; align-items: center; gap: 4px;">
      <img src="https://cms.theasteroid.tech/logo/logo_gradient.svg" alt="@asteroidcms" height="25px" />
      <span>/core-utils</span>
    </div>
  </h1>
  <p>Seamless integration utilities for <a href="https://cms.theasteroid.tech">Asteroid CMS</a> - a single React provider, Apollo client, content hooks, media helpers, and a rich-text renderer.</p>
</div>

- **Provider-driven** - configure `cmsUrl`, `apiKey`, and Apollo behavior in one place
- **API-key auth only** - sends `x-api-key` on every request, nothing else
- **Typed hooks** - `useCmsContent` / `useCmsMutate` build GraphQL on the fly from a declarative selection
- **Tree-shakeable** - ESM + CJS + types, `@apollo/client`/`react` as peer deps

---

## Install

```bash
npm install @asteroidcms/core-utils @apollo/client graphql react react-dom
```

```bash
npm install @apollo/client-integration-nextjs # for nextjs (optional)
```

`@apollo/client`, `graphql`, `react`, and `react-dom` are peer dependencies.

---

## Quick start

Wrap your app once:

```tsx
import { AsteroidCMSProvider } from "@asteroidcms/core-utils";

export function Root() {
  return (
    <AsteroidCMSProvider
      cmsUrl="https://cms-api.example.com"
      apiKey={import.meta.env.VITE_CMS_API_KEY}
    >
      <App />
    </AsteroidCMSProvider>
  );
}
```

Then use the hooks anywhere:

```tsx
import { useCmsContent, useCmsImage } from "@asteroidcms/core-utils";

function NewsList() {
  const cmsImage = useCmsImage();
  const { data, loading } = useCmsContent<Article[]>({
    schema_slug: "news",
    limit: 10,
    status: "PUBLISHED",
    select: ["title", "slug", "publish_date", "cover_image"],
  });

  if (loading) return <p>Loading…</p>;
  return (
    <ul>
      {data?.map((a) => (
        <li key={a.slug}>
          <img src={cmsImage(a.cover_image)} alt="" />
          <a href={`/news/${a.slug}`}>{a.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

---

## `<AsteroidCMSProvider>`

| Prop            | Type                           | Required | Default            | Description                                                  |
| --------------- | ------------------------------ | -------- | ------------------ | ------------------------------------------------------------ |
| `cmsUrl`        | `string`                       | ✓        | -                  | Base URL of the Asteroid CMS API.                            |
| `apiKey`        | `string`                       | ✓        | -                  | Sent on every request as the `x-api-key` header.             |
| `graphqlPath`   | `string`                       |          | `/graphql`         | Path appended to `cmsUrl` for the GraphQL endpoint.          |
| `mediaPath`     | `string`                       |          | `/media/canonical` | Path used by `cmsImage` / `useCmsImage`.                     |
| `headers`       | `Record<string, string>`       |          | `{}`               | Extra headers merged onto every GraphQL request.             |
| `onError`       | `(error: unknown) => void`     |          | -                  | Called for each GraphQL / network / protocol error.          |
| `cacheConfig`   | `InMemoryCacheConfig`          |          | -                  | Forwarded to `new InMemoryCache(...)` - e.g. `typePolicies`. |
| `apolloOptions` | `Partial<ApolloClientOptions>` |          | -                  | Escape hatch - overrides any field on the Apollo client.     |
| `client`        | `ApolloClient`                 |          | -                  | Bring your own pre-built client; skips the internal factory. |

Example with everything wired:

```tsx
<AsteroidCMSProvider
  cmsUrl="https://cms-api.example.com"
  apiKey={process.env.NEXT_PUBLIC_CMS_API_KEY!}
  headers={{ "x-tenant": "acme" }}
  onError={(err) => toast.error(String((err as Error).message ?? err))}
  cacheConfig={{
    typePolicies: {
      Query: {
        fields: { contentEntries: { keyArgs: ["schema_slug", "filter"] } },
      },
    },
  }}
>
  <App />
</AsteroidCMSProvider>
```

---

## `useCmsContent`

React hook for **querying** content. Builds a GraphQL document from a declarative selection.

```ts
const { data, loading, error, refetch } = useCmsContent<T>({
  schema_slug, // required
  entrySlug, // when set → single entry, otherwise list
  select, // fields / nested references
  fullData, // include raw `data` object
  limit,
  offset, // list pagination
  status, // "DRAFT" | "PUBLISHED" | "ARCHIVED"
  filter, // { category: "politics", region: "bagmati" }
  search, // [{ field: "title", value: "gagan", mode: "i" }]
});
```

### Single entry

```tsx
const { data: article } = useCmsContent({
  schema_slug: "news",
  entrySlug: "police-launch-probe",
  fullData: true,
});
```

### Paginated + filtered list

```tsx
const { data: politics } = useCmsContent({
  schema_slug: "news",
  limit: 20,
  offset: 0,
  status: "PUBLISHED",
  filter: { category: "politics" },
  select: ["title", "slug", "publish_date"],
});
```

### Regex search

```tsx
const { data: matches } = useCmsContent({
  schema_slug: "news",
  search: [{ field: "title", value: "gagan", mode: "i" }],
  select: ["title", "slug"],
});
```

### Deeply nested references with aliasing

```tsx
const { data: topStories } = useCmsContent({
  schema_slug: "top_stories",
  select: [
    { field: "slug", as: "id" },
    "order",
    {
      field: "news",
      single: true,
      as: "featuredNews",
      select: [
        "title",
        "publish_date",
        {
          field: "category",
          single: true,
          select: [{ field: "title", as: "categoryName" }],
        },
        { field: "author", single: true, select: ["name", "avatar"] },
      ],
    },
  ],
});
// → topStories[0].featuredNews.categoryName
```

---

## `fetchCmsContent` (Next.js / RSC)

Server-side counterpart to `useCmsContent`. Use it in Next.js Server Components, route handlers, or any other server context. Accepts a server-side Apollo client plus the same options object as `useCmsContent`, and returns the resolved data directly.

Pass a `getClient` function that returns a server-side Apollo client. The shape matches what `registerApolloClient` from `@apollo/client-integration-nextjs` already returns, so you can hand it through directly.

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
      headers: { "X-API-Key": process.env.CMS_X_API_KEY ?? "" },
      fetchOptions: { next: { revalidate: 60, tags: ["cms:landing_page"] } },
    }),
  });
});
```

```ts
// app/news/[slug]/page.tsx
import { fetchCmsContent } from "@asteroidcms/core-utils";
import { getClient } from "@/app/lib/cms-server";

// Single entry
const article = await fetchCmsContent<Article>(getClient, {
  schema_slug: "news",
  entrySlug: params.slug,
  fullData: true,
});

// List
const articles = await fetchCmsContent<Article[]>(getClient, {
  schema_slug: "news",
  limit: 10,
  status: "PUBLISHED",
  select: ["title", "slug", "publish_date"],
});
```

Outside Next.js you can pass any `() => ApolloClient` - e.g. `() => createApolloClient({ cmsUrl, apiKey })`.

Add `import "server-only"` in the file that calls it if you want Next.js to fail the build when it leaks into a client component.

---

## `buildCmsQuery`

Lower-level helper that turns a declarative selection into a GraphQL `DocumentNode` plus variables. Used internally by `useCmsContent` and `fetchCmsContent`; exported so you can drive your own Apollo calls (cache reads, prefetching, batching, etc.).

```ts
import { buildCmsQuery } from "@asteroidcms/core-utils";

const { query, variables, isSingle } = buildCmsQuery({
  schema_slug: "news",
  limit: 10,
  status: "PUBLISHED",
  select: ["title", "slug"],
});

const { data } = await apolloClient.query({ query, variables });
const entries = isSingle ? data.entry : data.entries;
```

---

## `useCmsMutate`

`create` / `update` / `delete` against a schema, with the same selection syntax.

### Create

```tsx
const { mutate: subscribe } = useCmsMutate({
  schema_slug: "news_letter_response",
  mutationType: "create",
});

subscribe({
  variables: { data: { email: "a@b.com", name: "Abhishek" } },
});
```

### Update

```tsx
const { mutate: updateArticle } = useCmsMutate({
  schema_slug: "news",
  mutationType: "update",
  entryId: "abc123",
  select: ["title", "slug"],
});

updateArticle({ variables: { data: { title: "New title" } } });
```

### Delete

```tsx
const { mutate: removeComment } = useCmsMutate({
  schema_slug: "comment",
  mutationType: "delete",
  entryId: "xyz789",
});

removeComment();
```

---

## `cmsImage` / `useCmsImage`

Build a canonical media URL for an asset id.

```tsx
// Inside React - preferred
const cmsImage = useCmsImage();
<img src={cmsImage(article.cover_image)} alt="" />;

// Outside React (loaders, scripts, SSR)
import { cmsImage } from "@asteroidcms/core-utils";
cmsImage(id, { cmsUrl: "https://cms-api.example.com" });
```

---

## `getContentReadTime`

Estimate reading time for a string of content (plain text or HTML). Strips tags, decodes common entities, counts words, and formats the result.

```ts
import { getContentReadTime } from "@asteroidcms/core-utils";

getContentReadTime(article.body);
// "3 min read"

getContentReadTime(article.body, {
  wordsPerMinute: 220,
  format: "long",
  round: "round",
  minMinutes: 1,
});
// "3 minutes read"
```

| Option           | Type                            | Default   | Description                                       |
| ---------------- | ------------------------------- | --------- | ------------------------------------------------- |
| `wordsPerMinute` | `number`                        | `200`     | Average reading speed.                            |
| `format`         | `"short" \| "long"`             | `"short"` | `"3 min read"` vs `"3 minutes read"`.             |
| `round`          | `"ceil" \| "round" \| "floor"`  | `"ceil"`  | How fractional minutes are rounded.               |
| `minMinutes`     | `number`                        | `1`       | Floor for the returned value.                     |

---

## `<RichTextContent>`

Render Asteroid CMS rich-text JSON/HTML with syntax-highlighted code blocks (via `highlight.js`).

```tsx
import { RichTextContent } from "@asteroidcms/core-utils";

<RichTextContent
  content={article.body}
  classMap={{ p: "my-2 leading-relaxed", h2: "text-2xl font-bold" }}
/>;
```

Or use the parser directly:

```ts
import { parseRichText } from "@asteroidcms/core-utils";

const html = parseRichText(article.body, {
  classMap: {
    /* ... */
  },
});
```

---

## Advanced - bring your own Apollo client

```tsx
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { AsteroidCMSProvider } from "@asteroidcms/core-utils";

const client = new ApolloClient({ uri: "...", cache: new InMemoryCache() });

<AsteroidCMSProvider cmsUrl="..." apiKey="..." client={client}>
  <App />
</AsteroidCMSProvider>;
```

Or build the client yourself with the same factory used internally:

```ts
import { createApolloClient } from "@asteroidcms/core-utils";

const client = createApolloClient({
  cmsUrl: "https://cms-api.example.com",
  apiKey: "...",
});
```

---

## Development

```bash
npm install
npm run typecheck
npm run build      # writes dist/index.js, dist/index.cjs, dist/index.d.ts
```

---

## License

Proprietary - Copyright © Asteroid. All rights reserved.

This package is licensed for use only; copying, modifying, or
redistributing the source - in whole or in part - is not permitted.
See [LICENSE](./LICENSE) for the full terms.
