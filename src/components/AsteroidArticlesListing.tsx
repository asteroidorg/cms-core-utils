"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildArticleListingSeoValues,
  seoValuesToClientProps,
} from "../seo/seo.builders";
import type { AsteroidSeoConfig } from "../seo/seo.config";
import { JsonLd, Seo } from "../seo/Seo";
import { buildCollectionJsonLd } from "../seo/jsonld";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Minimal article post shape shared across Asteroid CMS apps. */
export interface AsteroidArticlePost {
  slug: string;
  title: string;
  description?: string;
  featured_image?: string;
  featured?: boolean;
  published_date?: string | null;
  category?: {
    slug: string;
    name: string;
    description?: string;
  };
}

export interface AsteroidArticleCategoryGroup<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  categoryName: string;
  categorySlug: string;
  posts: TPost[];
}

export interface AsteroidArticlesUsePostsResult<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  featured?: TPost | null;
  rest: TPost[];
  loading: boolean;
  error?: unknown;
}

export type AsteroidArticlesUsePosts<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> = (searchQuery: string) => AsteroidArticlesUsePostsResult<TPost>;

export interface AsteroidArticlesSearchParams {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export interface AsteroidArticlesHeaderParams {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  search: ReactNode;
}

export interface AsteroidArticlesFeaturedCardParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  post: TPost;
}

export interface AsteroidArticlesPostCardParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  post: TPost;
  index: number;
  group: AsteroidArticleCategoryGroup<TPost>;
}

export interface AsteroidArticlesPostGridParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  group: AsteroidArticleCategoryGroup<TPost>;
  /** Pre-built post cards - render as-is or wrap. */
  children: ReactNode;
}

export interface AsteroidArticlesCategoryHeadingParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  group: AsteroidArticleCategoryGroup<TPost>;
}

export interface AsteroidArticlesCategoryGroupParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  group: AsteroidArticleCategoryGroup<TPost>;
  /** Default heading + grid - use it, wrap it, or replace entirely. */
  defaultContent: ReactNode;
}

export type AsteroidArticlesEmptyReason = "error" | "no-posts" | "no-results";

export interface AsteroidArticlesEmptyParams {
  reason: AsteroidArticlesEmptyReason;
  searchQuery?: string;
  error?: unknown;
}

export interface AsteroidArticlesContentParams {
  featured: ReactNode;
  groups: ReactNode;
  noSearchResults: ReactNode;
}

export interface AsteroidArticlesState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  featured: TPost | null | undefined;
  rest: TPost[];
  categoryGroups: AsteroidArticleCategoryGroup<TPost>[];
  loading: boolean;
  error: unknown;
  hasError: boolean;
  isEmpty: boolean;
  isSearching: boolean;
  searchQuery: string;
  debouncedSearchQuery: string;
  setSearchQuery: (value: string) => void;
}

export interface AsteroidArticlesProps<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  /** Inject app-specific CMS fetching. Receives the debounced search query. */
  usePosts: AsteroidArticlesUsePosts<TPost>;

  /** Limit listing to a single category slug. */
  categorySlug?: string;
  /** Limit listing to a single post slug. */
  articleSlug?: string;

  /** Debounce delay for search in ms. Default: 800 */
  searchDebounceMs?: number;

  /** Site SEO config - enables client-side meta tags in React and Next.js apps. */
  seo?: AsteroidSeoConfig;

  // Static header slots (content only - no styling in AsteroidArticles)
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;

  // Render props (MUI DataGrid-style)
  /** Wrap the entire component output. */
  renderRoot?: (params: { children: ReactNode }) => ReactNode;
  /** Replace the default header layout (eyebrow + title + description + search). */
  renderHeader?: (params: AsteroidArticlesHeaderParams) => ReactNode;
  /** Replace the search control. */
  renderSearch?: (params: AsteroidArticlesSearchParams) => ReactNode;
  /** Featured hero card. Return `null` to suppress. Hidden while searching. */
  renderFeaturedCard?: (
    params: AsteroidArticlesFeaturedCardParams<TPost>,
  ) => ReactNode;
  /** Individual post card inside a grid. */
  renderPostCard: (params: AsteroidArticlesPostCardParams<TPost>) => ReactNode;
  /** Category section heading. */
  renderCategoryHeading?: (
    params: AsteroidArticlesCategoryHeadingParams<TPost>,
  ) => ReactNode;
  /** Grid wrapper for post cards within a category. */
  renderPostGrid?: (params: AsteroidArticlesPostGridParams<TPost>) => ReactNode;
  /**
   * Full category section (heading + grid).
   * Receives `defaultContent` so you can wrap rather than fully replace.
   */
  renderCategoryGroup?: (
    params: AsteroidArticlesCategoryGroupParams<TPost>,
  ) => ReactNode;
  /** Loading state. */
  renderSkeleton?: () => ReactNode;
  /** Error, empty feed, or zero search results. Return `null` to suppress. */
  renderEmpty?: (params: AsteroidArticlesEmptyParams) => ReactNode;
  /** Wrap featured card + category groups. */
  renderContent?: (params: AsteroidArticlesContentParams) => ReactNode;

  /** Override the built-in CollectionPage JSON-LD structured data. */
  renderJsonLd?: (params: AsteroidArticlesState<TPost>) => ReactNode;

  /**
   * Escape hatch - receive full computed state and render everything yourself.
   * When provided, structural render props above are ignored (slot render props
   * like `renderPostCard` are still used if you call them manually).
   */
  children?: (state: AsteroidArticlesState<TPost>) => ReactNode;

  /** Custom category grouping. */
  groupPostsByCategory?: (
    posts: TPost[],
  ) => AsteroidArticleCategoryGroup<TPost>[];
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function defaultGetCategoryName(
  post: Pick<AsteroidArticlePost, "category">,
): string | undefined {
  return post.category?.name?.trim() || undefined;
}

export function defaultGroupPostsByCategory<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(posts: TPost[]): AsteroidArticleCategoryGroup<TPost>[] {
  const groups = new Map<string, AsteroidArticleCategoryGroup<TPost>>();

  for (const post of posts) {
    const categoryName = defaultGetCategoryName(post) || "Other";
    const categorySlug = post.category?.slug || "other";
    const existing = groups.get(categorySlug);

    if (existing) {
      existing.posts.push(post);
    } else {
      groups.set(categorySlug, { categoryName, categorySlug, posts: [post] });
    }
  }

  return Array.from(groups.values());
}

function applyPostFilters<TPost extends AsteroidArticlePost>(
  posts: TPost[],
  {
    categorySlug,
    articleSlug,
  }: Pick<AsteroidArticlesProps<TPost>, "categorySlug" | "articleSlug">,
): TPost[] {
  let filtered = posts;

  if (categorySlug) {
    filtered = filtered.filter((post) => post.category?.slug === categorySlug);
  }

  if (articleSlug) {
    filtered = filtered.filter((post) => post.slug === articleSlug);
  }

  return filtered;
}

function splitFeaturedAndRest<TPost extends AsteroidArticlePost>(
  posts: TPost[],
): { featured: TPost | null; rest: TPost[] } {
  const featured = posts.find((post) => post.featured) ?? null;
  const rest = featured
    ? posts.filter((post) => post.slug !== featured.slug)
    : [...posts];

  return { featured, rest };
}

// ----------------------------------------------------------------------------
// State hook (headless usage)
// ----------------------------------------------------------------------------

export function useAsteroidArticlesState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>({
  usePosts,
  categorySlug,
  articleSlug,
  searchDebounceMs = 800,
  groupPostsByCategory = defaultGroupPostsByCategory,
}: Pick<
  AsteroidArticlesProps<TPost>,
  | "usePosts"
  | "categorySlug"
  | "articleSlug"
  | "searchDebounceMs"
  | "groupPostsByCategory"
>): AsteroidArticlesState<TPost> {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, searchDebounceMs);

  const { posts: rawPosts, loading, error } = usePosts(debouncedSearchQuery);

  const posts = useMemo(
    () => applyPostFilters(rawPosts, { categorySlug, articleSlug }),
    [rawPosts, categorySlug, articleSlug],
  );

  const { featured, rest } = useMemo(
    () => splitFeaturedAndRest(posts),
    [posts],
  );

  const isSearching = debouncedSearchQuery.trim().length > 0;

  const categoryGroups = useMemo(() => {
    if (isSearching) {
      if (posts.length === 0) return [];
      return [
        {
          categoryName: `Search results for "${debouncedSearchQuery.trim()}"`,
          categorySlug: "search-results",
          posts,
        },
      ];
    }
    return groupPostsByCategory(rest);
  }, [isSearching, posts, debouncedSearchQuery, rest, groupPostsByCategory]);

  const hasError = Boolean(error);
  const isEmpty = !featured && rest.length === 0;

  return {
    posts,
    featured,
    rest,
    categoryGroups,
    loading,
    error,
    hasError,
    isEmpty,
    isSearching,
    searchQuery,
    debouncedSearchQuery,
    setSearchQuery,
  };
}

// ----------------------------------------------------------------------------
// AsteroidArticlesListing
// ----------------------------------------------------------------------------

export function AsteroidArticlesListing<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(props: AsteroidArticlesProps<TPost>) {
  const {
    eyebrow,
    title,
    description,
    seo,
    categorySlug,
    renderRoot,
    renderHeader,
    renderSearch,
    renderFeaturedCard,
    renderPostCard,
    renderCategoryHeading,
    renderPostGrid,
    renderCategoryGroup,
    renderSkeleton,
    renderEmpty,
    renderContent,
    renderJsonLd,
    children,
  } = props;

  const state = useAsteroidArticlesState(props);

  const categoryName = categorySlug
    ? state.posts[0]?.category?.name?.trim()
    : undefined;

  const seoNode = seo ? (
    <Seo
      {...seoValuesToClientProps(
        buildArticleListingSeoValues(seo, {
          categoryName,
          categorySlug,
        }),
      )}
    />
  ) : null;

  const jsonLdNode = seo
    ? (renderJsonLd?.(state) ?? (
        <JsonLd
          data={buildCollectionJsonLd({
            name: categoryName || `${seo.siteName} Article`,
            description: seo.defaultDescription || "",
            url: `${(seo.baseUrl || "").replace(/\/$/, "")}${
              seo.articlePath ?? "/blog"
            }${categorySlug ? `/category/${categorySlug}` : ""}`,
            siteUrl: (seo.baseUrl || "").replace(/\/$/, ""),
          })}
        />
      ))
    : null;

  if (children) {
    return <>{children(state)}</>;
  }

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
  };

  const searchNode = renderSearch
    ? renderSearch({
        value: state.searchQuery,
        onChange: state.setSearchQuery,
        onSubmit: handleSearchSubmit,
      })
    : null;

  const headerNode = renderHeader ? (
    renderHeader({ eyebrow, title, description, search: searchNode })
  ) : (
    <>
      {eyebrow}
      {title}
      {description}
      {searchNode}
    </>
  );

  const featuredNode =
    state.featured && !state.isSearching && renderFeaturedCard
      ? renderFeaturedCard({ post: state.featured })
      : null;

  const noSearchResultsNode =
    state.isSearching && !state.loading && state.posts.length === 0
      ? (renderEmpty?.({
          reason: "no-results",
          searchQuery: state.debouncedSearchQuery.trim(),
        }) ?? null)
      : null;

  const groupsNode = noSearchResultsNode
    ? null
    : state.categoryGroups.map((group) => {
        const postCards = group.posts.map((post, index) => (
          <Fragment key={post.slug ?? index}>
            {renderPostCard({ post, index, group })}
          </Fragment>
        ));

        const gridNode = renderPostGrid ? (
          renderPostGrid({ posts: group.posts, group, children: postCards })
        ) : (
          <>{postCards}</>
        );

        const headingNode = renderCategoryHeading
          ? renderCategoryHeading({ group })
          : group.categoryName;

        const defaultContent = (
          <>
            {headingNode}
            {gridNode}
          </>
        );

        return renderCategoryGroup
          ? renderCategoryGroup({ group, defaultContent })
          : defaultContent;
      });

  const contentNode =
    !state.loading &&
    !state.hasError &&
    (state.featured || state.rest.length > 0) ? (
      renderContent ? (
        renderContent({
          featured: featuredNode,
          groups: groupsNode,
          noSearchResults: noSearchResultsNode,
        })
      ) : (
        <>
          {featuredNode}
          {noSearchResultsNode}
          {groupsNode}
        </>
      )
    ) : null;

  const body = (
    <>
      {seoNode}
      {jsonLdNode}
      {headerNode}
      {state.loading ? renderSkeleton?.() : null}
      {!state.loading && (state.hasError || state.isEmpty)
        ? renderEmpty?.({
            reason: state.hasError ? "error" : "no-posts",
            searchQuery: state.debouncedSearchQuery.trim(),
            error: state.error,
          })
        : null}
      {contentNode}
    </>
  );

  return renderRoot ? renderRoot({ children: body }) : <>{body}</>;
}
