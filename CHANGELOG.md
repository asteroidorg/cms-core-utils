# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


## [0.2.1] - 2026-06-26

### Added

- Merge pull request #3 from asteroidorg/feat/ci-cd (8406d6c)
- fix: remove echo fallback on git push in release workflow (5bd0f7a)
- ci: add id-token permission, run tests, and enable npm provenance for releases (8c280c6)
- ci: verification step to ensure release tag is on main branch (1b7804a)
- feat: update changelog script to format entries and automatically append version comparison links (9c03965)
- refactor: update release workflow to manual tag-based versioning and add ESLint configuration (d8e98d2)
- ci: add automated release workflow (9e97362)
- Merge pull request #2 from asteroidorg/feat/server-article-components (cb48566)
- version: minor version bump (969187b)
- fix: correct README server API; report no-results on empty search; fix ArticleSearchBox param retention + a11y + metadata generic (dce6792)
- fix(server): server components emit JSON-LD only; head via generateMetadata, not Seo (060043d)
- docs: add server article components guide; update SEO + server-rendering docs (979e40d)
- docs: document /server entry and cmsImage render-prop change (ccc5ad9)
- feat(server): add /server entry point and build wiring (c1b6862)
- test(server): cover generateArticleMetadata/generateListingMetadata branches (34c5a45)
- feat(server): add source-aware listing + article metadata helpers (0010628)
- docs(server): clarify URL-driven search + inert renderSearch handlers on server listing (b20c3f2)
- feat(server): add AsteroidArticlesListingServer + AsteroidArticlePageServer (1a26d3e)
- feat(articles): add ArticleSearchBox URL-search client island (ea406a1)
- test(server): cover defineArticleSource fetch helpers; pass through limit:0 (2a035b2)
- feat(server): add defineArticleSource + fetch/search helpers (63cf794)
- fix(server): tolerate missing React.cache outside RSC; scope cache mock to its test (f502800)
- feat(server): add createCmsServerClient (server-only, memoized) (e1d6e2c)
- fix(articles): make "use client" the first source line in client components (0241a0a)
- refactor(articles): re-point client AsteroidArticlePage at shared core (96f9124)
- feat(articles): export listing render-prop param types from /client (01f6a2c)
- refactor(articles): re-point client AsteroidArticlesListing at shared core (3ca89c9)
- feat(articles): add shared article-body renderer with relatedPosts + cmsImage (e6eaf2c)
- feat(articles): add shared listing view renderer with injected cmsImage (32537b1)
- feat(utils): add createImageResolver (runtime-agnostic image resolver) (6c4e6c3)
- feat(articles): extract runtime-agnostic article state + types, add vitest (bddb0ae)
- docs: refine plan (separate raw input from effective query; drop unused imports) (aaf804d)
- docs: add server article components implementation plan (7d9f8de)
- docs: add server article components + sources design spec (ca00c0c)
- Merge pull request #1 from asteroidorg/feat/seo-page-components (21a5f0f)
- chore: bump version to 0.1.8 (b1f09c8)
- feat: add noindex support, manifest configuration, and improve JSON-LD serialization (5e7b3ee)
- feat: add SEO utilities, Next.js metadata components, and page templates in version 0.1.8 (cb71a8b)
- docs: add SEO + page components guide (016ef31)
- fix(components): use provider cmsUrl for article SEO images (dab6346)
- feat: wire SEO/components into ., /client, and new /next entries (7edd94a)
- chore: normalize SEO component comments to ASCII (63363c2)
- feat(components): add AsteroidArticlePage + AsteroidArticlesListing (75adb81)
- feat(seo): add Next.js metadata helpers (/next entry source) (6429c3f)
- feat(seo): add Seo + JsonLd client components (dc92d40)
- feat(seo): add OgImageContent + param parser (cc9b496)
- feat(seo): add config-driven JSON-LD builders (article subtypes, collection, webpage, site graph) (a87ab4e)
- feat(seo): add generic page + article/listing SEO builders with cmsUrl injection (0438af9)
- feat(seo): add AsteroidSeoConfig and SEO types (c218a54)
- added change logs (2455e12)
- version update (118c733)
- update: richtextcontent package (e2f8aec)
- feat: add server-side cmsMutate and mutation builder (f7f1171)
- version name changed (9756b3c)
- feat(richtext): add callout icons & collapsible support (ff71942)
- feat(rich-text): add ToC hooks and auto-slug heading IDs (e774932)
- update: homage link (7f4e12a)
- feat(docs): add comprehensive React SDK usage guides (6b24ffe)
- feat: update fetchCmsContent API for server Apollo client (3937b7c)
- feat: add server-side fetchCmsContent and query builder (4c14d8d)
- utils: getContentReadTime util added (9e07c24)
- Enhance README with header and logo (4c6f41c)
- first commit (0020fbd)

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
