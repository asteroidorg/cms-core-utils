import type { ApolloClient } from "@apollo/client";
import { buildCmsQuery, type UseCmsContentOptions } from "./build-query";

export async function fetchCmsContent<T>(
  getClient: () => ApolloClient,
  opts: UseCmsContentOptions,
): Promise<T> {
  const { query, variables, isSingle } = buildCmsQuery(opts);
  const { data } = await getClient().query({ query, variables });

  return (isSingle
    ? (data as { entry: T }).entry
    : (data as { entries: T }).entries) as T;
}
