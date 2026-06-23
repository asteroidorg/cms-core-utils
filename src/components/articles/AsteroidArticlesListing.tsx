"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildArticleListingSeoValues,
  seoValuesToClientProps,
} from "../../seo/seo.builders";
import type { AsteroidSeoConfig } from "../../seo/seo.config";
import { JsonLd, Seo } from "../../seo/Seo";
import { buildCollectionJsonLd } from "../../seo/jsonld";
import { useCmsImage } from "../../utils/cmsImage";
import { buildArticlesViewState } from "./articles.state";
import { renderArticlesListingBody, type ArticlesListingRenderProps } from "./articles.view";
import type {
  ArticlesViewState,
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  AsteroidArticlesSearchParams,
} from "./articles.types";

export type {
  AsteroidArticlePost,
  AsteroidArticleCategoryGroup,
} from "./articles.types";

export interface AsteroidArticlesUsePostsResult<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  featured?: TPost | null;
  rest?: TPost[];
  loading: boolean;
  error?: unknown;
}

export type AsteroidArticlesUsePosts<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> = (searchQuery: string) => AsteroidArticlesUsePostsResult<TPost>;

export interface AsteroidArticlesState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> extends ArticlesViewState<TPost> {
  // `searchQuery` (inherited) is the effective, debounced+trimmed query used
  // for grouping and empty-state messages.
  loading: boolean;
  error: unknown;
  hasError: boolean;
  /** Raw, un-debounced input value. Bind your search box to this. */
  inputValue: string;
  setSearchQuery: (value: string) => void;
}

export interface AsteroidArticlesProps<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> extends ArticlesListingRenderProps<TPost> {
  usePosts: AsteroidArticlesUsePosts<TPost>;
  categorySlug?: string;
  articleSlug?: string;
  searchDebounceMs?: number;
  seo?: AsteroidSeoConfig;
  noindex?: boolean;
  renderSearch?: (params: AsteroidArticlesSearchParams) => ReactNode;
  renderJsonLd?: (state: AsteroidArticlesState<TPost>) => ReactNode;
  groupPostsByCategory?: (posts: TPost[]) => AsteroidArticleCategoryGroup<TPost>[];
  children?: (state: AsteroidArticlesState<TPost>) => ReactNode;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useAsteroidArticlesState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(props: Pick<
  AsteroidArticlesProps<TPost>,
  "usePosts" | "categorySlug" | "articleSlug" | "searchDebounceMs" | "groupPostsByCategory"
>): AsteroidArticlesState<TPost> {
  const { usePosts, categorySlug, articleSlug, searchDebounceMs = 800, groupPostsByCategory } = props;
  const [inputValue, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(inputValue, searchDebounceMs);
  const { posts: rawPosts, loading, error } = usePosts(debouncedSearchQuery);

  const view = useMemo(
    () =>
      buildArticlesViewState(rawPosts, {
        categorySlug,
        articleSlug,
        searchQuery: debouncedSearchQuery,
        groupPostsByCategory,
      }),
    [rawPosts, categorySlug, articleSlug, debouncedSearchQuery, groupPostsByCategory],
  );

  return {
    ...view,
    loading,
    error,
    hasError: Boolean(error),
    inputValue,
    setSearchQuery,
  };
}

export function AsteroidArticlesListing<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(props: AsteroidArticlesProps<TPost>) {
  const { seo, categorySlug, noindex, renderSearch, renderJsonLd, children, ...renderProps } = props;
  const state = useAsteroidArticlesState(props);
  const cmsImage = useCmsImage();

  if (children) return <>{children(state)}</>;

  const categoryName = categorySlug ? state.posts[0]?.category?.name?.trim() : undefined;

  const seoNode = seo ? (
    <Seo
      {...seoValuesToClientProps(
        buildArticleListingSeoValues(seo, { categoryName, categorySlug, noindex }),
      )}
    />
  ) : null;

  const jsonLdNode = seo
    ? renderJsonLd?.(state) ?? (
        <JsonLd
          data={buildCollectionJsonLd({
            name: categoryName || `${seo.siteName} ${seo.contentLabel ?? "Articles"}`,
            description: seo.defaultDescription || "",
            url: `${(seo.baseUrl || "").replace(/\/$/, "")}${seo.articlePath ?? "/blog"}${
              categorySlug ? `/category/${categorySlug}` : ""
            }`,
            siteUrl: (seo.baseUrl || "").replace(/\/$/, ""),
          })}
        />
      )
    : null;

  const searchNode = renderSearch
    ? renderSearch({
        value: state.inputValue,
        onChange: state.setSearchQuery,
        onSubmit: (event) => event.preventDefault(),
      })
    : null;

  return (
    <>
      {renderArticlesListingBody({
        state,
        loading: state.loading,
        hasError: state.hasError,
        error: state.error,
        cmsImage,
        searchNode,
        seoNode,
        jsonLdNode,
        renderProps: renderProps as ArticlesListingRenderProps<TPost>,
      })}
    </>
  );
}
