import { useMemo, type PropsWithChildren } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { AsteroidCMSContext } from "./context";
import { createApolloClient, resolveConfig } from "../apollo/createApolloClient";
import type { AsteroidCMSConfig } from "./types";

export type AsteroidCMSProviderProps = PropsWithChildren<AsteroidCMSConfig>;

/**
 * Root provider for `@asteroidcms/core-utils`.
 *
 * Wrap your app once at the top level:
 *
 * ```tsx
 * <AsteroidCMSProvider cmsUrl="https://cms.example.com" apiKey="...">
 *   <App />
 * </AsteroidCMSProvider>
 * ```
 *
 * Everything below — `useCmsContent`, `useCmsMutate`, `useCmsImage`,
 * `<RichTextContent>` — picks up `cmsUrl` and `apiKey` from this provider.
 */
export function AsteroidCMSProvider({ children, ...config }: AsteroidCMSProviderProps) {
  const resolved = useMemo(() => resolveConfig(config), [
    config.cmsUrl,
    config.apiKey,
    config.graphqlPath,
    config.mediaPath,
    config.headers,
    config.onError,
  ]);

  const client = useMemo(
    () => createApolloClient(config),
    // The client is intentionally rebuilt only when the identity-shaping props change.
    [
      config.client,
      resolved.cmsUrl,
      resolved.apiKey,
      resolved.graphqlPath,
      config.cacheConfig,
      config.apolloOptions,
    ],
  );

  return (
    <AsteroidCMSContext.Provider value={resolved}>
      <ApolloProvider client={client}>{children}</ApolloProvider>
    </AsteroidCMSContext.Provider>
  );
}

export default AsteroidCMSProvider;
