---
title: Installation
description: Install @asteroidcms/core-utils and its peer dependencies, pick the right entry point for your runtime, and verify the install with a one-line smoke test.
order: 2
---

# Installation

## Requirements

| Requirement   | Version          | Notes                                                                 |
| ------------- | ---------------- | --------------------------------------------------------------------- |
| Node          | `>=18`           | Required by Apollo Client v4.                                         |
| React         | `>=18.0.0`       | React 19 is supported.                                                |
| React DOM     | `>=18.0.0`       | Must match the React version installed in your app.                   |
| Apollo Client | `^4.0.0`         | Peer dependency. The SDK does not bundle its own copy.                |
| `graphql`     | `^16.0.0`        | Peer dependency of Apollo Client.                                     |
| TypeScript    | `>=5.0` (opt.)   | Types ship alongside the JS in `dist/`.                               |

The package is `"type": "module"` and ships both ESM (`dist/*.js`) and CJS (`dist/*.cjs`) builds. Vite, Next.js, Remix, and webpack 5 all pick the right one automatically.

---

## Install

```bash
# npm
npm install @asteroidcms/core-utils @apollo/client graphql react react-dom

# pnpm
pnpm add @asteroidcms/core-utils @apollo/client graphql react react-dom

# yarn
yarn add @asteroidcms/core-utils @apollo/client graphql react react-dom

# bun
bun add @asteroidcms/core-utils @apollo/client graphql react react-dom
```

All four peer dependencies must be present in your application's `package.json` — the SDK will not install them for you. If `react`/`react-dom` are already there, you only need the first three.

### Optional: Next.js App Router integration

For RSC, also install Apollo's Next.js bridge:

```bash
npm install @apollo/client-integration-nextjs
```

It provides `registerApolloClient`, which the [server rendering guide](./04-nextjs-server-rendering.md) uses.

---

## Choosing an entry point

| Runtime / file context                                  | Import from                       |
| ------------------------------------------------------- | --------------------------------- |
| Server Components, Route Handlers, build scripts, SSR loaders, plain Node | `@asteroidcms/core-utils`         |
| Client Components, hooks, anything inside a `"use client"` file | `@asteroidcms/core-utils/client`  |

Importing a hook (e.g. `useCmsContent`) from the root path will fail — those exports only live under `/client`. Likewise, importing `fetchCmsContent` from `/client` will pull `"use client"` into your server file by mistake. **Match the entry to the runtime.**

---

## Framework notes

### Next.js (App Router, 13.4+)

- Wrap your interactive tree in `<AsteroidCMSProvider>` (from `/client`) inside a small `app/providers.tsx` file. The provider re-exports the `"use client"` boundary; you don't need to mark your wrapper file unless you also do other client-only work in it.
- For Server Components, call `fetchCmsContent` directly. It needs a `getClient` callable — see [Next.js server rendering »](./04-nextjs-server-rendering.md).

### Vite / CRA / Remix / Gatsby

No special configuration needed. Add the provider once at the application root and call hooks anywhere below it.

### Static export / SSG

`fetchCmsContent` runs in any Node-capable build step. `<RichTextContent>` is server-safe (parse step never touches the DOM); highlight.js only runs after hydration.

---

## Verify the install

Drop this into any file to confirm both entries resolve. It doesn't require the provider.

```ts
import type { AsteroidCMSConfig } from "@asteroidcms/core-utils";
// import { AsteroidCMSProvider } from "@asteroidcms/core-utils/client"; // optional

const ping: AsteroidCMSConfig = {
  cmsUrl: "https://cms.example.com",
  apiKey: "demo",
};

console.log("SDK loaded:", ping.cmsUrl);
```

If your editor resolves the type and your bundler doesn't error, you're ready. Continue to **[Configure the provider »](./03-provider.md)**.

---

## Troubleshooting

**`Cannot find module '@apollo/client/react'`**
Apollo Client v4 uses subpath exports. Make sure you installed `@apollo/client@^4`, not v3.

**`Module not found: Can't resolve 'graphql'`**
`graphql` is a peer dependency of Apollo. Install it explicitly even if Apollo seems to work without it — some bundlers fail at runtime.

**`useState only works in Client Components` (or similar) on a server file**
You imported a hook or the provider from the root `@asteroidcms/core-utils`. Switch that import to `@asteroidcms/core-utils/client`.

**TypeScript "could not find a declaration file"**
The SDK ships its own types. If you see this, your `tsconfig.json` likely has `"moduleResolution": "node"` (legacy). Switch to `"bundler"` or `"node16"` so the `exports` map is honored.

**Styles missing for code blocks in rich text**
`<RichTextContent>` imports `highlight.js/styles/tokyo-night-dark.css` as a side effect. If you tree-shake CSS aggressively, allow CSS from `@asteroidcms/core-utils` in your bundler config — the package marks `**/*.css` as a side effect.
