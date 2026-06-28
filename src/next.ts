// Next.js-only entry. Exposed as `@asteroidcms/core-utils/next`. `next` is an
// optional peer dependency; importing this subpath requires Next.js installed.
export {
  generateSeoMetadata,
  generatePageSeoMetadata,
  generateArticleSeoMetadata,
  generateArticleListingSeoMetadata,
  SEOHeadComponent,
} from "./seo/next";

// Next.js-bound search box. Re-exported from the standalone `"use client"`
// bundle (kept external in the build) so this server-context entry doesn't
// absorb the client boundary.
export { ArticleSearchBox } from "@asteroidcms/core-utils/next-client";
export type { ArticleSearchBoxProps } from "@asteroidcms/core-utils/next-client";
