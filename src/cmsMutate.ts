import { buildCmsMutation, type CmsMutateOptions } from "./build-mutation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApolloClient = { mutate: (...args: any[]) => any };

export async function cmsMutate<T>(
  getClient: () => AnyApolloClient,
  opts: CmsMutateOptions,
): Promise<T> {
  const { mutation, variables } = buildCmsMutation(opts);
  const { data } = await getClient().mutate({ mutation, variables });

  return (data as { result: T }).result;
}
