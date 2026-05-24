---
title: Advanced topics
description: Low-level escape hatches — buildCmsQuery, BYO Apollo client, pagination merging, polling, cache eviction, performance tips, security, and further reading.
order: 11
---

# Advanced topics

The hooks and `fetchCmsContent` cover the 80% case. This page is for everything else: building queries without executing them, sharing a client across apps, tuning the Apollo cache, and the rough edges worth knowing about in production.

---

## `buildCmsQuery`: build queries without executing them

`buildCmsQuery` is the pure function that powers `useCmsContent`, `useCmsMutate`, and `fetchCmsContent`. Use it when you need the GraphQL document and variables but want to execute the query through your own pipeline (e.g. a custom Apollo link, GraphQL inspection tooling, persisted queries).

```ts
import { buildCmsQuery } from "@asteroidcms/core-utils";

const { query, variables, isSingle } = buildCmsQuery({
  schema_slug: "blog-posts",
  entrySlug: "hello",
  select: ["title", "body"],
});

console.log(query.loc?.source.body); // → the printed GraphQL
console.log(variables);              // → { schema_slug: "blog-posts", slug: "hello" }
console.log(isSingle);               // → true
```

Use cases:

- Wire into a non-Apollo fetcher (`graphql-request`, `urql`).
- Inspect the generated query in tests.
- Compose with persisted-query workflows.

---

## Sharing an Apollo client

### One client, multiple endpoints

Use Apollo's `split` link to route operations by name or directive:

```ts
import {
  ApolloClient,
  ApolloLink,
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

Pass it via `<AsteroidCMSProvider client={client} cmsUrl={…} apiKey={…}>`.

### Two clients

Keep your existing `<ApolloProvider>` for your app data and let `<AsteroidCMSProvider>` mount its own underneath. Apollo's `<ApolloProvider>` replaces context, so the innermost wins for descendants — order matters.

---

## Advanced caching

### Pagination merging

If you call `useCmsContent` with rotating `offset` values and want the cache to merge results, configure `typePolicies` in the provider's `cacheConfig`:

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

The `keyArgs` allowlist controls which arguments produce a *new* cache entry — `offset` and `limit` are intentionally excluded so they all roll into the same array.

### Polling

`useCmsContent` returns Apollo's full result. Polling isn't exposed directly — fall back to `useQuery` by composing with `buildCmsQuery`:

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

After a write you sometimes want to drop a cached entry rather than refetch it:

```ts
import { useApolloClient } from "@apollo/client/react";

const client = useApolloClient();
client.cache.evict({ fieldName: "contentEntries" });
client.cache.gc();
```

Useful when you've changed a filter argument and don't want stale arrays lingering.

---

## Performance tips

- **Prefer specific selectors over `fullData`.** Each `dataField` call on the server is cheaper than serializing the whole document, and you ship less JSON over the wire.
- **Expand references only where used.** Each `expandedReference` adds a round trip on the resolver side. A 5-level deep expansion is rarely worth it — consider a denormalized field instead.
- **Memoize big `classMap` objects.** `<RichTextContent>` re-parses when its inputs change. If the `classMap` is created inline on every render, parsing runs every render. Lift it to module scope.
- **Cap `limit` per request.** `useCmsContent` happily issues `limit: 10000`. The server may not. Pick a paging size you can deliver in <200 ms and use `fetchMore` for the rest.
- **Use `fetchCmsContent` for above-the-fold content** in Next.js. Server-rendered HTML hits the browser faster than a client-side roundtrip.
- **Skip highlight.js when you don't need it.** Render via `parseRichText` + `dangerouslySetInnerHTML` for pages without code blocks.

---

## Security notes

- **Never put a write key in `NEXT_PUBLIC_*` or any browser env var.** Public keys should be read-scoped. Write keys belong on the server.
- **Sanitize untrusted regex input.** If you pass user input to `search.value`, escape regex metacharacters (e.g. with `escape-string-regexp`).
- **Allowlist HTML carefully.** The default `parseRichText` allowlist is safe. If you extend it, audit every additional tag — especially `iframe`, `object`, `embed`, `form`, and `style`.
- **Trust the `x-api-key` boundary.** It's a single header; rotating it via the `headers` prop is fine, but don't try to encode user identity in it. Use a separate auth mechanism for per-user access control.
- **`import "server-only"` in your CMS-server file.** It makes the file fail loudly if a client component ever imports it, keeping your server-scoped key off the client bundle.

---

## Further reading

- Apollo Client v4 — https://www.apollographql.com/docs/react/
- Apollo's Next.js integration — https://github.com/apollographql/apollo-client-integrations
- highlight.js languages and themes — https://highlightjs.org/
- Next.js Server Components — https://nextjs.org/docs/app/building-your-application/rendering/server-components
- Asteroid CMS API reference — see your CMS instance's `/docs` route

If you hit something the SDK can't express, drop the hooks and use `buildCmsQuery` + your own Apollo client — that's the supported escape hatch and the same code path the SDK itself uses internally.
