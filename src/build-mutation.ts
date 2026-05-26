import { type DocumentNode, gql } from "@apollo/client";

export type MutationType = "create" | "update" | "delete";

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

export type CmsMutateOptions = {
  schema_slug: string;
  select?: readonly (FieldSelector | ReferenceExpansion)[];
  fullData?: boolean;
  mutationType?: MutationType;
  entryId?: string;
  variables?: Record<string, unknown>;
};

function buildSelection(
  items: readonly (FieldSelector | ReferenceExpansion)[] = [],
): string {
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
}

export function buildCmsMutation({
  schema_slug,
  select = [],
  fullData = false,
  mutationType = "create",
  entryId,
  variables = {},
}: CmsMutateOptions): {
  mutation: DocumentNode;
  variables: Record<string, unknown>;
} {
  const userSelection = buildSelection(select);
  let selection = fullData ? "data" : "";

  if (userSelection) {
    selection = selection ? `${selection}\n      ${userSelection}` : userSelection;
  }

  if (!selection) {
    selection = "id slug status version created_at updated_at";
  }

  const mutationName = `${mutationType}ContentEntry`;

  const varDecls: string[] = ["$schema_slug: String!"];
  const callArgs: string[] = ["schema_slug: $schema_slug"];

  if (mutationType === "create" || mutationType === "update") {
    varDecls.unshift("$data: JSONObject!");
    callArgs.unshift("data: $data");
  }
  if (mutationType === "update" || mutationType === "delete") {
    varDecls.push("$id: ID!");
    callArgs.push("id: $id");
  }

  const returnFields = selection.includes("data")
    ? selection
    : `${selection}\n        data`;

  const mutationStr = `
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

  const mutationVariables: Record<string, unknown> = {
    schema_slug,
    ...(mutationType === "update" || mutationType === "delete"
      ? { id: entryId }
      : {}),
    ...variables,
  };

  return {
    mutation: gql(mutationStr) as DocumentNode,
    variables: mutationVariables,
  };
}
