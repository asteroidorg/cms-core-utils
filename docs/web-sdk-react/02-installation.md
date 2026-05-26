---
title: Installation
description: Install @asteroidcms/core-utils and its peer dependencies, pick the right entry point, and verify the install with a smoke test.
order: 2
---

# Installation

---

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node | `>=18` | Required by Apollo Client v4. |
| React | `>=18.0.0` | React 19 is supported. |
| React DOM | `>=18.0.0` | Must match the React version. |
| Apollo Client | `^4.0.0` | Peer dependency — the SDK does not bundle its own copy. |
| `graphql` | `^16.0.0` | Peer dependency of Apollo Client. |
| TypeScript | `>=5.0` (optional) | Types ship alongside the JS in `dist/`. |

The package is `"type": "module"` and ships both ESM (`dist/*.js`) and CJS (`dist/*.cjs`) builds. Vite, Next.js, Remix, and webpack 5 all pick the right one automatically.

---

## Install

Choose your package manager:

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

All four peer dependencies must be present in your `package.json`. If `react` and `react-dom` are already there, you only need the first three.

### Optional: Next.js App Router integration

For Server Components, also install Apollo's Next.js bridge:

```bash
npm install @apollo/client-integration-nextjs
```

This provides `registerApolloClient`, which the [server rendering guide](/docs/web-sdk-react/nextjs-server-rendering) uses.

---

## Choosing an entry point

| Runtime / file context | Import from |
| --- | --- |
| Server Components, Route Handlers, build scripts, SSR loaders, plain Node | `@asteroidcms/core-utils` |
| Client Components, hooks, anything inside a `"use client"` file | `@asteroidcms/core-utils/client` |

> **Common mistake:** Importing a hook (e.g. `useCmsContent`) from the root path will fail — hooks only live under `/client`. Likewise, importing `fetchCmsContent` from `/client` pulls `"use client"` into your server file. **Match the entry to the runtime.**

---

## Framework-specific setup

### Next.js (App Router, 13.4+)

1. Create an `app/providers.tsx` file that wraps children in `<AsteroidCMSProvider>` (from `/client`).
2. Import `Providers` in your root `app/layout.tsx`.
3. For Server Components, call `fetchCmsContent` or `cmsMutate` directly — see [Next.js server rendering](/docs/web-sdk-react/nextjs-server-rendering).

```tsx
// app/providers.tsx
import { AsteroidCMSProvider } from "@asteroidcms/core-utils/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AsteroidCMSProvider
      cmsUrl={process.env.NEXT_PUBLIC_ASTEROID_URL!}
      apiKey={process.env.NEXT_PUBLIC_ASTEROID_KEY!}
    >
      {children}
    </AsteroidCMSProvider>
  );
}
```

### Vite / CRA / Remix / Gatsby

No special configuration needed. Add the provider once at the application root and call hooks anywhere below it.

### Static export / SSG

`fetchCmsContent` and `cmsMutate` run in any Node-capable build step. `<RichTextContent>` is server-safe (the parser never touches the DOM); highlight.js only runs after hydration.

---

## Verify the install

Drop this into any file to confirm both entries resolve:

```ts
import type { AsteroidCMSConfig } from "@asteroidcms/core-utils";

const ping: AsteroidCMSConfig = {
  cmsUrl: "https://cms.example.com",
  apiKey: "demo",
};

console.log("SDK loaded:", ping.cmsUrl);
```

If your editor resolves the type and your bundler doesn't error, you're ready to go.

---

## Troubleshooting

### `Cannot find module '@apollo/client/react'`

Apollo Client v4 uses subpath exports. Make sure you installed `@apollo/client@^4`, not v3.

### `Module not found: Can't resolve 'graphql'`

`graphql` is a peer dependency of Apollo. Install it explicitly even if Apollo seems to work without it — some bundlers fail at runtime.

### `useState only works in Client Components`

You imported a hook or the provider from `@asteroidcms/core-utils` (the server entry). Switch that import to `@asteroidcms/core-utils/client`.

### TypeScript "could not find a declaration file"

The SDK ships its own types. If you see this, your `tsconfig.json` likely has `"moduleResolution": "node"` (legacy). Switch to `"bundler"` or `"node16"` so the `exports` map is honored.

### Styles missing for code blocks in rich text

`<RichTextContent>` ships the `tokyo-night-dark` highlight.js theme as an inline string and injects it via a `<style>` tag on mount. No CSS import is required. If the theme isn't visible, confirm the component actually mounted — it runs the injection inside `useEffect`, so SSR-only renders won't trigger it.

---

## FAQ

**Can I use this without TypeScript?**
Yes. The package ships compiled JavaScript. TypeScript is optional — types are included alongside the JS for editors that support them.

**Does it work with React 19?**
Yes. The SDK is compatible with React 18 and 19.

**Do I need Apollo Client if I only use server-side functions?**
`fetchCmsContent` and `cmsMutate` accept any object with a `query` or `mutate` method. You still need `@apollo/client` installed because `buildCmsQuery` and `buildCmsMutation` use `gql` from it, but you don't need to set up the provider.

**What's the bundle size impact?**
The client entry adds Apollo Client (which you likely already have) plus ~35KB gzipped for highlight.js (only if you use `<RichTextContent>`). The server entry is under 5KB.
