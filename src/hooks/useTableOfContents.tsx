"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  extractHeadingsFromElement,
  type ExtractedHeading,
  type HeadingLevel,
} from "../utils/extractHeadings";

export interface UseTableOfContentsOptions {
  /** Heading levels to include. Defaults to `[2, 3]`. */
  levels?: ReadonlyArray<HeadingLevel>;
  /**
   * Re-collect headings whenever this value changes. Pass the article slug
   * (or any stable identifier) so swapping content rebuilds the ToC.
   */
  contentKey?: string | number | null;
  /** Pixels to subtract from heading scroll-into-view target. Default 24. */
  scrollMarginTop?: number;
  /**
   * Distance from the top of the viewport (in px) at which a heading becomes
   * "active". A heading is considered active once its top edge has scrolled
   * past this line. Default `96` — works well with a sticky header that
   * stands ~60–80px tall.
   */
  activationOffset?: number;
}

export interface UseTableOfContentsResult {
  items: ExtractedHeading[];
  activeId: string;
}

/**
 * Build a table of contents from a rendered element and track which
 * heading is currently in view via IntersectionObserver. Resilient to
 * content swaps when `contentKey` is provided.
 *
 * Usage:
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const { items, activeId } = useTableOfContents(ref, {
 *   contentKey: article.slug,
 *   levels: [2, 3],
 * });
 * ```
 */
export function useTableOfContents(
  ref: RefObject<HTMLElement | null>,
  options: UseTableOfContentsOptions = {},
): UseTableOfContentsResult {
  const {
    levels,
    contentKey = null,
    scrollMarginTop = 24,
    activationOffset = 96,
  } = options;
  const [items, setItems] = useState<ExtractedHeading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Collection. Re-runs on contentKey change and falls back to a
  // MutationObserver so async-rendered content (e.g. lazy code highlight)
  // doesn't leave the ToC stale.
  useEffect(() => {
    const root = ref.current;
    if (!root) {
      setItems([]);
      setActiveId("");
      return;
    }

    let raf = 0;
    const collect = () => {
      const next = extractHeadingsFromElement(root, {
        levels,
        scrollMarginTop,
      });
      // Always replace the items array. A content-equality short-circuit
      // here looks like a free optimization but it's a footgun: when an
      // article is revisited (same slug → same heading text/IDs), the new
      // article body lives on freshly-mounted DOM nodes. Re-using the
      // previous items array means the downstream IntersectionObserver
      // effect doesn't re-run, so it stays attached to the detached DOM
      // from the previous visit and never fires again.
      setItems(next);
      setActiveId((prev) =>
        next.some((h) => h.id === prev) ? prev : (next[0]?.id ?? ""),
      );
    };

    // First pass — wait one frame so dangerouslySetInnerHTML has painted.
    raf = requestAnimationFrame(collect);

    const mo = new MutationObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(collect);
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, contentKey, levels, scrollMarginTop]);

  // Active-heading tracking.
  //
  // Geometric pick: active = the last heading whose top edge has scrolled
  // past `activationOffset`. This is monotonic with scroll position — the
  // active heading only advances when you scroll past a new one and only
  // retreats when an earlier one scrolls back below the activation line.
  // Avoids the "snap back to a previous heading when nothing's in the IO
  // band" flicker.
  //
  // IntersectionObserver is used purely as a cheap wake-up trigger so we
  // don't need a `scroll` listener; an rAF guard collapses bursts.
  useEffect(() => {
    if (items.length === 0) return;
    const targets = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    let raf = 0;
    const compute = () => {
      raf = 0;
      let activeIdx = 0;
      for (let i = 0; i < items.length; i++) {
        const el = document.getElementById(items[i].id);
        if (!el) continue;
        // `top - activationOffset <= 0` means this heading has crossed
        // the activation line. Loop forward and take the LAST one that
        // qualifies so a single scroll position has exactly one answer.
        if (el.getBoundingClientRect().top - activationOffset <= 0) {
          activeIdx = i;
        } else {
          break;
        }
      }

      // End-of-page rescue. Headings near the bottom (and tightly-spaced
      // pairs like H2 followed immediately by H3) may not have enough
      // content below them to ever scroll past the activation line — they
      // would never become active. When the document is scrolled to (or
      // past) the bottom, walk backwards through the headings and activate
      // the last one whose top is still inside the viewport. This makes the
      // ToC reach its final heading on every page and keeps tightly-packed
      // sub-headings reachable.
      const scroller = document.scrollingElement || document.documentElement;
      const scrollY = window.scrollY;
      const viewportH = window.innerHeight;
      const atBottom = scrollY + viewportH >= scroller.scrollHeight - 2;
      if (atBottom) {
        for (let i = items.length - 1; i > activeIdx; i--) {
          const el = document.getElementById(items[i].id);
          if (el && el.getBoundingClientRect().top < viewportH) {
            activeIdx = i;
            break;
          }
        }
      }

      setActiveId(items[activeIdx].id);
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };

    // Observe every heading with a 1px band at the activation line. Any
    // heading crossing in or out of that line wakes us up to recompute.
    const io = new IntersectionObserver(schedule, {
      rootMargin: `-${activationOffset}px 0px -${Math.max(0, window.innerHeight - activationOffset - 1)}px 0px`,
      threshold: 0,
    });
    targets.forEach((t) => io.observe(t));

    // Also catch resize (band height depends on innerHeight) and
    // scroll-restoration on mount.
    window.addEventListener("resize", schedule, { passive: true });
    compute();

    return () => {
      io.disconnect();
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items, activationOffset]);

  return { items, activeId };
}
