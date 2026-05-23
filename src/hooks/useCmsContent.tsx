import { type DocumentNode, gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

type FieldSelector = string | { field: string; as?: string };

type ReferenceExpansion = {
  field: string;
  as?: string;
  single?: boolean;
  select?: readonly (FieldSelector | ReferenceExpansion)[];
};

type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type CmsSearchCondition = {
  field: string;
  value: string;
  mode?: string;
};

export type UseCmsContentOptions = {
  schema_slug: string;
  entrySlug?: string;
  select?: readonly (FieldSelector | ReferenceExpansion)[];
  fullData?: boolean;
  limit?: number;
  offset?: number;
  status?: ContentStatus;
  filter?: Record<string, string | number | boolean | null>;
  search?: CmsSearchCondition[];
  variables?: Record<string, any>;
};

/**
 * React hook for querying content from Asteroid CMS via a flexible GraphQL API.
 *
 * Supports single-entry fetches (`entrySlug`) and paginated/filtered lists,
 * with arbitrarily nested reference expansion and field aliasing.
 */
export function useCmsContent<T = unknown>({
  schema_slug,
  entrySlug,
  select = [],
  fullData = false,
  limit,
  offset,
  status = "PUBLISHED",
  filter,
  search,
  variables = {},
}: UseCmsContentOptions) {
  const isSingle = !!entrySlug;

  const buildSelection = (
    items: readonly (FieldSelector | ReferenceExpansion)[] = [],
  ): string => {
    const lines: string[] = [];

    items.forEach((item) => {
      if (typeof item === "string") {
        lines.push(`${item}: dataField(slug: "${item}")`);
      } else if ("field" in item && typeof item.field === "string") {
        if (!("select" in item)) {
          const alias = item.as || item.field;
          lines.push(`${alias}: dataField(slug: "${item.field}")`);
          return;
        }

        const alias = item.as || item.field;
        const resolver = item.single
          ? "expandedReferenceObject"
          : "expandedReference";

        const subSelection = item.select?.length
          ? buildSelection(item.select)
          : "data { ... }";

        lines.push(`
          ${alias}: ${resolver}(slug: "${item.field}") {
            ${subSelection}
          }
        `);
      }
    });

    return lines.join("\n      ").trim();
  };

  const selectionParts: string[] = [];
  if (fullData) selectionParts.push("data");
  if (select.length > 0) {
    const userSelection = buildSelection(select);
    if (userSelection) selectionParts.push(userSelection);
  }
  const selection = selectionParts.join("\n      ").trim() || "id";

  const queryVariables: Record<string, any> = {
    schema_slug,
    ...(entrySlug && { slug: entrySlug }),
    ...variables,
  };
  const fieldArgParts: string[] = ["schema_slug: $schema_slug"];

  if (!isSingle) {
    if (typeof limit === "number" && limit >= 0) {
      fieldArgParts.push("limit: $limit");
      queryVariables.limit = limit;
    }
    if (typeof offset === "number" && offset >= 0) {
      fieldArgParts.push("offset: $offset");
      queryVariables.offset = offset;
    }
    if (status) {
      fieldArgParts.push("status: $status");
      queryVariables.status = status;
    }

    const hasSearch = Array.isArray(search) && search.length > 0;
    const hasFilter =
      filter && typeof filter === "object" && Object.keys(filter).length > 0;

    if (hasSearch || hasFilter) {
      const mergedFilter: Record<string, unknown> = hasFilter ? { ...filter } : {};
      if (hasSearch) {
        for (const condition of search!) {
          mergedFilter[condition.field] = {
            regex: true,
            value: condition.value,
            mode: condition.mode ?? "i",
          };
        }
      }
      fieldArgParts.push("data: $filter");
      queryVariables.filter = mergedFilter;
    }
  }

  const varDecls: string[] = ["$schema_slug: String!"];
  if ("limit" in queryVariables) varDecls.push("$limit: Float");
  if ("offset" in queryVariables) varDecls.push("$offset: Float");
  if ("status" in queryVariables) varDecls.push("$status: ContentStatus");
  if ("filter" in queryVariables) varDecls.push("$filter: JSONObject");

  const varBlock = varDecls.length > 0 ? `(\n  ${varDecls.join("\n  ")}\n)` : "";
  const contentFieldArgs = fieldArgParts.join(", ");
  const queryStr = isSingle
    ? `
      query Get${schema_slug}Entry($schema_slug: String!, $slug: String!) {
        entry: contentEntry(schema_slug: $schema_slug, slug: $slug) {
          ${selection}
        }
      }
    `
    : `
      query Get${schema_slug}Entries${varBlock} {
        entries: contentEntries(${contentFieldArgs}) {
          ${selection}
        }
      }
    `;

  const GET_CONTENT = gql(queryStr) as DocumentNode;

  const { loading, error, data, ...rest } = useQuery(GET_CONTENT, {
    variables: queryVariables,
    skip: !schema_slug || (isSingle && !entrySlug),
  });

  const typed = data as { entry?: unknown; entries?: unknown } | undefined;
  const result = isSingle ? typed?.entry : typed?.entries;

  return {
    loading,
    error,
    data: result as T | undefined,
    ...rest,
  };
}
