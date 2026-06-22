"use client";

// Provider
export { AsteroidCMSProvider } from "./provider/AsteroidCMSProvider";
export type { AsteroidCMSProviderProps } from "./provider/AsteroidCMSProvider";
export { useAsteroidCMSConfig } from "./provider/context";

// Hooks
export { useCmsContent } from "./hooks/useCmsContent";
export type { UseCmsContentOptions } from "./hooks/useCmsContent";
export { useCmsMutate } from "./hooks/useCmsMutate";
export type { UseCmsMutateOptions } from "./hooks/useCmsMutate";

// Hook variant of cmsImage
export { useCmsImage } from "./utils/cmsImage";

// Rich text component
export { RichTextContent } from "./components/RichTextContent";

// Re-export heading helpers from the client entry for convenience.
export {
  slugify,
  extractHeadingsFromHtml,
  extractHeadingsFromElement,
} from "./utils/extractHeadings";
export type {
  HeadingLevel,
  ExtractedHeading,
  ExtractHeadingsOptions,
} from "./utils/extractHeadings";

// SEO + page components (client)
export { Seo, JsonLd } from "./seo/Seo";

export { AsteroidArticlePage } from "./components/articles/AsteroidArticlePage";
export type {
  AsteroidArticlePageProps,
  AsteroidArticlePagePost,
  AsteroidArticlePageUseArticle,
  AsteroidArticlePageUseArticleResult,
} from "./components/articles/AsteroidArticlePage";
export type { ArticleBodyRenderProps } from "./components/articles/article.view";

export {
  AsteroidArticlesListing,
  useAsteroidArticlesState,
} from "./components/articles/AsteroidArticlesListing";
export type {
  AsteroidArticlesProps,
  AsteroidArticlesState,
  AsteroidArticlesUsePosts,
  AsteroidArticlesUsePostsResult,
} from "./components/articles/AsteroidArticlesListing";

export {
  defaultGroupPostsByCategory,
  defaultGetCategoryName,
} from "./components/articles/articles.state";
export type {
  AsteroidArticlePost,
  AsteroidArticleCategoryGroup,
} from "./components/articles/articles.types";
export type {
  ArticleImageResolver,
  AsteroidArticlesSearchParams,
  AsteroidArticlesHeaderParams,
  AsteroidArticlesFeaturedCardParams,
  AsteroidArticlesPostCardParams,
  AsteroidArticlesPostGridParams,
  AsteroidArticlesCategoryHeadingParams,
  AsteroidArticlesCategoryGroupParams,
  AsteroidArticlesEmptyParams,
  AsteroidArticlesEmptyReason,
  AsteroidArticlesContentParams,
} from "./components/articles/articles.types";
