---
title: Introduction
description: What @asteroidcms/core-utils is, how its two entry points work, and the mental model for reading and writing CMS content in React and Next.js apps.
order: 1
---

# Introduction

`@asteroidcms/core-utils` is the official React SDK for [Asteroid CMS](https://cms.theasteroid.tech). It gives your app everything it needs to read, write, and render CMS content — from a single provider to server-side helpers and a full-featured rich-text renderer.

---

## What's included

| Category | What you get |
| --- | --- |
| **Provider** | `<AsteroidCMSProvider>` — wires up Apollo Client and auth headers in one place. |
| **Reading** | `useCmsContent` (client), `fetchCmsContent` (server) — query entries with a declarative selector syntax. |
| **Writing** | `useCmsMutate` (client), `cmsMutate` (server) — create, update, and delete entries. |
| **Images** | `cmsImage` / `useCmsImage` — resolve asset IDs into canonical media URLs. |
| **Rich text** | `<RichTextContent>` — sanitized HTML renderer with syntax highlighting, callouts, and collapsibles. `parseRichText` for server-safe parsing. |
| **Utilities** | `getContentReadTime`, `buildCmsQuery`, `buildCmsMutation`, `extractHeadingsFromHtml`, `slugify`. |

---

## Two entry points

The SDK ships two subpath exports. Pick the one that matches the runtime you're writing for.

| Subpath | Where to use it | What's inside |
| --- | --- | --- |
| `@asteroidcms/core-utils` | Server Components, Route Handlers, build scripts, plain Node, SSR loaders. | `fetchCmsContent`, `cmsMutate`, `buildCmsQuery`, `buildCmsMutation`, `createApolloClient`, `cmsImage`, `getContentReadTime`, `parseRichText`, `extractHeadingsFromHtml`, all types. |
| `@asteroidcms/core-utils/client` | Client Components, hooks, anything that uses React state or context. | `AsteroidCMSProvider`, `useCmsContent`, `useCmsMutate`, `useCmsImage`, `useAsteroidCMSConfig`, `RichTextContent`. |

The `/client` bundle includes the `"use client"` directive, so importing it from a Server Component automatically creates a client boundary. The main bundle has no directive and is fully RSC-safe.

> **Rule of thumb:** if it's a hook or a context provider, import from `/client`. Everything else lives at the root.

---

## Mental model

Most apps end up with two flows running side-by-side:

1. **Server-rendered reads.** Pages that need SEO, fast first paint, or static export use `fetchCmsContent` against a per-request Apollo client. Data lands as plain JSON before hydration.
2. **Client-side reads and writes.** Interactive widgets (newsletter forms, comment threads, live lists) mount under `<AsteroidCMSProvider>` and use `useCmsContent` / `useCmsMutate`.

A Next.js app typically wires both: the root layout imports the provider for client-side hooks, and individual pages call `fetchCmsContent` or `cmsMutate` directly when they need server-rendered data. The two paths are independent — they have separate Apollo caches.

```
┌────────────────────────────────────────────────────────┐
│  Server (RSC / Route Handlers / build scripts)         │
│                                                        │
│  fetchCmsContent(getClient, { ... })  ← reads          │
│  cmsMutate(getClient, { ... })        ← writes         │
│  parseRichText(html)                  ← render          │
└────────────────────────────────────────────────────────┘
                        ↓  HTML / JSON
┌────────────────────────────────────────────────────────┐
│  Client (React tree under <AsteroidCMSProvider>)       │
│                                                        │
│  useCmsContent({ ... })               ← reads          │
│  useCmsMutate({ ... })                ← writes         │
│  <RichTextContent html={...} />       ← render          │
│  useCmsImage()                        ← media           │
└────────────────────────────────────────────────────────┘
```

---

## Server vs. client: which do I use?

| Scenario | Use this | Why |
| --- | --- | --- |
| Blog post page (SEO matters) | `fetchCmsContent` in a Server Component | HTML is ready before hydration. |
| Dashboard with live data | `useCmsContent` in a Client Component | Reactive — updates when data changes. |
| Newsletter signup form | `useCmsMutate` in a Client Component | Runs in the browser after user interaction. |
| Webhook-triggered content update | `cmsMutate` in a Route Handler | Runs on the server with a write-scoped API key. |
| Static site generation | `fetchCmsContent` in `generateStaticParams` | Runs at build time. |

---

## Versioning

The SDK is pre-1.0 and follows semver. Breaking changes are called out in the changelog. APIs in this documentation reflect the latest published version on npm.

---

## Where to next

- New to the SDK? Start with **[Installation](/docs/web-sdk-react/installation)**.
- Already installed? Jump to **[Configure the provider](/docs/web-sdk-react/provider)** for client-side hooks, or **[Next.js server rendering](/docs/web-sdk-react/nextjs-server-rendering)** for RSC patterns.
