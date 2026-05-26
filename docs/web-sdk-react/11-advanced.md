---
title: Advanced topics
description: Low-level escape hatches — buildCmsQuery, buildCmsMutation, BYO Apollo client, pagination merging, polling, cache eviction, performance tips, and security.
order: 11
---

# Advanced topics

The hooks and server helpers cover the 80% case. This page is for everything else: building queries without executing them, sharing clients across apps, tuning the Apollo cache, and the rough edges worth knowing about in production.

---

## Build queries without executing them

### `buildCmsQuery`

The pure function that powers `useCmsContent` and `fetchCmsContent`. Use it when you need the GraphQL document and variables but want to execute through your own pipeline.

```ts
import { buildCmsQuery } from "@asteroidcms/core-utils";

const { query, variables, isSingle } = buildCmsQuery({
  schema_slug: "blog-posts",
  entrySlug: "hello",
  select: ["title", "body"],
});

console.log(query.loc?.source.body); // the printed GraphQL
console.log(variables);              // { schema_slug: "blog-posts", slug: "hello" }
console.log(isSingle);               // true
```

**Use cases:**
- Wire into a non-Apollo fetcher (`graphql-request`, `urql`).
- Inspect generated queries in tests.
- Compose with persisted-query workflows.

### `buildCmsMutation`

The mutation counterpart:

```ts
import { buildCmsMutation } from "@asteroidcms/core-utils";

const { mutation, variables } = buildCmsMutation({
  schema_slug: "blog-posts",
  mutationType: "create",
  select: ["title", "slug"],
  variables: { data: { title: "Hello" } },
});

const { data } = await apolloClient.mutate({ mutation, variables });
```

---

## Sharing an Apollo client

### One client, multiple endpoints

Use Apollo's `split` link to route operations by name or directive:

```ts
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  split,
} from "@apollo/client";

const cmsLink = new HttpLink({
  uri: "https://cms.example.com/graphql",
  headers: { "x-api-key": process.env.NEXT_PUBLIC_CMS_KEY! },
});

const appLink = new HttpLink({ uri: "/api/graphql" });

const link = split(
  ({ query }) =>
    query.definitions.some(
      (def) =>
        def.kind === "OperationDefinition" && def.name?.value.startsWith("Get"),
    ),
  cmsLink,
  appLink,
);

const client = new ApolloClient({ link, cache: new InMemoryCache() });
```

Pass it via `<AsteroidCMSProvider client={client} cmsUrl={...} apiKey={...}>`.

### Two separate clients

Keep your existing `<ApolloProvider>` for your app data and let `<AsteroidCMSProvider>` mount its own. Apollo's `<ApolloProvider>` replaces context — the innermost wins for descendants.

---

## Advanced caching

### Pagination merging

If you use `fetchMore` and want the cache to merge results, configure `typePolicies`:

```tsx
<AsteroidCMSProvider
  cmsUrl={url}
  apiKey={key}
  cacheConfig={{
    typePolicies: {
      Query: {
        fields: {
          contentEntries: {
            keyArgs: ["schema_slug", "status", "data"],
            merge(existing = [], incoming, { args }) {
              const offset = args?.offset ?? 0;
              const merged = existing.slice();
              for (let i = 0; i < incoming.length; i++) {
                merged[offset + i] = incoming[i];
              }
              return merged;
            },
          },
        },
      },
    },
  }}
>
  {children}
</AsteroidCMSProvider>
```

`keyArgs` controls which arguments produce a *new* cache entry — `offset` and `limit` are excluded so they merge into the same array.

### Polling

Polling isn't exposed directly on `useCmsContent`. Fall back to `useQuery` by composing with `buildCmsQuery`:

```tsx
import { useQuery } from "@apollo/client/react";
import { buildCmsQuery } from "@asteroidcms/core-utils";

const { query, variables } = buildCmsQuery({
  schema_slug: "live-scores",
  select: ["home", "away"],
});

const { data } = useQuery(query, { variables, pollInterval: 5000 });
```

Or `refetch` on an interval with `useEffect`.

### Cache eviction after mutations

Drop a cached entry rather than refetching:

```ts
import { useApolloClient } from "@apollo/client/react";

const client = useApolloClient();
client.cache.evict({ fieldName: "contentEntries" });
client.cache.gc();
```

---

## Performance tips

| Tip | Why |
| --- | --- |
| Prefer `select` over `fullData` | Each `dataField` is cheaper than serializing the whole document. |
| Expand references only where used | Each `expandedReference` adds resolver cost. |
| Memoize `classMap` objects | `<RichTextContent>` re-parses when inputs change. |
| Cap `limit` per request | Use `fetchMore` instead of `limit: 10000`. |
| Use `fetchCmsContent` for above-the-fold content | Server-rendered HTML loads faster. |
| Skip highlight.js when not needed | Use `parseRichText` for pages without code blocks. |

---

## Security notes

| Rule | Details |
| --- | --- |
| Never put a write key in `NEXT_PUBLIC_*` | Public keys should be read-scoped. Write keys belong on the server. |
| Sanitize untrusted regex input | Pass user input through `escape-string-regexp` before using in `search.value`. |
| Allowlist HTML carefully | The default `parseRichText` allowlist is safe. Audit any additions — especially `iframe`, `object`, `embed`, `form`, `style`. |
| Trust the `x-api-key` boundary | Don't encode user identity in it. Use a separate auth mechanism for per-user access. |
| `import "server-only"` | Add it to your CMS server file to prevent write-scoped keys from leaking to the client bundle. |

---

## Complete API reference

### Server-safe exports (`@asteroidcms/core-utils`)

| Export | Type | Description |
| --- | --- | --- |
| `fetchCmsContent<T>(getClient, opts)` | Function | Server-side content reads. |
| `cmsMutate<T>(getClient, opts)` | Function | Server-side content writes. |
| `buildCmsQuery(opts)` | Function | Returns `{ query, variables, isSingle }`. |
| `buildCmsMutation(opts)` | Function | Returns `{ mutation, variables }`. |
| `createApolloClient(config)` | Function | Apollo client factory. |
| `cmsImage(id, opts)` | Function | Asset URL builder. |
| `parseRichText(html, opts)` | Function | HTML sanitizer/parser. |
| `removeEmptyParagraphs(html)` | Function | Strips empty `<p>` tags. |
| `getContentReadTime(html, opts)` | Function | Reading time estimator. |
| `extractHeadingsFromHtml(html, opts)` | Function | Static heading extraction. |
| `extractHeadingsFromElement(el, opts)` | Function | Live DOM heading extraction. |
| `slugify(text)` | Function | URL-safe slug generator. |

### Client-safe exports (`@asteroidcms/core-utils/client`)

| Export | Type | Description |
| --- | --- | --- |
| `AsteroidCMSProvider` | Component | Apollo + config provider. |
| `useAsteroidCMSConfig()` | Hook | Read resolved config from provider. |
| `useCmsContent<T>(opts)` | Hook | Client-side content reads. |
| `useCmsMutate<T>(opts)` | Hook | Client-side content writes. |
| `useCmsImage()` | Hook | Asset URL builder (from context). |
| `RichTextContent` | Component | Rich-text renderer with highlighting. |
| `extractHeadingsFromElement(el, opts)` | Function | Re-exported for convenience. |
| `extractHeadingsFromHtml(html, opts)` | Function | Re-exported for convenience. |
| `slugify(text)` | Function | Re-exported for convenience. |

### Type exports

```ts
import type {
  AsteroidCMSConfig,
  ResolvedAsteroidCMSConfig,
  AsteroidCMSProviderProps,
  UseCmsContentOptions,
  UseCmsMutateOptions,
  CmsMutateOptions,
  MutationType,
  FieldSelector,
  ReferenceExpansion,
  ContentStatus,
  CmsSearchCondition,
  RichTextClassMap,
  RichTextClassKey,
  ParseRichTextOptions,
  HeadingLevel,
  ExtractedHeading,
  ExtractHeadingsOptions,
} from "@asteroidcms/core-utils";
```

---

## Further reading

- [Apollo Client v4 docs](https://www.apollographql.com/docs/react/)
- [Apollo's Next.js integration](https://github.com/apollographql/apollo-client-integrations)
- [highlight.js languages and themes](https://highlightjs.org/)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- Asteroid CMS API reference — see your CMS instance's `/docs` route

---

## FAQ

**What if the SDK can't express what I need?**
Drop the hooks and use `buildCmsQuery` or `buildCmsMutation` with your own Apollo client. That's the supported escape hatch — the same code path the SDK itself uses.

**Can I use the SDK with `urql` instead of Apollo?**
Not directly for the hooks (they use Apollo's `useQuery`/`useMutation`). But `buildCmsQuery` and `buildCmsMutation` return standard `DocumentNode` objects that work with any GraphQL client.

**How do I debug what query is being sent?**
Use `buildCmsQuery` to print the query, or check the Network tab in browser DevTools for the GraphQL payload.

**Is there a way to add polling to `useCmsContent`?**
Not built in. Compose `buildCmsQuery` with Apollo's `useQuery` and its `pollInterval` option as shown above.
