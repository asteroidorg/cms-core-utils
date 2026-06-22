// src/components/articles/articles.state.ts
import type {
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  ArticlesViewState,
} from "./articles.types";

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

export function applyPostFilters<TPost extends AsteroidArticlePost>(
  posts: TPost[],
  { categorySlug, articleSlug }: { categorySlug?: string; articleSlug?: string },
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

export function splitFeaturedAndRest<TPost extends AsteroidArticlePost>(
  posts: TPost[],
): { featured: TPost | null; rest: TPost[] } {
  const featured = posts.find((post) => post.featured) ?? null;
  const rest = featured
    ? posts.filter((post) => post.slug !== featured.slug)
    : [...posts];
  return { featured, rest };
}

export interface BuildArticlesViewStateOptions<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  categorySlug?: string;
  articleSlug?: string;
  searchQuery?: string;
  groupPostsByCategory?: (posts: TPost[]) => AsteroidArticleCategoryGroup<TPost>[];
}

export function buildArticlesViewState<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(
  rawPosts: TPost[],
  options: BuildArticlesViewStateOptions<TPost>,
): ArticlesViewState<TPost> {
  const {
    categorySlug,
    articleSlug,
    searchQuery = "",
    groupPostsByCategory = defaultGroupPostsByCategory,
  } = options;

  const posts = applyPostFilters(rawPosts, { categorySlug, articleSlug });
  const { featured, rest } = splitFeaturedAndRest(posts);
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  const categoryGroups = isSearching
    ? posts.length === 0
      ? []
      : [
          {
            categoryName: `Search results for "${trimmedQuery}"`,
            categorySlug: "search-results",
            posts,
          },
        ]
    : groupPostsByCategory(rest);

  return {
    posts,
    featured,
    rest,
    categoryGroups,
    isEmpty: !featured && rest.length === 0,
    isSearching,
    searchQuery: trimmedQuery,
  };
}
