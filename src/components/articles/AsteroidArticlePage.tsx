"use client";

import { useContext, type ReactNode } from "react";
import { seoValuesToClientProps, buildArticleSeoValues } from "../../seo/seo.builders";
import type { AsteroidSeoConfig } from "../../seo/seo.config";
import { JsonLd, Seo } from "../../seo/Seo";
import { buildArticleJsonLd, type ArticleJsonLdType } from "../../seo/jsonld";
import { AsteroidCMSContext } from "../../provider/context";
import { useCmsImage } from "../../utils/cmsImage";
import {
  renderArticleBody,
  type ArticleBodyRenderProps,
  type AsteroidArticlePagePost,
} from "./article.view";

export type { AsteroidArticlePagePost } from "./article.view";

export type AsteroidArticlePageUseArticleResult<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> = { data?: TPost | null; loading: boolean; error?: unknown };

export type AsteroidArticlePageUseArticle<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> = (slug: string) => AsteroidArticlePageUseArticleResult<TPost>;

export interface AsteroidArticlePageProps<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> extends ArticleBodyRenderProps<TPost> {
  slug: string;
  useArticle: AsteroidArticlePageUseArticle<TPost>;
  seo?: AsteroidSeoConfig;
  articleType?: ArticleJsonLdType;
  noindex?: boolean;
  relatedPosts?: TPost[];
  renderRoot?: (params: { children: ReactNode }) => ReactNode;
  renderSkeleton?: () => ReactNode;
  renderError?: (params: { error?: unknown; reason: "error" | "not-found" }) => ReactNode;
  renderJsonLd?: (params: { post: TPost }) => ReactNode;
  children?: (state: AsteroidArticlePageUseArticleResult<TPost>) => ReactNode;
}

export function AsteroidArticlePage<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(props: AsteroidArticlePageProps<TPost>) {
  const {
    slug,
    useArticle,
    seo,
    articleType,
    noindex,
    relatedPosts = [],
    renderRoot,
    renderSkeleton,
    renderError,
    renderJsonLd,
    children,
    ...bodyRenderProps
  } = props;

  const { data: article, loading, error } = useArticle(slug);
  const cmsConfig = useContext(AsteroidCMSContext);
  const cmsImage = useCmsImage();
  const seoConfig = seo && !seo.cmsUrl && cmsConfig?.cmsUrl ? { ...seo, cmsUrl: cmsConfig.cmsUrl } : seo;

  if (children) return <>{children({ data: article, loading, error })}</>;

  if (loading) {
    const body = renderSkeleton?.() ?? null;
    return renderRoot ? <>{renderRoot({ children: body })}</> : <>{body}</>;
  }

  if (!article || error) {
    const body = renderError?.({ error, reason: error ? "error" : "not-found" }) ?? null;
    return renderRoot ? <>{renderRoot({ children: body })}</> : <>{body}</>;
  }

  const seoValues = seoConfig ? buildArticleSeoValues(article, seoConfig, slug, { noindex }) : null;
  const seoNode = seoValues ? <Seo {...seoValuesToClientProps(seoValues)} /> : null;
  const jsonLdNode = seoConfig
    ? renderJsonLd?.({ post: article }) ?? (
        <JsonLd
          data={buildArticleJsonLd({
            title: article.title,
            description: article.description || seoConfig.defaultDescription || "",
            url: `${(seoConfig.baseUrl || "").replace(/\/$/, "")}${seoConfig.articlePath ?? "/blog"}/${slug}`,
            siteName: seoConfig.siteName,
            siteUrl: (seoConfig.baseUrl || "").replace(/\/$/, ""),
            articleType,
            image: seoValues?.image,
            authorName: article.author?.name,
            publishedTime: article.published_date || undefined,
            tags: article.tags?.split(",").map((t) => t.trim()).filter(Boolean),
            category: article.category?.name,
          })}
        />
      )
    : null;

  const body = renderArticleBody({
    post: article,
    cmsImage,
    relatedPosts,
    seoNode,
    jsonLdNode,
    renderProps: bodyRenderProps as ArticleBodyRenderProps<TPost>,
  });

  return renderRoot ? <>{renderRoot({ children: body })}</> : <>{body}</>;
}
