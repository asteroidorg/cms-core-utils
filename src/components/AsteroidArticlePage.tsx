"use client";

import { useContext, type ReactNode } from "react";
import {
  seoValuesToClientProps,
  buildArticleSeoValues,
} from "../seo/seo.builders";
import type { AsteroidSeoConfig } from "../seo/seo.config";
import { JsonLd, Seo } from "../seo/Seo";
import { buildArticleJsonLd, type ArticleJsonLdType } from "../seo/jsonld";
import { AsteroidCMSContext } from "../provider/context";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AsteroidArticlePagePost {
  slug: string;
  title: string;
  description?: string;
  content?: string;
  featured_image?: string;
  tags?: string;
  published_date?: string | null;
  category?: {
    slug: string;
    name: string;
  };
  author?: {
    name: string;
    bio?: string;
  };
}

export type AsteroidArticlePageUseArticleResult<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> = {
  data?: TPost | null;
  loading: boolean;
  error?: unknown;
};

export type AsteroidArticlePageUseArticle<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> = (slug: string) => AsteroidArticlePageUseArticleResult<TPost>;

export interface AsteroidArticlePageProps<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  /** Article post slug to fetch. */
  slug: string;

  /** Inject the app-specific CMS fetching hook. */
  useArticle: AsteroidArticlePageUseArticle<TPost>;

  /** Site SEO config - enables client-side meta tags in React and Next.js apps. */
  seo?: AsteroidSeoConfig;

  /** schema.org Article subtype for the built-in JSON-LD. Default: "Article". */
  articleType?: ArticleJsonLdType;
  /** Mark this page as `noindex` for search engines. */
  noindex?: boolean;

  // Static content slots (shown when provided)
  /** "Back to article" link. */
  backLink?: ReactNode;

  // Render props
  /** Wrap the entire component output. */
  renderRoot?: (params: { children: ReactNode }) => ReactNode;

  /** Loading skeleton placeholder. */
  renderSkeleton?: () => ReactNode;

  /** Error or not-found state. */
  renderError?: (params: {
    error?: unknown;
    reason: "error" | "not-found";
  }) => ReactNode;

  /** Article post title / heading area. */
  renderHeader?: (params: { post: TPost }) => ReactNode;

  /** Article post metadata line (date, author, reading time, category chip). */
  renderMeta?: (params: { post: TPost }) => ReactNode;

  /** Article post description paragraph. */
  renderDescription?: (params: { post: TPost }) => ReactNode;

  /** Featured / hero image. */
  renderFeaturedImage?: (params: { post: TPost }) => ReactNode;

  /** Table of contents section. */
  renderToc?: (params: { post: TPost }) => ReactNode;

  /** Main rich-text content body. */
  renderContent?: (params: { post: TPost }) => ReactNode;

  /** Top advertisement slot. */
  renderPreArticle?: (params: { post: TPost }) => ReactNode;

  /** Middle advertisement slot. */
  renderMidArticle?: (params: { post: TPost }) => ReactNode;

  /** Bottom advertisement slot. */
  renderPostArticle?: (params: { post: TPost }) => ReactNode;

  /** Tags section. */
  renderTags?: (params: { post: TPost }) => ReactNode;

  /** Author details section. */
  renderAuthorDetails?: (params: { post: TPost }) => ReactNode;

  /** Related / similar posts section. */
  renderRelatedPosts?: (params: { post: TPost }) => ReactNode;

  /** Call-to-action section. */
  renderCTA?: (params: { post: TPost }) => ReactNode;

  /** Override the built-in Article JSON-LD structured data. */
  renderJsonLd?: (params: { post: TPost }) => ReactNode;

  /**
   * Escape hatch - receive the full result and render everything yourself.
   * When provided, structural render props above are ignored.
   */
  children?: (state: AsteroidArticlePageUseArticleResult<TPost>) => ReactNode;
}

// ----------------------------------------------------------------------------
// AsteroidArticlePage
// ----------------------------------------------------------------------------

export function AsteroidArticlePage<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(props: AsteroidArticlePageProps<TPost>) {
  const {
    slug,
    useArticle,
    seo,
    articleType,
    backLink,
    renderRoot,
    renderSkeleton,
    renderError,
    renderHeader,
    renderMeta,
    renderDescription,
    renderFeaturedImage,
    renderToc,
    renderContent,
    renderPreArticle,
    renderMidArticle,
    renderPostArticle,
    renderTags,
    renderAuthorDetails,
    renderRelatedPosts,
    renderCTA,
    renderJsonLd,
    noindex,
    children,
  } = props;

  const { data: article, loading, error } = useArticle(slug);
  const cmsConfig = useContext(AsteroidCMSContext);
  const seoConfig =
    seo && !seo.cmsUrl && cmsConfig?.cmsUrl
      ? { ...seo, cmsUrl: cmsConfig.cmsUrl }
      : seo;

  // Escape hatch
  if (children) {
    return <>{children({ data: article, loading, error })}</>;
  }

  // Loading
  if (loading) {
    const body = renderSkeleton?.() ?? null;
    return renderRoot ? renderRoot({ children: body }) : <>{body}</>;
  }

  // Error / not found
  if (!article || error) {
    const body =
      renderError?.({ error, reason: error ? "error" : "not-found" }) ?? null;
    return renderRoot ? renderRoot({ children: body }) : <>{body}</>;
  }

  // Success
  const seoValues =
    seoConfig && article
      ? buildArticleSeoValues(article, seoConfig, slug, { noindex })
      : null;

  const body = (
    <>
      {seoValues ? <Seo {...seoValuesToClientProps(seoValues)} /> : null}
      {seoConfig && article
        ? (renderJsonLd?.({ post: article }) ?? (
            <JsonLd
              data={buildArticleJsonLd({
                title: article.title,
                description:
                  article.description || seoConfig.defaultDescription || "",
                url: `${(seoConfig.baseUrl || "").replace(/\/$/, "")}${
                  seoConfig.articlePath ?? "/blog"
                }/${slug}`,
                siteName: seoConfig.siteName,
                siteUrl: (seoConfig.baseUrl || "").replace(/\/$/, ""),
                articleType,
                image: seoValues?.image,
                authorName: article.author?.name,
                publishedTime: article.published_date || undefined,
                tags: article.tags
                  ?.split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                category: article.category?.name,
              })}
            />
          ))
        : null}
      {backLink}
      {renderPreArticle?.({ post: article })}
      {renderHeader?.({ post: article })}
      {renderMeta?.({ post: article })}
      {renderDescription?.({ post: article })}
      {renderFeaturedImage?.({ post: article })}
      {renderToc?.({ post: article })}
      {renderContent?.({ post: article })}
      {renderMidArticle?.({ post: article })}
      {renderTags?.({ post: article })}
      {renderAuthorDetails?.({ post: article })}
      {renderRelatedPosts?.({ post: article })}
      {renderCTA?.({ post: article })}
      {renderPostArticle?.({ post: article })}
    </>
  );

  return renderRoot ? renderRoot({ children: body }) : <>{body}</>;
}
