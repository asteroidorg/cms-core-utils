<!--toc:start-->

- [Contents](#asteroidcmscore-utils)
  - [Getting Started](#getting-started)
    - [Install dependencies](#install-dependencies)
    - [Run the build in watch mode](#run-the-build-in-watch-mode)
    - [Build the package](#build-the-package)
    - [Run type checking](#run-type-checking)
    - [Test against a local consumer app](#test-against-a-local-consumer-app)
  - [Project Layout](#project-layout)
  - [Contribution Guidelines](#contribution-guidelines)
  - [Commit Message Guidelines](#commit-message-guidelines)
  - [Pull Request Guidelines](#pull-request-guidelines)
  <!--toc:end-->

# Contributing to `@asteroidcms/core-utils`

Thanks for your interest in improving the package! This document describes how to get a development environment running, the conventions we follow, and what a good contribution looks like.

> Note: `@asteroidcms/core-utils` is published under a proprietary license owned by Asteroid (see [LICENSE](./LICENSE)). Contributions are accepted only from authorized contributors, and by submitting a PR you agree that your contribution becomes the intellectual property of Asteroid under the same license.

## Getting Started

This is a library — there is no app server to run. The development loop is **edit → build → consume from a sample app**.

### Install dependencies

```bash
npm install
```

### Run the build in watch mode

```bash
npm run dev
```

Rebuilds `dist/` on every change. Pair with `npm link` (below) for live iteration in a consumer app.

### Build the package

```bash
npm run build
```

Produces ESM (`dist/index.js`), CJS (`dist/index.cjs`), and type declarations (`dist/index.d.ts`).

### Run type checking

```bash
npm run typecheck
```

### Test against a local consumer app

```bash
# In this repo
npm run build
npm link

# In your test app
npm link @asteroidcms/core-utils
```

> If you see "duplicate React" / hooks errors, also link react in this repo's `node_modules` from the consumer app — peer-dep duplication is the usual cause.

## Project Layout

```
src/
├── index.ts                # public exports
├── provider/               # AsteroidCMSProvider + context + types
├── apollo/                 # Apollo client factory + error link
├── hooks/                  # useCmsContent, useCmsMutate
├── utils/                  # cmsImage, useCmsImage, getContentReadTime
└── components/             # RichTextContent + richTextParser
```

Keep new code grouped by concern, and add the public export to `src/index.ts` so it ships in the bundle.

## Contribution Guidelines

1. **Clone the Repository**: After forking, clone the repository to your local machine.

2. **Create a New Branch**: Always create a new branch for your changes. This keeps the project history clean and easy to navigate.

3. **Make Your Changes**: Make your changes in the new branch. Please follow the coding standards and conventions used throughout the project (TypeScript-strict, no `any` unless justified, prefer named exports).

4. **Test Your Changes**: Before submitting your changes, make sure to test them thoroughly — run `npm run typecheck`, `npm run build`, and verify behavior end-to-end against a consumer app.

5. **Commit Your Changes**: Commit your changes with a clear and concise commit message (see below).

6. **Push Your Changes**: Push your changes to your forked repository.

7. **Submit a Pull Request**: Finally, submit a pull request to the main repository. Please provide a clear and detailed description of the changes you've made.

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for our commit messages. This leads to more readable messages that are easy to follow when looking through the project history.

A commit message should be structured as follows:

```gitcommit
<type>[optional scope]: <description>
[optional body]
[optional footer(s)]
```

Where `type` must be one of the following:

- <span style='color: #162FD8'>feat</span>: A new feature
- <span style='color: #721820'>fix</span>: A bug fix
- <span style='color: #DB7379'>quickfix</span>: Small bug fix that doesn't require a new version
- <span style='color: #6A5E7C'>docs</span>: Documentation only changes
- <span style='color: #1F6FEB'>style</span>: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- <span style='color: #CC793B'>refactor</span>: A code change that neither fixes a bug nor adds a feature
- <span style='color: #81EF8E'>perf</span>: A code change that improves performance
- <span style='color: #196A87'>test</span>: Adding missing tests or correcting existing tests
- <span style='color: #32279D'>chore</span>: Changes to the build process or auxiliary tools and libraries such as documentation generation

Scopes used in this repo (optional but encouraged):

- `provider` — `AsteroidCMSProvider`, context, config resolution
- `apollo` — client factory, links
- `hooks` — `useCmsContent`, `useCmsMutate`
- `utils` — `cmsImage` and helpers
- `richtext` — `RichTextContent`, parser
- `build` — tsup, tsconfig, package.json

Examples:

```gitcommit
feat(hooks): add `useCmsContent` search-mode option
fix(apollo): preserve user headers when SetContextLink merges x-api-key
docs: document `apolloOptions` escape hatch in README
```

## Pull Request Guidelines

Follow the same naming convention for your pull requests as you do for your commits. A pull request should be structured.

1. **Reference Related Issues**: If your pull request is related to an existing issue, please reference it in your PR description.

2. **Describe Your Changes**: Provide a clear and detailed description of what changes you've made.

3. **Include Screenshots**: If your changes include UI updates (e.g. `<RichTextContent>` output), please include screenshots in your PR description.

4. **Verify the Build**: Confirm `npm run typecheck` and `npm run build` pass locally before requesting review.

5. **Bump the Version (if needed)**: For user-facing changes, follow semver — `fix`/`quickfix` → patch, `feat` → minor, breaking changes → major. Note the version bump in your PR description.

6. **Wait for Review**: After submitting your PR, please wait for it to be reviewed and approved before merging.
