// src/server/cmsServerClient.ts
import type { ApolloClient } from "@apollo/client";
import * as React from "react";
import { createApolloClient, resolveConfig } from "../apollo/createApolloClient";

// React.cache exists in React 19 / RSC (and Next's bundled React); it is absent
// in stable React 18. Fall back to an identity wrapper so the factory still works
// (without per-request dedup) outside an RSC runtime.
type CacheFn = <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => R;
const reactCache: CacheFn =
  (React as unknown as { cache?: CacheFn }).cache ?? ((fn) => fn);

export interface CmsServerClientConfig {
  cmsUrl: string;
  apiKey: string;
  graphqlPath?: string;
  headers?: Record<string, string>;
  /** Next.js ISR revalidate seconds, applied to the GraphQL fetch. */
  revalidate?: number;
  /** Next.js cache tags for on-demand revalidation. */
  tags?: string[];
  /** Escape hatch: provide a pre-built client (e.g. registerApolloClient). */
  getClient?: () => ApolloClient;
}

export interface CmsServerClient {
  getClient: () => ApolloClient;
  cmsUrl: string;
}

/**
 * Build a server-only CMS client for use with `fetchCmsContent` / `cmsMutate`.
 * The API key stays on the server. The client is memoized per-request via
 * React `cache()` for query deduplication.
 */
export function createCmsServerClient(config: CmsServerClientConfig): CmsServerClient {
  // resolveConfig validates cmsUrl + apiKey and normalizes the URL.
  const resolved = resolveConfig({
    cmsUrl: config.cmsUrl,
    apiKey: config.apiKey,
    graphqlPath: config.graphqlPath,
    headers: config.headers,
  });

  const next =
    config.revalidate !== undefined || config.tags !== undefined
      ? { revalidate: config.revalidate, tags: config.tags }
      : undefined;

  const factory =
    config.getClient ??
    (() =>
      createApolloClient({
        cmsUrl: resolved.cmsUrl,
        apiKey: resolved.apiKey,
        graphqlPath: resolved.graphqlPath,
        headers: resolved.headers,
        ...(next
          ? { apolloOptions: { defaultContext: { fetchOptions: { next } } } as never }
          : {}),
      }));

  return { getClient: reactCache(factory), cmsUrl: resolved.cmsUrl };
}
