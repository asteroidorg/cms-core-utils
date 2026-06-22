---
title: SEO and page components
description: Add page metadata, JSON-LD, OG image content, and headless article pages across React and Next.js.
order: 12
---

# SEO and page components

The SEO surface is content-type agnostic. "Article" means any entry-shaped content item: news, docs pages, guides, updates, or posts. Standalone pages such as landing, about, and pricing pages use the generic page builders.

---

## Overview and entries

| Entry | Import from | What belongs here |
| --- | --- | --- |
| Server-safe root | `@asteroidcms/core-utils` | Types, SEO value builders, JSON-LD builders, `OgImageContent`, `parseOgImageSearchParams` |
| Client entry | `@asteroidcms/core-utils/client` | `<Seo>`, `<JsonLd>`, `<AsteroidArticlePage>`, `<AsteroidArticlesListing>`, `ArticleSearchBox` |
| Next.js entry | `@asteroidcms/core-utils/next` | `generateSeoMetadata`, `generatePageSeoMetadata`, `generateArticleSeoMetadata`, `generateArticleListingSeoMetadata`, `SEOHeadComponent` |
| Server entry | `@asteroidcms/core-utils/server` | `createCmsServerClient`, `defineArticleSource`, `fetchArticles`, `fetchArticle`, `fetchRelatedArticles`, `AsteroidArticlesListingServer`, `AsteroidArticlePageServer`, `generateListingMetadata`, `generateArticleMetadata` |

The root entry has no DOM, hooks, or `next` import. The client entry has `"use client"`. The Next.js entry imports Next types/components and should only be used in Next apps. The server entry has `import "server-only"` -- importing it from a client module fails at build time.

---

## Next vs React mental model

Use one head strategy per page:

1. Next.js App Router server route: use `generate*SeoMetadata` from `@asteroidcms/core-utils/next`, or the source-aware `generateListingMetadata` / `generateArticleMetadata` from `@asteroidcms/core-utils/server`.
2. Client-only route, Vite, CRA, or another SPA: use `<Seo>` from `@asteroidcms/core-utils/client`.
3. JSON-LD can be emitted with `<JsonLd data={...} />` in client routes, or by rendering your own `<script type="application/ld+json">` from a server component.

Do not use both `generateMetadata` and `<Seo>` for the same route. They emit the same title, canonical URL, and social metadata through different runtimes.

### Server vs client article components

The two sets of article components use different SEO strategies:

- **Server components** (`AsteroidArticlesListingServer`, `AsteroidArticlePageServer`): emit JSON-LD via a `<script type="application/ld+json">` element rendered in the RSC payload, and produce `Metadata` objects via `generateListingMetadata` / `generateArticleMetadata` that Next.js merges into `<head>`. This is the right choice for Next.js App Router routes where you control `generateMetadata`.

- **Client components** (`AsteroidArticlesListing`, `AsteroidArticlePage`): emit `<Seo>` and `<JsonLd>` into the document head via the React client runtime. Use these for Vite, CRA, or Pages Router apps where server-side metadata generation is not available.

Pick one approach per route. Do not render `AsteroidArticlePageServer` (which writes metadata via `generateMetadata`) and also call `<Seo>` inside the same route segment -- they would produce duplicate `<title>` and Open Graph tags.

---

## Configuring the content type

Configure path, label, and title formatting once, then reuse the same config for builders, metadata, and headless components.

### News example

```ts
// src/seo/newsSeo.ts
import type { AsteroidSeoConfig } from "@asteroidcms/core-utils";

export const newsSeo: AsteroidSeoConfig = {
  siteName: "Acme Research",
  baseUrl: "https://acme.example",
  cmsUrl: "https://cms.acme.example",
  twitter: "@acmeresearch",
  defaultDescription: "Company research, market updates, and announcements.",
  defaultKeywords: "research, markets, announcements",
  articlePath: "/news",
  contentLabel: "News",
  titleTemplate: (title) => `${title} | Acme Research`,
  ogImage: {
    apiPath: "/api/og",
    palette: {
      background: "#0b1220",
      foreground: "#ffffff",
      accent: "#2dd4bf",
    },
  },
};
```

```tsx
// app/news/[slug]/NewsArticleClient.tsx
"use client";

import { AsteroidArticlePage } from "@asteroidcms/core-utils/client";
import { newsSeo } from "@/src/seo/newsSeo";
import { useNewsArticle } from "@/src/cms/useNewsArticle";

export function NewsArticleClient({ slug }: { slug: string }) {
  return (
    <AsteroidArticlePage
      slug={slug}
      useArticle={useNewsArticle}
      seo={newsSeo}
      articleType="NewsArticle"
      renderHeader={({ post }) => <h1>{post.title}</h1>}
      renderContent={({ post }) => (
        <div dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />
      )}
    />
  );
}
```

### Docs example

```ts
// src/seo/docsSeo.ts
import type { AsteroidSeoConfig } from "@asteroidcms/core-utils";

export const docsSeo: AsteroidSeoConfig = {
  siteName: "Acme Docs",
  baseUrl: "https://docs.acme.example",
  cmsUrl: "https://cms.acme.example",
  defaultDescription: "Technical documentation for Acme products.",
  articlePath: "/docs",
  contentLabel: "Documentation",
  titleTemplate: (title) => `${title} - Acme Docs`,
};
```

```tsx
<AsteroidArticlePage
  slug={slug}
  useArticle={useDocPage}
  seo={docsSeo}
  articleType="TechArticle"
  renderHeader={({ post }) => <h1>{post.title}</h1>}
  renderContent={({ post }) => <DocBody html={post.content ?? ""} />}
/>
```

---

## AsteroidSeoConfig reference

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `siteName` | `string` | Required | Used in titles, social metadata, and JSON-LD. |
| `baseUrl` | `string` | Required | Absolute site origin, such as `https://acme.example`. |
| `twitter` | `string` | `""` | Social handle for Twitter/X card metadata. |
| `defaultDescription` | `string` | Built from title and site name | Used when a page or article has no description. |
| `defaultKeywords` | `string` | Page or article title | Used for the `keywords` meta tag. |
| `articlePath` | `string` | `"/blog"` | Path prefix for the article collection. Set this explicitly for `/news`, `/docs`, or `/resources`. |
| `contentLabel` | `string` | `"Articles"` | Human label used in listing titles and OG image eyebrows. |
| `titleTemplate` | `(title: string) => string` | `` `${title} | ${siteName}` `` | Final title formatter. |
| `ogImage.palette` | `AsteroidOgImagePalette` | None | Enables generated OG image URLs. |
| `ogImage.apiPath` | `string` | `"/api/og"` | Route that renders `OgImageContent`. |
| `getOgImageUrl` | `(params) => string | undefined` | None | Override for custom CDN or OG rendering services. |
| `organization.logoUrl` | `string` | None | Adds an `ImageObject` logo to `buildSiteJsonLd`. |
| `organization.contactEmail` | `string` | None | Adds contact email to the Organization node. |
| `organization.contactPhone` | `string` | None | Adds contact phone to the Organization node. |
| `organization.address` | `{ street?: string; city?: string; country?: string }` | None | Adds a postal address to the Organization node. |
| `organization.socials` | `string[]` | `[]` | Maps to schema.org `sameAs`. |
| `extraJsonLdNodes` | `object[]` | `[]` | Escape hatch for site-specific schema.org nodes. |
| `cmsUrl` | `string` | None | Used to resolve CMS asset ids into absolute media URLs. |

`cmsUrl` resolution:

1. Server builders use `config.cmsUrl` when present.
2. `<AsteroidArticlePage>` uses `seo.cmsUrl` first, then the nearest `<AsteroidCMSProvider cmsUrl="...">`.
3. If no CMS URL is available, article SEO falls back to the generated OG image URL when OG image config exists.

---

## Generic page SEO

Use `buildPageSeoValues` for any standalone page with no article concept.

### React route

```tsx
import {
  buildPageSeoValues,
  buildWebPageJsonLd,
  seoValuesToClientProps,
} from "@asteroidcms/core-utils";
import { JsonLd, Seo } from "@asteroidcms/core-utils/client";
import { siteSeo } from "./seo";

export function LandingPage() {
  const seo = buildPageSeoValues(siteSeo, {
    title: "Carbon reporting software",
    description: "Automated reporting workflows for sustainability teams.",
    path: "/",
    keywords: "carbon reporting, sustainability software",
    eyebrow: "Platform",
  });

  return (
    <>
      <Seo {...seoValuesToClientProps(seo)} />
      <JsonLd
        data={buildWebPageJsonLd({
          name: "Carbon reporting software",
          description: seo.description,
          url: seo.url,
          siteUrl: siteSeo.baseUrl.replace(/\/$/, ""),
        })}
      />
      <main>{/* landing page UI */}</main>
    </>
  );
}
```

### Next.js route

```ts
// app/page.tsx
import { generatePageSeoMetadata } from "@asteroidcms/core-utils/next";
import { siteSeo } from "@/src/seo";

export const generateMetadata = () =>
  generatePageSeoMetadata(siteSeo, {
    title: "Carbon reporting software",
    description: "Automated reporting workflows for sustainability teams.",
    path: "/",
    eyebrow: "Platform",
  });
```

---

## Article recipes

### Next.js article metadata

```ts
// app/news/[slug]/page.tsx
import { generateArticleSeoMetadata } from "@asteroidcms/core-utils/next";
import { newsSeo } from "@/src/seo/newsSeo";
import { getNewsArticle } from "@/src/cms/news-server";
import { NewsArticleClient } from "./NewsArticleClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getNewsArticle(slug);
  return generateArticleSeoMetadata(article, newsSeo, slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <NewsArticleClient slug={slug} />;
}
```

### Next.js OG image route

```tsx
// app/api/og/route.tsx
import { ImageResponse } from "next/og";
import {
  OgImageContent,
  parseOgImageSearchParams,
} from "@asteroidcms/core-utils";

export const runtime = "edge";

export function GET(request: Request) {
  const params = parseOgImageSearchParams(new URL(request.url).searchParams);

  return new ImageResponse(<OgImageContent {...params} />, {
    width: 1200,
    height: 630,
  });
}
```

### Vite or React listing route

Choose either the component's `seo` prop or your own `<Seo>` call. This example owns SEO manually so it can also emit the site graph on the route.

```tsx
import {
  buildArticleListingSeoValues,
  buildSiteJsonLd,
  seoValuesToClientProps,
} from "@asteroidcms/core-utils";
import {
  AsteroidArticlesListing,
  JsonLd,
  Seo,
} from "@asteroidcms/core-utils/client";
import { newsSeo } from "./newsSeo";
import { useNewsArticles } from "./useNewsArticles";

export function NewsIndexRoute() {
  const seo = buildArticleListingSeoValues(newsSeo);

  return (
    <>
      <Seo {...seoValuesToClientProps(seo)} />
      <JsonLd data={buildSiteJsonLd(newsSeo)} />
      <AsteroidArticlesListing
        usePosts={useNewsArticles}
        eyebrow="Latest"
        title="News"
        description="Research, market updates, and announcements."
        renderPostCard={({ post }) => (
          <a href={`/news/${post.slug}`}>
            <h2>{post.title}</h2>
            <p>{post.description}</p>
          </a>
        )}
      />
    </>
  );
}
```

---

## Component prop reference

> **cmsImage in render props (server components)**
> Server components inject a `cmsImage` resolver directly into each render-prop parameter: `renderHeader`, `renderContent`, `renderRelatedPosts`, and others all receive `{ post, cmsImage }`. Use this injected resolver to convert CMS asset IDs to absolute URLs. Do not call `useCmsImage()` inside these callbacks -- `useCmsImage()` is a client hook and is not available in server components.

`AsteroidArticlePageProps<TPost>` handles one fetched article:

| Prop | Purpose |
| --- | --- |
| `slug` | Entry slug passed to your `useArticle` hook. |
| `useArticle` | App-provided hook returning `{ data, loading, error }`. |
| `seo` | Optional `AsteroidSeoConfig`; enables built-in `<Seo>` and Article JSON-LD. |
| `articleType` | Optional schema.org subtype such as `"NewsArticle"` or `"TechArticle"`. |
| `backLink` | Static slot rendered before article content. |
| `renderSkeleton`, `renderError` | Loading and error/not-found slots. |
| `renderHeader`, `renderMeta`, `renderDescription`, `renderFeaturedImage`, `renderToc`, `renderContent` | Main article slots. |
| `renderPreArticle`, `renderMidArticle`, `renderPostArticle` | Placement slots around content. |
| `renderTags`, `renderAuthorDetails`, `renderRelatedPosts`, `renderCTA` | Optional article sections. |
| `renderJsonLd` | Override the built-in Article JSON-LD. |
| `children` | Full escape hatch; receives the hook state. |

`AsteroidArticlesProps<TPost>` handles a list or category view:

| Prop | Purpose |
| --- | --- |
| `usePosts` | App-provided hook returning `{ posts, featured, rest, loading, error }`. |
| `categorySlug`, `articleSlug` | Optional client-side filters. |
| `searchDebounceMs` | Search debounce delay. Default: `800`. |
| `seo` | Optional `AsteroidSeoConfig`; enables built-in listing `<Seo>` and CollectionPage JSON-LD. |
| `eyebrow`, `title`, `description` | Static header slots. |
| `renderSearch`, `renderHeader` | Header and search controls. |
| `renderFeaturedCard`, `renderPostCard`, `renderPostGrid` | Listing card and grid slots. |
| `renderCategoryHeading`, `renderCategoryGroup` | Category section slots. |
| `renderSkeleton`, `renderEmpty`, `renderContent` | Loading, empty, and wrapper slots. |
| `renderJsonLd` | Override the built-in CollectionPage JSON-LD. |
| `groupPostsByCategory` | Custom category grouping function. |
| `children` | Full escape hatch; receives `AsteroidArticlesState<TPost>`. |

The full TypeScript types are exported from `@asteroidcms/core-utils/client`.
