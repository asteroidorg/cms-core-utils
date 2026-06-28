# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


## [0.2.3] - 2026-06-28

### Added

- Merge pull request #5 from asteroidorg/feat/nexy-react-sperate-implementation (2c48a27)
- feat: seperate imports for next and react (fb6a2e3)
- docs: spec for ArticleSearchBox plain-React compatibility (3494328)
- Update CHANGELOG with recent additions and fixes (5e51cc8)

### Changed

- `ArticleSearchBox` from `@asteroidcms/core-utils/client` is now
  framework-agnostic: it drives the URL `?q=` param via the native History API
  (with a `popstate` dispatch) instead of `next/navigation`, so it works in any
  React app (Vite, CRA, React Router) without pulling in `next`. Added an
  optional `onQueryChange(query)` callback for router-less apps.

### Added

- `@asteroidcms/core-utils/next` now exports a Next.js-bound `ArticleSearchBox`
  that commits via `router.replace` (App Router refetch). The server listing
  (`AsteroidArticlesListingServer`) uses this variant, so URL-driven search in
  Next.js behaves exactly as before. Next.js consumers that rely on Server
  Component refetch should import `ArticleSearchBox` from
  `@asteroidcms/core-utils/next` rather than `/client`.



## [0.2.2] - 2026-06-26

### Added

- Merge pull request #4 from asteroidorg/chore/readme_changes (0def5ae)
- docs: update logo source and add npm package link to README (4684e8f)
- chore: changed readme (56a3136)

## [0.2.1] - 2026-06-26

### Added

- Merge pull request #3 from asteroidorg/feat/ci-cd (8406d6c)

## [0.2.0] - 2026-06-23

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

[0.2.3]: https://github.com/asteroidorg/cms-core-utils/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/asteroidorg/cms-core-utils/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/asteroidorg/cms-core-utils/releases/tag/v0.2.1
[0.2.0]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.8...v0.2.0
[0.1.8]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.1...v0.1.3
[0.1.1]: https://github.com/asteroidorg/cms-core-utils/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/asteroidorg/cms-core-utils/releases/tag/v0.1.0
