---
title: Server article components
order: 13
---

# Server article components

`@asteroidcms/core-utils/server` provides React Server Components for listings and article pages. Define a source once; the components handle fetching, SEO metadata, JSON-LD, search, and related posts.

---

## Why server components

Two reasons to prefer server components over client hooks:

**The API key never leaves the server.** `createCmsServerClient` is guarded by `import "server-only"`. The key is bound at the module level and never serialized into the client bundle. This lets you use a write-scoped or unrestricted key without exposing it.

**Search is SEO-indexable.** The built-in `ArticleSearchBox` writes the query into a URL param (`?q=...`) and the page re-renders from `searchParams`. Search result pages are real URLs that crawlers can follow.

---

## Define a source once

A source bundles the client, the CMS schema, field selections, and SEO config into one frozen object. Define it in a server-only module and import it from any route that needs it.

```ts
// cms/blogSource.ts
import { createCmsServerClient, defineArticleSource } from "@asteroidcms/core-utils/server";
import { blogSeo } from "@/configs/seo-config";

export const cmsServerClient = createCmsServerClient({
  cmsUrl: process.env.CMS_API_BASE_URL!,
  apiKey: process.env.CMS_API_KEY!, // server-only, NOT NEXT_PUBLIC
  revalidate: 300,
  tags: ["cms:blog"],
});

export const blogSource = defineArticleSource({
  client: cmsServerClient,
  schemaSlug: "blog",
  listSelect: ["slug", "title", "description", "featured", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] }],
  detailSelect: ["slug", "title", "description", "content", "tags", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] },
    { field: "author", single: true, select: ["name", "bio"] }],
  seo: blogSeo,
  articleType: "BlogPosting",
});
```

`createCmsServerClient` deduplicates the Apollo client per request via React `cache()` when running under React Server Components (React 19 / Next.js's bundled React). Under stable React 18 the factory runs without dedup -- behavior is correct, just not memoized.

`defineArticleSource` config fields:

| Field | Required | Notes |
| --- | --- | --- |
| `client` | Yes | Return value of `createCmsServerClient`. |
| `schemaSlug` | Yes | CMS schema identifier. |
| `listSelect` | Yes | Fields fetched for listing views. |
| `detailSelect` | Yes | Fields fetched for article pages. |
| `seo` | Yes | `AsteroidSeoConfig` -- see [SEO and page components](/docs/web-sdk-react/seo-and-page-components). |
| `searchFields` | No | Fields to search against. Default: `["title", "description"]`. |
| `articleType` | No | JSON-LD subtype. Default: `"Article"`. |
| `status` | No | Content status filter. Default: `"PUBLISHED"`. |
| `relatedLimit` | No | Max related posts to fetch. Default: `3`. |
| `groupPostsByCategory` | No | Custom category-grouping function for listing views. |

---

## Listing page

Read `searchParams` in the page component and pass the search query to `AsteroidArticlesListingServer`.

```tsx
// app/blog/page.tsx
import { AsteroidArticlesListingServer, generateListingMetadata } from "@asteroidcms/core-utils/server";
import { blogSource } from "@/cms/blogSource";

export const generateMetadata = () => generateListingMetadata(blogSource);

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <AsteroidArticlesListingServer
      source={blogSource}
      searchQuery={q}
      renderPostCard={({ post, cmsImage }) => (
        <a href={`/blog/${post.slug}`}>
          {post.featured_image && (
            <img src={cmsImage(post.featured_image)} alt={post.title} />
          )}
          <h2>{post.title}</h2>
          <p>{post.description}</p>
        </a>
      )}
    />
  );
}
```

`generateListingMetadata` accepts an optional second argument for overriding `categoryName`, `categorySlug`, and `noindex`.

---

## Category page

Pass `categorySlug` from route params. The component fetches only posts in that category and updates the listing SEO title and canonical URL automatically.

```tsx
// app/blog/category/[category]/page.tsx
import { AsteroidArticlesListingServer, generateListingMetadata } from "@asteroidcms/core-utils/server";
import { blogSource } from "@/cms/blogSource";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return generateListingMetadata(blogSource, { categorySlug: category });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return (
    <AsteroidArticlesListingServer
      source={blogSource}
      categorySlug={category}
      renderPostCard={({ post }) => (
        <a href={`/blog/${post.slug}`}>
          <h2>{post.title}</h2>
          <p>{post.description}</p>
        </a>
      )}
    />
  );
}
```

---

## Article page

`AsteroidArticlePageServer` fetches the article by slug, fetches related posts, and injects both into the render props.

```tsx
// app/blog/[slug]/page.tsx
import { AsteroidArticlePageServer, generateArticleMetadata } from "@asteroidcms/core-utils/server";
import { blogSource } from "@/cms/blogSource";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return generateArticleMetadata(blogSource, params);
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <AsteroidArticlePageServer
      source={blogSource}
      slug={slug}
      renderHeader={({ post }) => <h1>{post.title}</h1>}
      renderContent={({ post }) => (
        <div dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />
      )}
      renderRelatedPosts={({ relatedPosts, cmsImage }) => (
        <aside>
          <h2>Related posts</h2>
          <ul>
            {relatedPosts.map((related) => (
              <li key={related.slug}>
                {related.featured_image && (
                  <img src={cmsImage(related.featured_image)} alt={related.title} />
                )}
                <a href={`/blog/${related.slug}`}>{related.title}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
      renderError={({ reason }) =>
        reason === "not-found" ? <p>Post not found.</p> : <p>Failed to load post.</p>
      }
    />
  );
}
```

`generateArticleMetadata` accepts either a raw slug string or a `Promise<{ slug: string }>` (i.e. the Next.js `params` promise directly). It fetches the article and builds full Open Graph + Twitter metadata.

The number of related posts fetched is controlled by `relatedLimit` on the source (`defineArticleSource`), not by a per-page prop.

---

## Search

Search is URL-driven. The built-in `ArticleSearchBox` is a `"use client"` island that writes to a URL query param; the page component reads that param from `searchParams` and passes it as `searchQuery` to the server component.

### Default search box

No extra configuration is needed. `AsteroidArticlesListingServer` renders `ArticleSearchBox` with the correct `paramKey` by default.

```tsx
<AsteroidArticlesListingServer
  source={blogSource}
  searchQuery={q}
  // ArticleSearchBox rendered automatically with paramKey="q"
  renderPostCard={...}
/>
```

### Change the param key

```tsx
<AsteroidArticlesListingServer
  source={blogSource}
  searchQuery={searchParams.search}
  searchParamKey="search"
  renderPostCard={...}
/>
```

### Customize the search box UI

Use `searchBoxProps` to pass props to the built-in `ArticleSearchBox` without replacing it:

```tsx
<AsteroidArticlesListingServer
  source={blogSource}
  searchQuery={q}
  searchBoxProps={{ placeholder: "Search posts...", className: "my-search" }}
  renderPostCard={...}
/>
```

`searchBoxProps` accepts `placeholder`, `debounceMs`, and `className`. It does not accept `paramKey` -- use the top-level `searchParamKey` prop for that.

### Replace the search box with a custom client island

Use `renderSearch` to render any client component instead:

```tsx
<AsteroidArticlesListingServer
  source={blogSource}
  searchQuery={q}
  renderSearch={({ value }) => <MySearchInput defaultValue={value} paramKey="q" />}
  renderPostCard={...}
/>
```

When `renderSearch` is used, the `onChange` and `onSubmit` callbacks in the params are inert placeholders kept only for API shape compatibility. Your custom component must write to the URL param itself -- the server re-renders in response to the URL change, not to a callback. Use `useRouter` + `useSearchParams` inside your client island to update the param.

---

## Images in render props

Every render prop receives a `cmsImage` resolver as part of its params. Use it to convert CMS asset IDs to absolute URLs. Do not call `useCmsImage()` inside render props -- it is a client hook and cannot be called inside server components or their render-prop callbacks.

```tsx
renderFeaturedImage={({ post, cmsImage }) => (
  post.featured_image
    ? <img src={cmsImage(post.featured_image)} alt={post.title} />
    : null
)}
```

The resolver is pre-configured with the CMS base URL derived from the source's SEO config (or the client's `cmsUrl` as fallback). No provider or hook is needed.

---

## News and docs: a second source

Create one source per content type. Each gets its own `schemaSlug`, `articleType`, and `seo` config.

```ts
// cms/newsSource.ts
import { createCmsServerClient, defineArticleSource } from "@asteroidcms/core-utils/server";
import type { AsteroidSeoConfig } from "@asteroidcms/core-utils";

const newsClient = createCmsServerClient({
  cmsUrl: process.env.CMS_API_BASE_URL!,
  apiKey: process.env.CMS_API_KEY!,
  revalidate: 60,
  tags: ["cms:news"],
});

const newsSeo: AsteroidSeoConfig = {
  siteName: "Acme Research",
  baseUrl: "https://acme.example",
  cmsUrl: process.env.CMS_API_BASE_URL!,
  defaultDescription: "Company research, market updates, and announcements.",
  articlePath: "/news",
  contentLabel: "News",
  titleTemplate: (title) => `${title} | Acme Research`,
};

export const newsSource = defineArticleSource({
  client: newsClient,
  schemaSlug: "news",
  listSelect: ["slug", "title", "description", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] }],
  detailSelect: ["slug", "title", "description", "content", "tags", "featured_image", "published_date",
    { field: "category", single: true, select: ["slug", "name"] },
    { field: "author", single: true, select: ["name"] }],
  seo: newsSeo,
  articleType: "NewsArticle",
});
```

Use `newsSource` in `app/news/page.tsx` and `app/news/[slug]/page.tsx` exactly like `blogSource`. The `articlePath: "/news"` in the SEO config ensures canonical URLs, OG image URLs, and JSON-LD article URLs all resolve to `/news/...`.
