import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

type FieldSelector =
  | string
  | {
      field: string;
      as?: string;
      single?: boolean;
      select?: readonly (FieldSelector | ReferenceExpansion)[];
    };

type ReferenceExpansion = {
  field: string;
  as?: string;
  single?: boolean;
  select?: readonly (FieldSelector | ReferenceExpansion)[];
};

type MutationType = "create" | "update" | "delete";

export type UseCmsMutateOptions = {
  schema_slug: string;
  entrySlug?: string;
  select?: readonly (FieldSelector | ReferenceExpansion)[];
  fullData?: boolean;
  mutationType?: MutationType;
  entryId?: string;
  variables?: Record<string, any>;
};

/**
 * React hook for mutating content in Asteroid CMS (`create` / `update` / `delete`).
 * Uses the same selection syntax as `useCmsContent`.
 */
export function useCmsMutate<TData = unknown>({
  schema_slug,
  select = [],
  fullData = false,
  mutationType = "create",
  entryId,
  variables: inputVariables = {},
}: UseCmsMutateOptions) {
  const buildSelection = (
    items: readonly (FieldSelector | ReferenceExpansion)[] = [],
  ): string => {
    const lines: string[] = [];

    for (const item of items) {
      if (typeof item === "string") {
        lines.push(`${item}: dataField(slug: "${item}")`);
        continue;
      }

      const { field, as, single, select: subSelect } = item;
      const alias = as || field;

      if (!subSelect?.length) {
        lines.push(`${alias}: dataField(slug: "${field}")`);
        continue;
      }

      const resolver = single ? "expandedReferenceObject" : "expandedReference";
      const sub = buildSelection(subSelect) || "id slug";

      lines.push(`
        ${alias}: ${resolver}(slug: "${field}") {
          id
          slug
          ${sub}
        }
      `);
    }

    return lines.join("\n      ").trim();
  };

  const userSelection = buildSelection(select);
  let selection = fullData ? "data" : "";

  if (userSelection) {
    selection = selection ? `${selection}\n      ${userSelection}` : userSelection;
  }

  if (!selection) {
    selection = "id slug status version created_at updated_at";
  }

  const operation = mutationType;
  const mutationName = `${operation}ContentEntry`;

  const varDecls: string[] = ["$schema_slug: String!"];
  const callArgs: string[] = ["schema_slug: $schema_slug"];

  if (operation === "create" || operation === "update") {
    varDecls.unshift("$data: JSONObject!");
    callArgs.unshift("data: $data");
  }
  if (operation === "update" || operation === "delete") {
    varDecls.push("$id: ID!");
    callArgs.push("id: $id");
  }

  const returnFields = selection.includes("data")
    ? selection
    : `${selection}\n        data`;

  const MUTATION = gql`
    mutation ${mutationName}(${varDecls.join(", ")}) {
      result: ${mutationName}(${callArgs.join(", ")}) {
        id
        status
        version
        created_at
        updated_at
        schema {
          id
          slug
        }
        ${returnFields}
      }
    }
  `;

  const mutationVariables = {
    schema_slug,
    ...(operation === "update" || operation === "delete" ? { id: entryId } : {}),
    ...inputVariables,
  };

  if ((operation === "update" || operation === "delete") && !entryId) {
    console.warn(`useCmsMutate: entryId is required for ${operation}`);
  }

  const [mutateFn, mutationResult] = useMutation(MUTATION, {
    variables: mutationVariables,
  });

  const resultData = (mutationResult.data as { result?: TData } | null | undefined)?.result;

  return {
    mutate: mutateFn,
    ...mutationResult,
    data: resultData,
  } as const;
}
