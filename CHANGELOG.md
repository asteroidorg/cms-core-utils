# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `@asteroidcms/core-utils/server` entry: `AsteroidArticlesListingServer`,
  `AsteroidArticlePageServer`, `defineArticleSource`, `createCmsServerClient`,
  and source-aware `generateListingMetadata` / `generateArticleMetadata`.
  Also exports `fetchArticles`, `fetchArticle`, `fetchRelatedArticles`, and
  `buildSearchConditions` for custom fetch logic.
  Server components fetch on the server so the CMS API key (`CMS_API_KEY`,
  not `NEXT_PUBLIC_*`) never reaches the browser; article search is driven by
  URL `searchParams` via `ArticleSearchBox`.

### Changed

- Article render-prop params now include an injected `cmsImage(idOrUrl)`
  resolver. Render props should use it instead of calling `useCmsImage()`,
  so the same render functions work in both client and server components.

## [0.1.8] - 2026-06-21

### Added

- SEO types, metadata builders, and JSON-LD utilities
- OG image content component and search param parser
- Client-side `Seo` and `JsonLd` components
- Next.js SEO metadata generators and head component
- `AsteroidArticlePage` and `AsteroidArticlesListing` page components
- `@asteroidcms/core-utils/next` subpath export with optional Next.js peer dependency
- SEO and page component documentation

## [0.1.7] - 2026-05-28

### Changed

- Updated `RichTextContent` package

## [0.1.6] - 2026-05-27

### Added

- Server-side `cmsMutate` function and mutation builder

## [0.1.5] - 2026-05-25

### Changed

- Package name updated

## [0.1.4] - 2026-05-25

### Added

- Callout icons and collapsible block support in rich-text renderer
- Table of Contents hooks (`useTableOfContents`) and auto-slug heading IDs

## [0.1.3] - 2026-05-24

### Added

- Comprehensive React SDK usage guides

### Changed

- Updated homepage link

## [0.1.1] - 2026-05-24

### Added

- Server-side `fetchCmsContent` function and query builder
- Server Apollo client support for `fetchCmsContent` API

## [0.1.0] - 2026-05-23

### Added

- Initial release
- `AsteroidCmsProvider` — Apollo-based CMS provider for React
- `useCmsContent` hook for fetching CMS content
- `RichTextContent` component for rendering rich-text blocks
- `getContentReadTime` utility for estimating read time

[0.1.8]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.1...v0.1.3
[0.1.1]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/asteroidorg/cms-core-utils/releases/tag/v0.1.0
