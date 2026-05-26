---
title: Configure the provider
description: Mount <AsteroidCMSProvider> to wire Apollo Client and auth headers in one place for every hook in your app.
order: 3
---

# Configure the provider

`<AsteroidCMSProvider>` is the single integration point for the client-side SDK. It does three things:

1. Builds an `ApolloClient` (or accepts one you already own).
2. Mounts Apollo's `<ApolloProvider>` so hooks can subscribe to the cache.
3. Publishes a `ResolvedAsteroidCMSConfig` context so utilities like `useCmsImage` read settings without re-passing props.

Wrap your app **once**, at the root. Everything below the provider — hooks, the rich-text renderer, image helpers — reads from it automatically.

> The provider lives on the **client** subpath: `@asteroidcms/core-utils/client`. It's marked with `"use client"`, so importing it from a Server Component automatically creates a client boundary.

---

## Minimal setup

```tsx
import { AsteroidCMSProvider } from "@asteroidcms/core-utils/client";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AsteroidCMSProvider
      cmsUrl="https://cms.example.com"
      apiKey={process.env.NEXT_PUBLIC_ASTEROID_API_KEY!}
    >
      {children}
    </AsteroidCMSProvider>
  );
}
```

`cmsUrl` and `apiKey` are the only required props.

> The `apiKey` is sent as the `x-api-key` header on every GraphQL request. Use a **public, read-scoped key** when this runs in the browser. Write-capable keys belong on the server only — see [Next.js server rendering](/docs/web-sdk-react/nextjs-server-rendering).

---

## All configuration props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `cmsUrl` | `string` (required) | — | Base URL of the CMS API. Trailing slashes are trimmed. |
| `apiKey` | `string` (required) | — | Sent as `x-api-key` on every request. |
| `graphqlPath` | `string` | `"/graphql"` | Appended to `cmsUrl` for the GraphQL endpoint. |
| `mediaPath` | `string` | `"/media/canonical"` | Appended to `cmsUrl` when `cmsImage`/`useCmsImage` builds asset URLs. |
| `headers` | `Record<string, string>` | `{}` | Extra headers sent on every request (e.g. tenant ID, locale). |
| `onError` | `(error: unknown) => void` | — | Called for every GraphQL or network error. Wire to your toast/logger. |
| `cacheConfig` | `InMemoryCacheConfig` | — | Forwarded to Apollo's `InMemoryCache` constructor (custom `typePolicies`, etc.). |
| `apolloOptions` | `Partial<ApolloClientOptions>` | — | Escape hatch — overrides fields on the internal `ApolloClient`. |
| `client` | `ApolloClient` | — | BYO client. When set, the provider skips its internal factory entirely. |

The provider memoizes the client and the resolved config — it only rebuilds when an identity-shaping prop changes (`cmsUrl`, `apiKey`, `graphqlPath`, `cacheConfig`, `apolloOptions`, or the passed-in `client`).

---

## Recipes

### Next.js App Router

```tsx
// app/providers.tsx
import { AsteroidCMSProvider } from "@asteroidcms/core-utils/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AsteroidCMSProvider
      cmsUrl={process.env.NEXT_PUBLIC_ASTEROID_URL!}
      apiKey={process.env.NEXT_PUBLIC_ASTEROID_KEY!}
      onError={(err) => console.error("[CMS]", err)}
    >
      {children}
    </AsteroidCMSProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

You **don't** need to add `"use client"` at the top of `providers.tsx` — the import from `/client` already establishes the boundary.

### Vite / CRA

```tsx
import { createRoot } from "react-dom/client";
import { AsteroidCMSProvider } from "@asteroidcms/core-utils/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <AsteroidCMSProvider
    cmsUrl={import.meta.env.VITE_CMS_URL}
    apiKey={import.meta.env.VITE_CMS_KEY}
  >
    <App />
  </AsteroidCMSProvider>,
);
```

### Multi-tenant headers

```tsx
<AsteroidCMSProvider
  cmsUrl="https://cms.example.com"
  apiKey={publicKey}
  headers={{
    "x-tenant-id": currentTenantId,
    "accept-language": locale,
  }}
>
  {children}
</AsteroidCMSProvider>
```

Headers are merged on top of `x-api-key`. To override the default key, set `"x-api-key"` inside `headers`.

### Centralized error handling

```tsx
<AsteroidCMSProvider
  cmsUrl={url}
  apiKey={key}
  onError={(err) => {
    if (err instanceof Error) {
      toast.error(err.message);
      logger.captureException(err);
    }
  }}
>
  {children}
</AsteroidCMSProvider>
```

`onError` fires for both GraphQL errors and network failures. It's the right place to surface "CMS is unreachable" or "expired API key" feedback.

### Bring your own Apollo client

If your app already runs Apollo for non-CMS data, share the instance:

```tsx
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { AsteroidCMSProvider } from "@asteroidcms/core-utils/client";

const client = new ApolloClient({
  link: new HttpLink({
    uri: "https://cms.example.com/graphql",
    headers: { "x-api-key": process.env.NEXT_PUBLIC_KEY! },
  }),
  cache: new InMemoryCache(),
});

<AsteroidCMSProvider cmsUrl="https://cms.example.com" apiKey="..." client={client}>
  {children}
</AsteroidCMSProvider>;
```

When `client` is provided, `cacheConfig` and `apolloOptions` are ignored — the SDK assumes the client is fully configured. `cmsUrl` and `apiKey` are still required because non-Apollo utilities (`useCmsImage`) read them from context.

---

## Reading config inside your own components

Need the same URLs the SDK uses (e.g. for a hand-rolled `fetch` loader)? Use the public hook:

```tsx
import { useAsteroidCMSConfig } from "@asteroidcms/core-utils/client";

function DebugInfo() {
  const { cmsUrl, graphqlPath, mediaPath } = useAsteroidCMSConfig();
  return <code>{cmsUrl + graphqlPath}</code>;
}
```

Calling `useAsteroidCMSConfig` outside `<AsteroidCMSProvider>` throws a descriptive error — useful as a hard guarantee that the provider is mounted.

---

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Mounting two providers | Don't wrap individual pages — wrap once at the root. Multiple providers create separate Apollo caches. |
| Importing from `@asteroidcms/core-utils` | That's the server entry. Provider and hooks live under `/client`. |
| Hardcoding `apiKey` in source | Use environment variables. For Next.js, only `NEXT_PUBLIC_*` vars reach the browser. |
| `mediaPath` without a leading slash | Normalized automatically, but the value from `useAsteroidCMSConfig()` will always start with `/`. |

---

## FAQ

**Can I nest providers?**
Yes. The inner provider wins for all descendants. This is useful for multi-CMS setups but rare in practice.

**Will the client rebuild on every render?**
No. The provider memoizes the Apollo client. It only rebuilds when identity-shaping props change.

**What if I only use server-side functions?**
You don't need the provider at all. `fetchCmsContent` and `cmsMutate` take their own client. The provider is only for client-side hooks.
