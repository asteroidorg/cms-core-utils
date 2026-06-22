// src/components/articles/AsteroidArticlesListingServer.tsx
import { type ReactNode } from "react";
import { ArticleSearchBox, type ArticleSearchBoxProps } from "@asteroidcms/core-utils/client";
import {
  buildArticleListingSeoValues,
  seoValuesToClientProps,
} from "../../seo/seo.builders";
import { buildCollectionJsonLd } from "../../seo/jsonld";
import { Seo } from "../../seo/Seo";
import { createImageResolver } from "../../utils/cmsImage";
import { fetchArticles, type ArticleSource } from "../../server/defineArticleSource";
import { buildArticlesViewState } from "./articles.state";
import { renderArticlesListingBody, type ArticlesListingRenderProps } from "./articles.view";
import type {
  ArticlesViewState,
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  AsteroidArticlesSearchParams,
} from "./articles.types";

export interface AsteroidArticlesListingServerProps<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> extends ArticlesListingRenderProps<TPost> {
  source: ArticleSource<TPost>;
  searchQuery?: string;
  categorySlug?: string;
  articleSlug?: string;
  searchParamKey?: string;
  limit?: number;
  noindex?: boolean;
  searchBoxProps?: Omit<ArticleSearchBoxProps, "paramKey">;
  renderSearch?: (params: AsteroidArticlesSearchParams) => ReactNode;
  renderJsonLd?: (state: ArticlesViewState<TPost>) => ReactNode;
  groupPostsByCategory?: (posts: TPost[]) => AsteroidArticleCategoryGroup<TPost>[];
}

export async function AsteroidArticlesListingServer<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(props: AsteroidArticlesListingServerProps<TPost>) {
  const {
    source,
    searchQuery = "",
    categorySlug,
    articleSlug,
    searchParamKey = "q",
    limit,
    noindex,
    searchBoxProps,
    renderSearch,
    renderJsonLd,
    groupPostsByCategory,
    ...renderProps
  } = props;

  let rawPosts: TPost[] = [];
  let hasError = false;
  let error: unknown = undefined;
  try {
    rawPosts = await fetchArticles(source, { searchQuery, categorySlug, limit });
  } catch (err) {
    hasError = true;
    error = err;
  }

  const state = buildArticlesViewState(rawPosts, {
    categorySlug,
    articleSlug,
    searchQuery,
    groupPostsByCategory,
  });

  const cmsImage = createImageResolver({ cmsUrl: source.seo.cmsUrl ?? source.client.cmsUrl });
  const categoryName = categorySlug ? state.posts[0]?.category?.name?.trim() : undefined;

  const seoNode = (
    <Seo
      {...seoValuesToClientProps(
        buildArticleListingSeoValues(source.seo, { categoryName, categorySlug, noindex }),
      )}
    />
  );

  const collection = buildCollectionJsonLd({
    name: categoryName || `${source.seo.siteName} ${source.seo.contentLabel ?? "Articles"}`,
    description: source.seo.defaultDescription || "",
    url: `${(source.seo.baseUrl || "").replace(/\/$/, "")}${source.seo.articlePath ?? "/blog"}${
      categorySlug ? `/category/${categorySlug}` : ""
    }`,
    siteUrl: (source.seo.baseUrl || "").replace(/\/$/, ""),
  });
  const jsonLdNode =
    renderJsonLd?.(state) ?? (
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
    );

  // On the SERVER, search is URL-driven: the default ArticleSearchBox (or custom client island)
  // writes the searchParamKey query param, and the page re-renders from searchParams.
  // A custom renderSearch should render its own client island to update the URL param;
  // the onChange/onSubmit stubs below are inert placeholders kept only for API shape compatibility.
  const searchNode = renderSearch
    ? renderSearch({ value: searchQuery, onChange: () => {}, onSubmit: (e) => e.preventDefault() })
    : <ArticleSearchBox paramKey={searchParamKey} {...searchBoxProps} />;

  return (
    <>
      {renderArticlesListingBody({
        state,
        loading: false,
        hasError,
        error,
        cmsImage,
        searchNode,
        seoNode,
        jsonLdNode,
        renderProps: renderProps as ArticlesListingRenderProps<TPost>,
      })}
    </>
  );
}
