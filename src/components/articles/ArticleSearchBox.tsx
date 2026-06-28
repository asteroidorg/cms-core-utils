"use client";

// Framework-agnostic search box. Drives the URL query param via the native
// History API — no router dependency — so it works in any React app (Vite, CRA,
// React Router, etc.). Next.js apps that need a Server Component refetch should
// import ArticleSearchBox from `@asteroidcms/core-utils/next` instead.

import { useEffect, type ReactNode } from "react";
import { buildSearchUrl, readSearchParam } from "./articleSearch.helpers";
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
  const commit = (value: string) => {
    if (typeof window !== "undefined") {
      const url = buildSearchUrl(
        window.location.search,
        window.location.pathname,
        paramKey,
        value,
      );
      const current = `${window.location.pathname}${window.location.search}`;
      if (url !== current) {
        window.history.replaceState(window.history.state, "", url);
        // replaceState doesn't emit popstate; dispatch it so router-aware apps
        // (React Router, Next's client hooks) pick up the new query.
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
    onQueryChange?.(value.trim());
  };

  const [value, setValue] = useArticleSearchValue({
    debounceMs,
    initialValue: "",
    commit,
  });

  // Seed from the URL after mount. Starting empty keeps server-rendered markup
  // deterministic (no hydration mismatch); the effect fills in any existing
  // `?q=` once on the client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = readSearchParam(window.location.search, paramKey);
    if (fromUrl) setValue(fromUrl);
  }, [paramKey, setValue]);

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
