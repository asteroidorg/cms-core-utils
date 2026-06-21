// Next.js-only SEO helpers. Imports `next`; this module is exposed only via
// the `@asteroidcms/core-utils/next` subpath so non-Next bundlers never resolve it.

import type { Metadata } from "next";
import Head from "next/head";
import {
  buildArticleListingSeoValues,
  buildArticleSeoValues,
  buildPageSeoValues,
} from "./seo.builders";
import type {
  AsteroidPageSeoOptions,
  AsteroidSeoConfig,
  ISeoValues,
} from "./seo.config";

export async function generateSeoMetadata(
  SeoInfo: ISeoValues,
): Promise<Metadata> {
  return {
    title: SeoInfo.title,
    description: SeoInfo.description,
    publisher: SeoInfo.siteName,
    keywords: SeoInfo.keywords,
    category: SeoInfo.title,
    ...(SeoInfo.manifestUrl ? { manifest: SeoInfo.manifestUrl } : {}),
    robots: SeoInfo.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    authors: { name: SeoInfo.siteName },
    referrer: "origin",
    abstract: SeoInfo.description,
    alternates: { canonical: SeoInfo.url },
    openGraph: {
      title: SeoInfo.title,
      description: SeoInfo.description,
      url: SeoInfo.url,
      siteName: SeoInfo.siteName,
      locale: "en_US",
      type: "website",
      ...(SeoInfo.image ? { images: [{ url: SeoInfo.image }] } : {}),
    },
    twitter: {
      title: SeoInfo.title,
      description: SeoInfo.description,
      site: SeoInfo.twitter || undefined,
      card: SeoInfo.image ? "summary_large_image" : "summary",
      ...(SeoInfo.image ? { images: [SeoInfo.image] } : {}),
    },
  };
}

/** Generic page metadata; landing pages, marketing pages, etc. */
export async function generatePageSeoMetadata(
  config: AsteroidSeoConfig,
  options: AsteroidPageSeoOptions,
): Promise<Metadata> {
  const metadata = await generateSeoMetadata(buildPageSeoValues(config, options));
  if (options.ogType === "article") {
    return { ...metadata, openGraph: { ...metadata.openGraph, type: "article" } };
  }
  return metadata;
}

export async function generateArticleSeoMetadata<
  TPost extends {
    title: string;
    description?: string;
    meta_description?: string;
    featured_image?: string;
  },
>(post: TPost, config: AsteroidSeoConfig, slug: string): Promise<Metadata> {
  const seoValues = buildArticleSeoValues(post, config, slug);
  const metadata = await generateSeoMetadata(seoValues);
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, type: "article" },
  };
}

export async function generateArticleListingSeoMetadata(
  config: AsteroidSeoConfig,
  options?: { categoryName?: string; categorySlug?: string },
): Promise<Metadata> {
  return generateSeoMetadata(buildArticleListingSeoValues(config, options));
}

export function SEOHeadComponent({ SeoInfo }: { SeoInfo: ISeoValues }) {
  return (
    <Head>
      <title>{SeoInfo.title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content={SeoInfo.description} />
      <link rel="canonical" href={SeoInfo.url} />
      <meta name="keywords" content={SeoInfo.keywords} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={SeoInfo.title} />
      <meta property="og:description" content={SeoInfo.description} />
      <meta property="og:url" content={SeoInfo.url} />
      <meta property="og:site_name" content={SeoInfo.siteName} />
      {SeoInfo.image ? <meta property="og:image" content={SeoInfo.image} /> : null}
      <meta
        name="twitter:card"
        content={SeoInfo.image ? "summary_large_image" : "summary"}
      />
      <meta name="twitter:title" content={SeoInfo.title} />
      <meta name="twitter:description" content={SeoInfo.description} />
      {SeoInfo.twitter ? <meta name="twitter:site" content={SeoInfo.twitter} /> : null}
      {SeoInfo.image ? <meta name="twitter:image" content={SeoInfo.image} /> : null}
      <meta name="referrer" content="origin" />
      {SeoInfo.manifestUrl ? <link rel="manifest" href={SeoInfo.manifestUrl} crossOrigin="use-credentials" /> : null}
      <meta name="category" content={SeoInfo.title} />
      <meta name="robots" content={SeoInfo.noindex ? "noindex" : "index"} />
      <meta name="author" content={SeoInfo.siteName} />
      <meta name="revisit-after" content="3 month" />
    </Head>
  );
}
