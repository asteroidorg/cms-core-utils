// src/components/articles/articles.types.ts
import type { ReactNode } from "react";

/** Resolves a CMS asset id (or passthrough URL) to an absolute media URL. */
export type ArticleImageResolver = (idOrUrl?: string) => string;

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

/** Runtime-agnostic computed state shared by client + server listing. */
export interface ArticlesViewState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  featured: TPost | null;
  rest: TPost[];
  categoryGroups: AsteroidArticleCategoryGroup<TPost>[];
  isEmpty: boolean;
  isSearching: boolean;
  /** The effective (already-debounced, for client) search query. */
  searchQuery: string;
}

export type AsteroidArticlesEmptyReason = "error" | "no-posts" | "no-results";

// Render-prop param shapes (each carries the injected cmsImage resolver).
export interface AsteroidArticlesSearchParams {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: { preventDefault: () => void }) => void;
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
  cmsImage: ArticleImageResolver;
}

export interface AsteroidArticlesPostCardParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  post: TPost;
  index: number;
  group: AsteroidArticleCategoryGroup<TPost>;
  cmsImage: ArticleImageResolver;
}

export interface AsteroidArticlesPostGridParams<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  posts: TPost[];
  group: AsteroidArticleCategoryGroup<TPost>;
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
  defaultContent: ReactNode;
}

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
