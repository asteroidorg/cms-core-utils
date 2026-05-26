import { buildCmsQuery, type UseCmsContentOptions } from "./build-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApolloClient = { query: (...args: any[]) => any };

export async function fetchCmsContent<T>(
  getClient: () => AnyApolloClient,
  opts: UseCmsContentOptions,
): Promise<T> {
  const { query, variables, isSingle } = buildCmsQuery(opts);
  const { data } = await getClient().query({ query, variables });

  return (isSingle
    ? (data as { entry: T }).entry
    : (data as { entries: T }).entries) as T;
}
