// src/components/articles/AsteroidArticlePageServer.tsx
import { type ReactNode } from "react";
import { buildArticleSeoValues, seoValuesToClientProps } from "../../seo/seo.builders";
import { buildArticleJsonLd, type ArticleJsonLdType } from "../../seo/jsonld";
import { Seo } from "../../seo/Seo";
import { createImageResolver } from "../../utils/cmsImage";
import {
  fetchArticle,
  fetchRelatedArticles,
  type ArticleSource,
} from "../../server/defineArticleSource";
import {
  renderArticleBody,
  type ArticleBodyRenderProps,
  type AsteroidArticlePagePost,
} from "./article.view";

export interface AsteroidArticlePageServerProps<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> extends ArticleBodyRenderProps<TDetail> {
  source: ArticleSource<AsteroidArticlePagePost, TDetail>;
  slug: string;
  articleType?: ArticleJsonLdType;
  noindex?: boolean;
  renderError?: (params: { error?: unknown; reason: "error" | "not-found" }) => ReactNode;
  renderJsonLd?: (params: { post: TDetail }) => ReactNode;
}

export async function AsteroidArticlePageServer<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(props: AsteroidArticlePageServerProps<TDetail>) {
  const { source, slug, articleType, noindex, renderError, renderJsonLd, ...bodyRenderProps } = props;

  const article = await fetchArticle(source, slug);
  if (!article) {
    return <>{renderError?.({ reason: "not-found" }) ?? null}</>;
  }

  const relatedPosts = await fetchRelatedArticles(source, article, slug);
  const cmsImage = createImageResolver({ cmsUrl: source.seo.cmsUrl ?? source.client.cmsUrl });
  const type = articleType ?? source.articleType;

  const seoValues = buildArticleSeoValues(article, source.seo, slug, { noindex });
  const seoNode = <Seo {...seoValuesToClientProps(seoValues)} />;

  const articleLd = buildArticleJsonLd({
    title: article.title,
    description: article.description || source.seo.defaultDescription || "",
    url: `${(source.seo.baseUrl || "").replace(/\/$/, "")}${source.seo.articlePath ?? "/blog"}/${slug}`,
    siteName: source.seo.siteName,
    siteUrl: (source.seo.baseUrl || "").replace(/\/$/, ""),
    articleType: type,
    image: seoValues.image,
    authorName: article.author?.name,
    publishedTime: article.published_date || undefined,
    tags: article.tags?.split(",").map((t) => t.trim()).filter(Boolean),
    category: article.category?.name,
  });
  const jsonLdNode =
    renderJsonLd?.({ post: article }) ?? (
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
    );

  return (
    <>
      {renderArticleBody({
        post: article,
        cmsImage,
        relatedPosts,
        seoNode,
        jsonLdNode,
        renderProps: bodyRenderProps as ArticleBodyRenderProps<TDetail>,
      })}
    </>
  );
}
