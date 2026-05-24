---
title: Introduction
description: What @asteroidcms/core-utils is, how its two entry points are split between server and client code, and the mental model for using it in React and Next.js apps.
order: 1
---

# Introduction

`@asteroidcms/core-utils` is the official Web SDK for [Asteroid CMS](https://github.com/asteroidorg). It bundles everything a React or Next.js app needs to read and write content:

- `<AsteroidCMSProvider>` — wires up Apollo Client and auth headers in one place.
- Hooks — `useCmsContent`, `useCmsMutate`, `useCmsImage`.
- `fetchCmsContent` — a server helper for Next.js App Router, Route Handlers, and any non-React server context.
- `<RichTextContent>` — a sanitized rich-text renderer with on-demand syntax highlighting.
- Utilities — `cmsImage`, `getContentReadTime`, `buildCmsQuery`, `parseRichText`.

---

## Two entry points

The package ships two subpath exports. **Pick the one that matches the runtime you're writing for**, not by personal preference.

| Subpath                          | Where to use it                                                  | What's inside                                                                                          |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@asteroidcms/core-utils`        | Server Components, Route Handlers, build scripts, plain Node, SSR loaders. | `fetchCmsContent`, `buildCmsQuery`, `createApolloClient`, `cmsImage`, `getContentReadTime`, `parseRichText`, all types. |
| `@asteroidcms/core-utils/client` | Anything that uses React state, hooks, or context.               | `AsteroidCMSProvider`, `useCmsContent`, `useCmsMutate`, `useCmsImage`, `useAsteroidCMSConfig`, `<RichTextContent>`.     |

The `/client` bundle is marked with the `"use client"` directive, so importing it from a Next.js Server Component will automatically mark that import as a client boundary. The main bundle has no directive and is fully RSC-safe — you can call `fetchCmsContent` directly in an `async` Server Component.

> **One rule to remember:** if it's a hook or a context provider, import it from `/client`. Everything else lives at the root.

---

## Mental model

Most apps end up with two flows running side-by-side:

1. **Server-rendered reads.** Pages that need SEO, fast first paint, or static export use `fetchCmsContent` against a per-request Apollo client. Data lands as plain JSON before hydration.
2. **Client-side reads and writes.** Interactive widgets (newsletter forms, comment threads, live lists) mount under `<AsteroidCMSProvider>` and use `useCmsContent` / `useCmsMutate` to subscribe to the same backend.

A Next.js app typically wires both: the root layout imports the provider for client-side hooks, and individual pages call `fetchCmsContent` directly when they need server-rendered data. The two paths share nothing at runtime — they're independent code paths with independent Apollo caches.

---

## Versioning

The SDK is pre-1.0 and follows semver. Breaking changes are called out in the changelog. APIs in this docs section reflect the latest published version on npm.

---

## Where to next

- New to the SDK? Start with **[Installation »](./02-installation.md)**.
- Already installed it? Jump to **[Configure the provider »](./03-provider.md)** for client-side hooks, or **[Next.js server rendering »](./04-nextjs-server-rendering.md)** for RSC patterns.
