// src/server.ts
// Server-only entry. Exposed as `@asteroidcms/core-utils/server`.
// `import "server-only"` makes this fail loudly if imported by a client module.
import "server-only";

export { createCmsServerClient } from "./server/cmsServerClient";
export type { CmsServerClient, CmsServerClientConfig } from "./server/cmsServerClient";

export {
  defineArticleSource,
  buildSearchConditions,
  fetchArticles,
  fetchArticle,
  fetchRelatedArticles,
} from "./server/defineArticleSource";
export type {
  ArticleSource,
  ArticleSourceConfig,
} from "./server/defineArticleSource";

export { AsteroidArticlesListingServer } from "./components/articles/AsteroidArticlesListingServer";
export type { AsteroidArticlesListingServerProps } from "./components/articles/AsteroidArticlesListingServer";

export { AsteroidArticlePageServer } from "./components/articles/AsteroidArticlePageServer";
export type { AsteroidArticlePageServerProps } from "./components/articles/AsteroidArticlePageServer";

export {
  generateListingMetadata,
  generateArticleMetadata,
} from "./server/articleMetadata";
