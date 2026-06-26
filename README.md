<div align="center">
  <h1>
    <div style="display: inline-flex; align-items: center; gap: 4px;">
      <a href="https://www.npmjs.com/package/@asteroidcms/core-utils">
        <img src="https://cms.theasteroid.tech/logo/logo.svg" alt="@asteroidcms" height="25px" />
      </a>
      <span>/core-utils</span>
    </div>
  </h1>
  <p>Seamless integration utilities for <a href="https://cms.theasteroid.tech">Asteroid CMS</a> - a single React provider, Apollo client, content hooks, media helpers, and a rich-text renderer.</p>
</div>

- **Provider-driven** - configure `cmsUrl`, `apiKey`, and Apollo behavior in one place
- **API-key auth only** - sends `x-api-key` on every request, nothing else
- **Typed hooks** - `useCmsContent` / `useCmsMutate` build GraphQL on the fly from a declarative selection
- **Server helpers** - `fetchCmsContent` / `cmsMutate` for Next.js Server Components, Route Handlers, and scripts
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

## Entry points

| Entry point                          | What it exports                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@asteroidcms/core-utils`            | Core utilities: `fetchCmsContent`, `cmsMutate`, `buildCmsQuery`, `buildCmsMutation`, `cmsImage`, `parseRichText`, `getContentReadTime`, `extractHeadingsFromHtml`, `createApolloClient`, `AsteroidCMSProvider`.                                                                  |
| `@asteroidcms/core-utils/client`     | Client components and hooks (browser / React): `AsteroidCMSProvider`, `useCmsContent`, `useCmsMutate`, `useCmsImage`, `RichTextContent`, `extractHeadingsFromElement`.                                                                                                          |
| `@asteroidcms/core-utils/next`       | Next.js metadata helpers and SEO head component. Optional peer dep on `next`.                                                                                                                                                                                                   |
| `@asteroidcms/core-utils/server`     | Server components: `AsteroidArticlesListingServer`, `AsteroidArticlePageServer`, `defineArticleSource`, `createCmsServerClient`, `generateListingMetadata`, `generateArticleMetadata`. Also exports `fetchArticles`, `fetchArticle`, `fetchRelatedArticles`, `buildSearchConditions`. Server-only -- the CMS API key never reaches the browser. |

---

## Quick start

Wrap your app once:

```tsx
import { AsteroidCMSProvider } from "@asteroidcms/core-utils/client";

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
import { useCmsContent, useCmsImage } from "@asteroidcms/core-utils/client";

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

Server-side counterpart to `useCmsContent`. Use it in Next.js Server Components, Route Handlers, or any other server context. Accepts a `getClient` function plus the same options object as `useCmsContent`, and returns the resolved data directly.

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

## `cmsMutate` (Next.js / RSC)

Server-side counterpart to `useCmsMutate`. Use it in Route Handlers, webhooks, cron jobs, or build scripts.

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
  schema_slug: "news",
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

---

## `buildCmsQuery` / `buildCmsMutation`

Lower-level helpers that turn a declarative selection into GraphQL `DocumentNode` plus variables. Used internally by the hooks and server helpers; exported so you can drive your own Apollo calls.

```ts
import { buildCmsQuery, buildCmsMutation } from "@asteroidcms/core-utils";

// Query
const { query, variables, isSingle } = buildCmsQuery({
  schema_slug: "news",
  limit: 10,
  status: "PUBLISHED",
  select: ["title", "slug"],
});

const { data } = await apolloClient.query({ query, variables });
const entries = isSingle ? data.entry : data.entries;

// Mutation
const { mutation, variables: mutVars } = buildCmsMutation({
  schema_slug: "news",
  mutationType: "create",
  variables: { data: { title: "Hello" } },
});

const { data: mutData } = await apolloClient.mutate({ mutation, variables: mutVars });
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

**Note:** Article render-prop callbacks (`renderPostCard` for listing, `renderRelatedPosts` for related posts, `renderContent`/`renderHeader` for article body) in both `AsteroidArticlesListing` (client) and `AsteroidArticlesListingServer` / `AsteroidArticlePageServer` (server) receive an injected `cmsImage(idOrUrl)` resolver. Prefer it over calling `useCmsImage()` directly so the same render function works in client and server components. A server equivalent for article listing and article page exists under `@asteroidcms/core-utils/server`.

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

Render Asteroid CMS rich-text HTML with syntax-highlighted code blocks (via `highlight.js`), self-healing enhancements (copy buttons, blockquote decorations, callout chips), terminal/diff code-block variants, and slugified heading IDs out of the box.

```tsx
import { RichTextContent } from "@asteroidcms/core-utils/client";
import { Info } from "lucide-react";

<RichTextContent
  html={article.body}
  as="article"
  className="prose"
  classMap={{ p: "my-2 leading-relaxed", h2: "text-2xl font-bold" }}
  onReady={(root) => console.log("hydrated", root.querySelectorAll("h2").length)}
  calloutIcons={{ info: <Info size={14} strokeWidth={2.4} /> }}
/>;
```

Additional props: `contentRef` (forwards the wrapper element, useful for scroll observers or ToC hooks), `onReady` (fires once enhancements have run), and `calloutIcons` (per-variant icon override for `<aside data-callout data-icon>` blocks).

Or use the parser directly (server-safe, no `highlight.js`):

```ts
import { parseRichText } from "@asteroidcms/core-utils";

const html = parseRichText(article.body, {
  classMap: {
    /* ... */
  },
});
```

### Table of contents

Build a static ToC from HTML with `extractHeadingsFromHtml`, or extract headings from live DOM with `extractHeadingsFromElement`:

```ts
import { extractHeadingsFromHtml } from "@asteroidcms/core-utils";

const toc = extractHeadingsFromHtml(article.body, { levels: [2, 3] });
// → [{ id: "intro", text: "Intro", level: 2 }, ...]
```

```ts
import { extractHeadingsFromElement } from "@asteroidcms/core-utils/client";

const toc = extractHeadingsFromElement(contentRef.current, { levels: [2, 3] });
```

Pair with `RichTextContent`'s `contentRef` prop and a scroll listener to build live active-heading tracking.

See the [full rich-text docs](./docs/web-sdk-react/10-rich-text.md) for `classMap` variants, parser options, and code block features.

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

## `@asteroidcms/core-utils/server`

Server-only entry. Guarded by `server-only` so it fails loudly if imported in a client module.

See [docs/web-sdk-react/13-server-article-components.md](./docs/web-sdk-react/13-server-article-components.md) for the full guide.

### `createCmsServerClient` + `defineArticleSource`

Define a source once in a server-only module and import it from any route that needs it.

```ts
// cms/articleSource.ts
import { createCmsServerClient, defineArticleSource } from "@asteroidcms/core-utils/server";
import type { AsteroidSeoConfig } from "@asteroidcms/core-utils";

const cmsClient = createCmsServerClient({
  cmsUrl: process.env.CMS_API_BASE_URL!,
  apiKey: process.env.CMS_API_KEY!, // server-only, NOT NEXT_PUBLIC
  revalidate: 300,
});

const articleSeo: AsteroidSeoConfig = {
  siteName: "Acme",
  baseUrl: "https://acme.example",
  cmsUrl: process.env.CMS_API_BASE_URL!,
  defaultDescription: "News and updates.",
  articlePath: "/news",
  contentLabel: "News",
};

export const articleSource = defineArticleSource({
  client: cmsClient,
  schemaSlug: "news",
  listSelect: ["slug", "title", "description", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] }],
  detailSelect: ["slug", "title", "description", "content", "tags", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] },
    { field: "author", single: true, select: ["name"] }],
  seo: articleSeo,
  relatedLimit: 3,
});
```

`createCmsServerClient` memoizes per request via React `cache` when available (React Server Components / React 19 / Next.js bundled React). On React 18 stable without `cache` it degrades to no per-request dedup but remains correct.

`defineArticleSource` required fields: `client`, `schemaSlug`, `listSelect`, `detailSelect`, `seo`. Optional: `searchFields`, `articleType`, `status`, `relatedLimit`, `groupPostsByCategory`.

### `AsteroidArticlesListingServer`

Read `searchParams` in the page and pass the query as `searchQuery`.

```tsx
// app/news/page.tsx
import { AsteroidArticlesListingServer, generateListingMetadata } from "@asteroidcms/core-utils/server";
import { articleSource } from "@/cms/articleSource";

export const generateMetadata = () => generateListingMetadata(articleSource);

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <AsteroidArticlesListingServer
      source={articleSource}
      searchQuery={q}
      renderPostCard={({ post, cmsImage }) => (
        <a href={`/news/${post.slug}`}>
          <h2>{post.title}</h2>
        </a>
      )}
    />
  );
}
```

Required prop: `renderPostCard` receives `{ post, cmsImage }`. Optional: `renderFeaturedCard`, `renderEmpty`, `renderSearch`, `categorySlug`, `searchParamKey`, `searchBoxProps`, and more.

### `AsteroidArticlePageServer`

```tsx
// app/news/[slug]/page.tsx
import { AsteroidArticlePageServer, generateArticleMetadata } from "@asteroidcms/core-utils/server";
import { articleSource } from "@/cms/articleSource";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return generateArticleMetadata(articleSource, params);
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <AsteroidArticlePageServer
      source={articleSource}
      slug={slug}
      renderHeader={({ post }) => <h1>{post.title}</h1>}
      renderContent={({ post }) => (
        <div dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />
      )}
      renderRelatedPosts={({ relatedPosts, cmsImage }) => (
        <ul>
          {relatedPosts.map((related) => (
            <li key={related.slug}>
              <a href={`/news/${related.slug}`}>{related.title}</a>
            </li>
          ))}
        </ul>
      )}
      renderError={({ reason }) =>
        reason === "not-found" ? <p>Not found.</p> : <p>Error loading post.</p>
      }
    />
  );
}
```

Render-prop slots: `renderHeader`, `renderContent`, `renderRelatedPosts` (receives `{ post, relatedPosts, cmsImage }`), `renderError`. Every render prop receives an injected `cmsImage(idOrUrl)` resolver -- do not call `useCmsImage()` inside render props.

### Metadata helpers

```ts
import { generateListingMetadata, generateArticleMetadata } from "@asteroidcms/core-utils/server";

// Listing page -- positional args: source first
export const generateMetadata = () => generateListingMetadata(articleSource);

// Category page
export async function generateMetadata({ params }) {
  const { category } = await params;
  return generateListingMetadata(articleSource, { categorySlug: category });
}

// Article page -- positional args: source first, then params or slug
export async function generateMetadata({ params }) {
  return generateArticleMetadata(articleSource, params);
}
```

### Low-level fetch helpers

`fetchArticles`, `fetchArticle`, `fetchRelatedArticles`, and `buildSearchConditions` are also exported for custom fetch logic outside the ready-made server components.

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
