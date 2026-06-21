// Next.js-only entry. Exposed as `@asteroidcms/core-utils/next`. `next` is an
// optional peer dependency; importing this subpath requires Next.js installed.
export {
  generateSeoMetadata,
  generatePageSeoMetadata,
  generateArticleSeoMetadata,
  generateArticleListingSeoMetadata,
  SEOHeadComponent,
} from "./seo/next";
