// src/server/articleMetadata.ts
import type { Metadata } from "next";
import {
  buildArticleListingSeoValues,
  buildArticleSeoValues,
} from "../seo/seo.builders";
import type { ISeoValues } from "../seo/seo.config";
import { fetchArticle, type ArticleSource } from "./defineArticleSource";
import type { AsteroidArticlePagePost } from "../components/articles/article.view";
import type { AsteroidArticlePost } from "../components/articles/articles.types";

export function seoValuesToMetadata(
  v: ISeoValues,
  ogType: "website" | "article",
): Metadata {
  return {
    title: v.title,
    description: v.description,
    publisher: v.siteName,
    keywords: v.keywords,
    category: v.title,
    ...(v.manifestUrl ? { manifest: v.manifestUrl } : {}),
    robots: v.noindex ? { index: false, follow: true } : { index: true, follow: true },
    authors: { name: v.siteName },
    referrer: "origin",
    abstract: v.description,
    alternates: { canonical: v.url },
    openGraph: {
      title: v.title,
      description: v.description,
      url: v.url,
      siteName: v.siteName,
      locale: "en_US",
      type: ogType,
      ...(v.image ? { images: [{ url: v.image }] } : {}),
    },
    twitter: {
      title: v.title,
      description: v.description,
      site: v.twitter || undefined,
      card: v.image ? "summary_large_image" : "summary",
      ...(v.image ? { images: [v.image] } : {}),
    },
  };
}

export async function generateListingMetadata(
  source: ArticleSource,
  options?: { categoryName?: string; categorySlug?: string; noindex?: boolean },
): Promise<Metadata> {
  return seoValuesToMetadata(buildArticleListingSeoValues(source.seo, options), "website");
}

export async function generateArticleMetadata(
  source: ArticleSource<AsteroidArticlePost, AsteroidArticlePagePost>,
  paramsOrSlug: string | { slug: string } | Promise<{ slug: string }>,
): Promise<Metadata> {
  const resolved = await paramsOrSlug;
  const slug = typeof resolved === "string" ? resolved : resolved.slug;
  const article = await fetchArticle(source, slug);
  if (!article) {
    return seoValuesToMetadata(buildArticleListingSeoValues(source.seo), "website");
  }
  return seoValuesToMetadata(buildArticleSeoValues(article, source.seo, slug), "article");
}
