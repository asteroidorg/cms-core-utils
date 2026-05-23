import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { createErrorLink } from "./errorLink";
import type { AsteroidCMSConfig, ResolvedAsteroidCMSConfig } from "../provider/types";

declare module "@apollo/client" {
  namespace ApolloClient.DeclareDefaultOptions {
    interface WatchQuery {
      errorPolicy: "all";
      returnPartialData: false;
    }
    interface Query {
      errorPolicy: "all";
    }
    interface Mutate {
      errorPolicy: "none";
    }
  }
}

const trimTrailingSlash = (s: string) => s.replace(/\/+$/, "");
const ensureLeadingSlash = (s: string) => (s.startsWith("/") ? s : `/${s}`);

export function resolveConfig(config: AsteroidCMSConfig): ResolvedAsteroidCMSConfig {
  if (!config.cmsUrl) throw new Error("AsteroidCMSProvider: `cmsUrl` is required.");
  if (!config.apiKey) throw new Error("AsteroidCMSProvider: `apiKey` is required.");

  return {
    cmsUrl: trimTrailingSlash(config.cmsUrl),
    apiKey: config.apiKey,
    graphqlPath: ensureLeadingSlash(config.graphqlPath ?? "/graphql"),
    mediaPath: ensureLeadingSlash(config.mediaPath ?? "/media/canonical"),
    headers: config.headers ?? {},
    onError: config.onError,
  };
}

export function createApolloClient(config: AsteroidCMSConfig): ApolloClient {
  if (config.client) return config.client;

  const resolved = resolveConfig(config);
  const uri = `${resolved.cmsUrl}${resolved.graphqlPath}`;

  const authLink = new SetContextLink((_op, prevContext) => {
    const prevHeaders = (prevContext as { headers?: Record<string, string> }).headers ?? {};
    return {
      ...prevContext,
      headers: {
        ...prevHeaders,
        "x-api-key": resolved.apiKey,
        ...resolved.headers,
      },
    };
  });

  const httpLink = new HttpLink({ uri });

  return new ApolloClient({
    link: ApolloLink.from([createErrorLink(resolved.onError), authLink, httpLink]),
    cache: new InMemoryCache(config.cacheConfig),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
        errorPolicy: "all",
        returnPartialData: false,
      },
      query: { fetchPolicy: "network-only", errorPolicy: "all" },
      mutate: { errorPolicy: "none" },
    },
    ...config.apolloOptions,
  });
}
