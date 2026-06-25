"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface ArticleSearchBoxProps {
  /** URL query param the search writes to. Default: "q". */
  paramKey?: string;
  placeholder?: string;
  /** Debounce before navigating. Default: 500ms. */
  debounceMs?: number;
  className?: string;
  /** Override the default input UI. */
  render?: (params: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: { preventDefault: () => void }) => void;
  }) => ReactNode;
}

export function ArticleSearchBox({
  paramKey = "q",
  placeholder = "Search articles...",
  debounceMs = 500,
  className,
  render,
}: ArticleSearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get(paramKey) ?? "";
  const [value, setValue] = useState(initial);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(Array.from(searchParamsRef.current.entries()));
      const trimmed = value.trim();
      if (trimmed) params.set(paramKey, trimmed);
      else params.delete(paramKey);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, debounceMs);
    return () => clearTimeout(timer);
    // Re-run only when the typed value or debounce changes.
  }, [value, debounceMs, paramKey, pathname]);

  const onSubmit = (event: { preventDefault: () => void }) => event.preventDefault();

  if (render) return <>{render({ value, onChange: setValue, onSubmit })}</>;

  return (
    <form onSubmit={onSubmit} className={className}>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  );
}
