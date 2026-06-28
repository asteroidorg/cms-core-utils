"use client";

// Next.js variant of ArticleSearchBox. Commits the query through the App Router
// (`router.replace`) so a Server Component listing reading `searchParams`
// re-renders/refetches. Exposed via `@asteroidcms/core-utils/next`.

import { useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildSearchUrl } from "./articleSearch.helpers";
import {
  ArticleSearchBoxView,
  useArticleSearchValue,
  type ArticleSearchBoxProps,
} from "./articleSearch.shared";

export type { ArticleSearchBoxProps };

export function ArticleSearchBox({
  paramKey = "q",
  placeholder = "Search articles...",
  debounceMs = 500,
  className,
  onQueryChange,
  render,
}: ArticleSearchBoxProps): ReactNode {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const commit = (value: string) => {
    const url = buildSearchUrl(
      searchParamsRef.current.toString(),
      pathname,
      paramKey,
      value,
    );
    router.replace(url, { scroll: false });
    onQueryChange?.(value.trim());
  };

  const [value, setValue] = useArticleSearchValue({
    debounceMs,
    initialValue: searchParams.get(paramKey) ?? "",
    commit,
  });

  return (
    <ArticleSearchBoxView
      value={value}
      setValue={setValue}
      placeholder={placeholder}
      className={className}
      render={render}
    />
  );
}
