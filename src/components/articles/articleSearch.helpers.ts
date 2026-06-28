// Pure URL helpers shared by the framework-agnostic and Next.js variants of
// ArticleSearchBox. No React, no DOM — safe to unit-test in isolation.

/** Read a single query param out of a `location.search` string. */
export function readSearchParam(search: string, key: string): string {
  return new URLSearchParams(search).get(key) ?? "";
}

/**
 * Build the next URL for the search box: clone the current params, set the
 * trimmed `query` under `key` (or delete it when empty), and join onto
 * `pathname`. Other existing params are preserved.
 */
export function buildSearchUrl(
  currentSearch: string,
  pathname: string,
  key: string,
  query = "",
): string {
  const params = new URLSearchParams(currentSearch);
  const trimmed = query.trim();
  if (trimmed) params.set(key, trimmed);
  else params.delete(key);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
