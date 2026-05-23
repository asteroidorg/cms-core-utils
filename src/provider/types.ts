import type { ApolloClient, ApolloClientOptions, InMemoryCacheConfig } from "@apollo/client";

export type AsteroidCMSConfig = {
  /** Base URL of the Asteroid CMS API (e.g. https://cms-api.example.com). */
  cmsUrl: string;
  /** API key sent as the `x-api-key` header on every request. */
  apiKey: string;
  /** Optional path appended to `cmsUrl` for the GraphQL endpoint. Defaults to "/graphql". */
  graphqlPath?: string;
  /** Optional path appended to `cmsUrl` for canonical media. Defaults to "/media/canonical". */
  mediaPath?: string;
  /** Extra headers attached to every GraphQL request. */
  headers?: Record<string, string>;
  /** Called for every GraphQL/network error. Use this to wire your own toast/logger. */
  onError?: (error: unknown) => void;
  /** Optional cache options forwarded to the InMemoryCache constructor. */
  cacheConfig?: InMemoryCacheConfig;
  /** Escape hatch — override any field on the underlying ApolloClient. */
  apolloOptions?: Partial<ApolloClientOptions>;
  /** Provide a pre-built ApolloClient and skip the internal factory entirely. */
  client?: ApolloClient;
};

export type ResolvedAsteroidCMSConfig = Required<
  Pick<AsteroidCMSConfig, "cmsUrl" | "apiKey" | "graphqlPath" | "mediaPath">
> & {
  headers: Record<string, string>;
  onError?: AsteroidCMSConfig["onError"];
};
