<div align="center">
  <h1>
    <div style="display: inline-flex; align-items: center; gap: 4px;">
      <img src="https://cms.theasteroid.tech/logo/logo_gradient.svg" alt="@asteroidcms" height="25px" />
      <span>/core-utils</span>
    </div>
  </h1>
  <p>Seamless integration utilities for <a href="https://cms.theasteroid.tech">Asteroid CMS</a> — a single React provider, Apollo client, content hooks, media helpers, and a rich-text renderer.</p>
</div>

- **Provider-driven** — configure `cmsUrl`, `apiKey`, and Apollo behavior in one place
- **API-key auth only** — sends `x-api-key` on every request, nothing else
- **Typed hooks** — `useCmsContent` / `useCmsMutate` build GraphQL on the fly from a declarative selection
- **Tree-shakeable** — ESM + CJS + types, `@apollo/client`/`react` as peer deps

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
| `cmsUrl`        | `string`                       | ✓        | —                  | Base URL of the Asteroid CMS API.                            |
| `apiKey`        | `string`                       | ✓        | —                  | Sent on every request as the `x-api-key` header.             |
| `graphqlPath`   | `string`                       |          | `/graphql`         | Path appended to `cmsUrl` for the GraphQL endpoint.          |
| `mediaPath`     | `string`                       |          | `/media/canonical` | Path used by `cmsImage` / `useCmsImage`.                     |
| `headers`       | `Record<string, string>`       |          | `{}`               | Extra headers merged onto every GraphQL request.             |
| `onError`       | `(error: unknown) => void`     |          | —                  | Called for each GraphQL / network / protocol error.          |
| `cacheConfig`   | `InMemoryCacheConfig`          |          | —                  | Forwarded to `new InMemoryCache(...)` — e.g. `typePolicies`. |
| `apolloOptions` | `Partial<ApolloClientOptions>` |          | —                  | Escape hatch — overrides any field on the Apollo client.     |
| `client`        | `ApolloClient`                 |          | —                  | Bring your own pre-built client; skips the internal factory. |

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
// Inside React — preferred
const cmsImage = useCmsImage();
<img src={cmsImage(article.cover_image)} alt="" />;

// Outside React (loaders, scripts, SSR)
import { cmsImage } from "@asteroidcms/core-utils";
cmsImage(id, { cmsUrl: "https://cms-api.example.com" });
```

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

## Advanced — bring your own Apollo client

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

Proprietary — Copyright © Asteroid. All rights reserved.

This package is licensed for use only; copying, modifying, or
redistributing the source — in whole or in part — is not permitted.
See [LICENSE](./LICENSE) for the full terms.
