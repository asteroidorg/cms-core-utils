// Next.js client island, built as its own `"use client"` bundle so it keeps a
// proper client boundary while being re-exported from the (server-context)
// `@asteroidcms/core-utils/next` entry. Mirrors how `server.ts` consumes the
// `@asteroidcms/core-utils/client` island as an external module.
export { ArticleSearchBox } from "./components/articles/ArticleSearchBoxNext";
export type { ArticleSearchBoxProps } from "./components/articles/ArticleSearchBoxNext";
