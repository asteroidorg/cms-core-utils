// Shared, framework-neutral pieces of ArticleSearchBox: the props shape, the
// debounced value hook, and the input UI. The two variants (native History API
// in `./ArticleSearchBox`, Next.js router in `./ArticleSearchBoxNext`) supply
// their own `commit` and initial value; everything else lives here so markup and
// the `render` API stay identical across them.

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ArticleSearchBoxProps {
  /** URL query param the search writes to. Default: "q". */
  paramKey?: string;
  placeholder?: string;
  /** Debounce before committing. Default: 500ms. */
  debounceMs?: number;
  className?: string;
  /**
   * Called with the debounced, trimmed query whenever it changes. Useful in
   * router-less React apps that drive their own fetching/state.
   */
  onQueryChange?: (query: string) => void;
  /** Override the default input UI. */
  render?: (params: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: { preventDefault: () => void }) => void;
  }) => ReactNode;
}

/**
 * Owns the input value and debounces it, calling the injected `commit` with the
 * raw value once it settles. `commit` is read through a ref so the latest
 * closure (capturing fresh router/params) runs without re-arming the timer.
 */
export function useArticleSearchValue(options: {
  debounceMs: number;
  initialValue: string;
  commit: (value: string) => void;
}): [string, (value: string) => void] {
  const { debounceMs, initialValue, commit } = options;
  const [value, setValue] = useState(initialValue);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    const timer = setTimeout(() => commitRef.current(value), debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs]);

  return [value, setValue];
}

const onSubmit = (event: { preventDefault: () => void }) => event.preventDefault();

/** The form/input markup, or the consumer's `render` override. */
export function ArticleSearchBoxView(props: {
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  className?: string;
  render?: ArticleSearchBoxProps["render"];
}): ReactNode {
  const { value, setValue, placeholder, className, render } = props;

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
