// Server-safe entry. No React hooks, no `"use client"` — safe to import
// from Next.js Server Components, Route Handlers, scripts, and SSR loaders.
//
// React/UI exports (provider, hooks, RichTextContent) live in the
// `@asteroidcms/core-utils/client` subpath.

// Types from the provider config (consumed by createApolloClient)
export type {
  AsteroidCMSConfig,
  ResolvedAsteroidCMSConfig,
} from "./provider/types";

// Apollo factory — pure function, safe on the server
export { createApolloClient } from "./apollo/createApolloClient";

// Server-side query helper for Next.js / RSC
export { fetchCmsContent } from "./fetchCmsContent";

// Server-side mutation helper for Next.js / RSC
export { cmsMutate } from "./cmsMutate";

// GraphQL query builder
export { buildCmsQuery } from "./build-query";

// GraphQL mutation builder
export { buildCmsMutation } from "./build-mutation";
export type { CmsMutateOptions, MutationType } from "./build-mutation";
export type {
  FieldSelector,
  ReferenceExpansion,
  ContentStatus,
  CmsSearchCondition,
  UseCmsContentOptions,
} from "./build-query";

// Plain utilities
export { cmsImage } from "./utils/cmsImage";
export { getContentReadTime } from "./utils/getContentReadTime";

// Rich text parser (no React)
export {
  parseRichText,
  removeEmptyParagraphs,
} from "./components/richTextParser";
export type {
  RichTextClassKey,
  RichTextClassMap,
  ParseRichTextOptions,
} from "./components/richTextParser";

// Heading extraction (server-safe — useful for SSR ToC, sitemaps, etc.)
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
