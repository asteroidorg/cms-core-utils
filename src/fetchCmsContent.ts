import "server-only";

import { query as serverQuery } from "@/config/Apollo/ServerApolloClient";
import { buildCmsQuery, type UseCmsContentOptions } from "./build-query";

export async function fetchCmsContent<T>(
  opts: UseCmsContentOptions,
): Promise<T> {
  const { query, variables, isSingle } = buildCmsQuery(opts);
  const { data } = await serverQuery({
    query,
    variables,
  });

  return (isSingle
    ? (data as { entry: T }).entry
    : (data as { entries: T }).entries) as T;
}
