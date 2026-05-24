---
title: Rich text
description: Render stored HTML safely with <RichTextContent>, style it with a classMap, opt out of syntax highlighting via parseRichText, and compute reading time.
order: 10
---

# Rich text

CMS rich-text fields are stored as HTML. Rendering them safely takes two pieces:

- **`parseRichText`** — turns the stored HTML into a sanitized HTML string, applying classes from a `classMap`. Pure function, server-safe.
- **`<RichTextContent>`** — a React component that wraps `parseRichText` and lazily runs syntax highlighting on the client.

| Use this                     | Where                                                          | Import from                       |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------- |
| `<RichTextContent>`          | React trees, including Server Components (it self-marks).      | `@asteroidcms/core-utils/client`  |
| `parseRichText`              | Anywhere — Server Components, scripts, Markdown pipelines.     | `@asteroidcms/core-utils`         |
| `useTableOfContents`         | Build a live, scroll-tracked ToC from rendered content.        | `@asteroidcms/core-utils/client`  |
| `extractHeadingsFromHtml`    | Build a static ToC server-side (RSC, sitemaps, RSS).           | `@asteroidcms/core-utils`         |

---

## Quick start

```tsx
import { RichTextContent } from "@asteroidcms/core-utils/client";

export function PostBody({ html }: { html: string }) {
  return <RichTextContent html={html} as="article" className="prose" />;
}
```

Defaults are sensible:

- A safe allowlist of semantic tags (`p`, `h1`–`h6`, `a`, `ul`/`ol`/`li`, `blockquote`, `pre`, `code`, `kbd`, `table`, `figure`, `img`, `span`, …).
- `<script>` tags, inline event handlers (`onclick=…`), and `javascript:` URLs are stripped.
- Code blocks (`<pre><code class="language-…">`) are highlighted with `highlight.js` after mount — no hydration flicker.
- Enhancements (highlighting, copy buttons, blockquote decorations) are **self-healing**: an internal `MutationObserver` re-applies them whenever the subtree is replaced, so they survive Apollo cache-and-network refetches and other parent re-renders that hand `<RichTextContent>` a new `html` string reference.
- Headings (`<h1>`–`<h6>`) get slugified `id` attributes automatically, so anchor links and tables of contents work without extra setup. See [Heading IDs](#heading-ids-auto-slugged).
- Pullquote `<figure>` elements (a blockquote followed by an `— Author` attribution) get default classes so they look right out of the box.

---

## Props

| Prop         | Type                                          | Default | Notes                                                                                            |
| ------------ | --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `html`       | `string` (required)                           | —       | The raw HTML stored in the CMS field.                                                            |
| `classMap`   | `RichTextClassMap`                            | `{}`    | Per-tag and per-variant class overrides. Merges over defaults.                                   |
| `as`         | `keyof JSX.IntrinsicElements`                 | `"div"` | The wrapper element. Use `"article"` for blog posts.                                             |
| `className`  | `string`                                      | —       | Applied to the wrapper.                                                                          |
| `contentRef` | `MutableRefObject<HTMLElement \| null>`       | —       | Receives the wrapper element. Pair with `useTableOfContents` to build a ToC from the rendered DOM. |
| `onReady`    | `(root: HTMLElement) => void`                 | —       | Fires after parsed HTML is in the DOM and post-render enhancements (highlighting, copy buttons, blockquote decorations, callout chips) have run. |
| `calloutIcons` | `Partial<Record<string, ReactNode>>`        | —       | Per-variant icon override for callouts that opt into icons via `data-icon`. See [Callouts](#callouts). Variants you don't provide fall back to the built-in SVG glyph. |

---

## Styling with `classMap`

`classMap` is a record of tag → utility class string. The parser merges it with sensible defaults.

```tsx
<RichTextContent
  html={post.body}
  as="article"
  className="prose"
  classMap={{
    h1: "text-4xl font-bold tracking-tight",
    h2: "text-2xl font-semibold mt-10 mb-3",
    p: "leading-relaxed my-4",
    a: "text-blue-600 underline underline-offset-2 hover:text-blue-800",
    blockquote: "border-l-4 border-slate-300 pl-4 italic",
    pre: "rounded-lg overflow-x-auto",
    inlineCode: "bg-slate-100 rounded px-1 py-0.5 text-sm",
    img: "rounded-xl my-6 w-full",
    table: "w-full border-collapse",
    th: "text-left font-semibold border-b py-2",
    td: "border-b py-2",
  }}
/>
```

`inlineCode` styles `<code>` that is **not** wrapped in `<pre>` (inline code). Code inside `<pre>` is styled via the `pre` and `code` keys plus the bundled `highlight.js` theme.

> Memoize big `classMap` objects to module scope. `<RichTextContent>` re-parses when inputs change — if the map is built inline on every render, parsing runs every render.

---

## Variants

Some elements support variant classes — applied when the parser detects a semantic role. Example: blockquotes that include an attribution line become a `pullquote` figure.

```tsx
<RichTextContent
  html={post.body}
  classMap={{
    variants: {
      "figure:pullquote": "relative my-12 mx-auto max-w-prose",
      "blockquote:pullquote": "italic text-2xl leading-tight",
      "figcaption:pullquote": "mt-4 text-sm uppercase tracking-widest text-slate-500",
      "span:author": "ml-1 font-semibold text-slate-900",
      "callout:warning": "border-l-4 border-amber-500 bg-amber-50 px-4 py-3",
      "callout:info":    "border-l-4 border-blue-500 bg-blue-50 px-4 py-3",
    },
  }}
/>
```

The variant key format is `"<tag>:<variant>"`. The default class map already styles the pullquote variants — your map merges on top.

---

## Without highlight.js: `parseRichText`

If you don't want to ship the highlight.js runtime (`highlight.js/lib/common` is ~35 grammars plus the inlined `tokyo-night-dark` theme), or you're rendering inside a Markdown pipeline, use the parser directly:

```tsx
import { parseRichText, removeEmptyParagraphs } from "@asteroidcms/core-utils";

const html = removeEmptyParagraphs(
  parseRichText(post.body, {
    classMap: { p: "my-3 leading-relaxed", a: "underline" },
  }),
);

return <article dangerouslySetInnerHTML={{ __html: html }} />;
```

`removeEmptyParagraphs` strips `<p></p>` and `<p>&nbsp;</p>` left behind by some editors.

The parser is **idempotent** — re-running it on its own output produces the same string. Safe to cache and re-render.

---

## Custom allowlist

By default the parser permits a safe semantic subset. To allow more (e.g. iframes for embeds), pass an extended `allowlist` via `parseRichText`:

```tsx
import { parseRichText } from "@asteroidcms/core-utils";

const safe = parseRichText(post.body, {
  allowlist: ["p", "a", "iframe", "img", "h1", "h2"],
  classMap: { p: "my-4" },
});

return <article dangerouslySetInnerHTML={{ __html: safe }} />;
```

Adding `"iframe"` skips the default protections — sanitize iframe `src` attributes yourself before storing them.

---

## Heading IDs (auto-slugged)

Every `<h1>`–`<h6>` returned by `parseRichText` (and therefore `<RichTextContent>`) gets a slugified `id` attribute automatically — so anchor links like `#getting-started` work out of the box, without a client-side mutation step.

- Existing `id` attributes are preserved verbatim.
- Generated slugs are de-duplicated within a document (`intro`, `intro-1`, `intro-2`, …).
- Since IDs are part of the parsed string, they're stable across SSR / client hydration.

Turn it off by passing `autoHeadingIds: false` to `parseRichText`:

```ts
import { parseRichText } from "@asteroidcms/core-utils";
const html = parseRichText(post.body, { autoHeadingIds: false });
```

---

## Table of contents

For doc pages, blog posts, or any long-form content, `useTableOfContents` reads headings out of a rendered subtree and tracks which one is currently in view (via `IntersectionObserver`). Pair it with `RichTextContent`'s `contentRef` prop:

```tsx
"use client";

import { useRef } from "react";
import {
  RichTextContent,
  useTableOfContents,
} from "@asteroidcms/core-utils/client";

export function ArticleWithToc({
  slug,
  html,
}: {
  slug: string;
  html: string;
}) {
  const contentRef = useRef<HTMLElement | null>(null);
  const { items, activeId } = useTableOfContents(contentRef, {
    levels: [2, 3],
    contentKey: slug,        // re-collect when the article swaps
    scrollMarginTop: 80,     // anchor-jump offset for sticky header
    activationOffset: 96,    // where the "active" line sits (px from top)
  });

  return (
    <div className="flex gap-8">
      <RichTextContent
        key={slug}
        html={html}
        as="article"
        className="prose flex-1"
        contentRef={contentRef}
      />
      <nav className="sticky top-24 w-64 shrink-0">
        <p className="mb-3 text-xs uppercase tracking-wider text-slate-500">
          On this page
        </p>
        <ol className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              style={{ marginLeft: it.level === 3 ? 12 : 0 }}
            >
              <a
                href={`#${it.id}`}
                className={
                  it.id === activeId
                    ? "text-blue-600 font-medium"
                    : "text-slate-600"
                }
              >
                {it.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
```

### `useTableOfContents` options

| Option             | Type                                          | Default  | Notes                                                                                                                                  |
| ------------------ | --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `levels`           | `ReadonlyArray<1 \| 2 \| 3 \| 4 \| 5 \| 6>`   | `[2, 3]` | Which heading levels to include.                                                                                                       |
| `contentKey`       | `string \| number \| null`                    | `null`   | Pass a stable per-article identifier (e.g. slug). Forces re-collection — and re-observation of the new DOM — when content swaps.       |
| `scrollMarginTop`  | `number`                                      | `24`     | Pixels of `scroll-margin-top` applied to each heading, so anchor jumps land below a sticky header.                                     |
| `activationOffset` | `number`                                      | `96`     | Distance from viewport top (in px) at which a heading becomes "active". Bump it up to match the height of your sticky header.          |

### Returned shape

| Field      | Type                                                  | Notes                                                              |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| `items`    | `Array<{ id; text; level }>`                          | Headings in document order. `level` is `1`–`6`.                    |
| `activeId` | `string`                                              | ID of the heading currently scrolled past the activation line.     |

### How active tracking works

The active heading is picked **geometrically**, not from `IntersectionObserver` ratios: it's the last heading whose top edge has crossed the activation line (`activationOffset` px from the viewport top). That makes the result monotonic with scroll position — no flicker between competing headings, and no "snap back to a previous heading when nothing's intersecting."

`IntersectionObserver` is still used internally, but only as a cheap wake-up trigger that schedules a re-compute via `requestAnimationFrame`. A `MutationObserver` on the ref'd subtree handles async DOM mutations (the syntax-highlighting pass, lazy embeds, etc.) so the ToC stays in sync without manual invalidation.

**End-of-page rescue.** A heading sitting close to the bottom of an article — or a tightly-spaced `<h2>`/`<h3>` pair — can't always scroll far enough to cross the activation line. When the page is scrolled to its bottom, the hook walks backwards through the headings and activates the last one still inside the viewport, so the final heading always becomes reachable.

### Server-rendering a ToC

If you want the outline available before hydration (sitemaps, RSC layouts), use `extractHeadingsFromHtml` directly. It's a pure string function with no React or DOM dependency:

```ts
import { extractHeadingsFromHtml } from "@asteroidcms/core-utils";

const toc = extractHeadingsFromHtml(post.body, { levels: [2, 3] });
// → [{ id: "intro", text: "Intro", level: 2 }, ...]
```

A DOM-side companion, `extractHeadingsFromElement`, mirrors the same signature but walks a live element — useful when you need to apply IDs to a tree that wasn't produced by `parseRichText` (e.g. content rendered by a third-party Markdown component).

---

## Reading time

For a "5 min read" badge from the same HTML:

```tsx
import { getContentReadTime } from "@asteroidcms/core-utils";

<p>{getContentReadTime(post.body, { wordsPerMinute: 220 })}</p>
```

| Option           | Type                            | Default   | Description                          |
| ---------------- | ------------------------------- | --------- | ------------------------------------ |
| `wordsPerMinute` | `number`                        | `200`     | Average reading speed.               |
| `format`         | `"short" \| "long"`             | `"short"` | `"3 min read"` vs `"3 minutes read"` |
| `round`          | `"ceil" \| "round" \| "floor"`  | `"ceil"`  | Rounding strategy.                   |
| `minMinutes`     | `number`                        | `1`       | Floor for the returned value.        |

---

## Server-rendering rich text

`<RichTextContent>` is safe to render from a Server Component — the parser doesn't touch the DOM, and the highlight.js step runs only after hydration. Next.js will ship the necessary client JS automatically.

For fully-static pages (no highlight.js shipped), use `parseRichText` plus `dangerouslySetInnerHTML` as shown above.

---

## Syntax-highlighted code blocks

`<RichTextContent>` highlights any `<pre data-language="xxx"><code>…</code></pre>` block once after mount. The bundled theme is `tokyo-night-dark`, injected as a `<style id="rt-codeblock-style">` tag on first render. To swap it, override the relevant `.hljs-*` classes in your own stylesheet (your rules win — they cascade after the injected `<style>`).

Extra chrome that comes for free on every block:

- **Copy button.** Floats top-right and copies the original source text on click.
- **Filename label.** Set `<pre data-filename="server.ts">` and the parser renders a small tag in the top-left of the block.
- **Diff variant.** `<pre data-variant="diff" data-language="ts">` — the inner `<code>` is split on a literal `@@---@@` line into "before" and "after" snippets, then rendered as a side-by-side, syntax-highlighted, line-numbered diff with its own per-side copy buttons.
- **Terminal variant.** `<pre data-variant="terminal" data-language="sh">` — renders macOS-style traffic lights, a green `$` prompt on every line, and a "Copy commands" button that yields only the commands (no prompts). Defaults to `sh` highlighting when no language is set.

To opt out entirely, render through `parseRichText` instead — that path doesn't import highlight.js.

---

## Callouts

The parser preserves authored `<aside data-callout>` blocks for "info/warning/success/danger" boxes. Two opt-in extras kick in when matching attributes are present on the element:

- **`data-title="Heads up"`** — the renderer inserts a `<p data-callout-title="true">Heads up</p>` as the first child of the aside if one isn't already there. Style it via `classMap.calloutTitle` or `variants["calloutTitle:<variant>"]`.
- **`data-icon`** — opts the callout into a chip in the leading column. Set to `"false"` or `"0"` to explicitly disable. With the chip enabled, `<RichTextContent>` portals a React element into it so refs, event handlers, and theme context work normally.

Override the chip glyph per variant via `calloutIcons`:

```tsx
import { Info, AlertTriangle, CheckCircle, XOctagon } from "lucide-react";

<RichTextContent
  html={post.body}
  calloutIcons={{
    info: <Info size={14} strokeWidth={2.4} />,
    warning: <AlertTriangle size={14} strokeWidth={2.4} />,
    success: <CheckCircle size={14} strokeWidth={2.4} />,
    danger: <XOctagon size={14} strokeWidth={2.4} />,
  }}
/>;
```

Built-in glyphs ship for `info`, `warning`, `success`, `danger`, and `default`. Custom variant names work too — anything you put in `data-variant` is the key the renderer looks up in `calloutIcons`.

Style the box itself via the `callout` and `callout:<variant>` keys:

```tsx
<RichTextContent
  html={post.body}
  classMap={{
    callout: "rounded-lg border px-4 py-3",
    calloutTitle: "font-semibold mb-1",
    variants: {
      "callout:info":    "border-blue-200 bg-blue-50 text-blue-900",
      "callout:warning": "border-amber-200 bg-amber-50 text-amber-900",
      "callout:success": "border-emerald-200 bg-emerald-50 text-emerald-900",
      "callout:danger":  "border-rose-200 bg-rose-50 text-rose-900",
    },
  }}
/>;
```

---

## Collapsible (FAQ accordion)

Native `<details data-collapsible>` / `<summary>` pairs are preserved by the sanitizer and styled with a rotating chevron out of the box. Layer your own styling via `classMap.collapsible` (the `<details>`) and `classMap.collapsibleTitle` (the `<summary>`):

```tsx
<RichTextContent
  html={post.body}
  classMap={{
    collapsible:     "rounded-lg border border-slate-200 px-4 py-3 my-3",
    collapsibleTitle:"font-medium cursor-pointer",
  }}
/>;
```

Only structural styling (chevron, layout) is built in — colors, padding, and typography belong to your `classMap`.

---

## Inline font-size

The sanitizer normally strips inline `style=`. `<span style="font-size: …">` is the one exception: values matching `<number>px|rem|em|%` (1–3 integer digits, optional decimal) pass through verbatim. Anything else is silently dropped. Use this for editor-driven inline sizing without opening up arbitrary CSS.

---

## Putting it together

A blog post page combining most of what we've covered:

```tsx
"use client";

import {
  useCmsContent,
  useCmsImage,
  RichTextContent,
} from "@asteroidcms/core-utils/client";
import { getContentReadTime } from "@asteroidcms/core-utils";

type Post = {
  title: string;
  hero?: string;
  body: string;
  author?: { name: string; avatar?: string };
};

export function BlogPost({ slug }: { slug: string }) {
  const cmsImage = useCmsImage();
  const { data, loading, error } = useCmsContent<Post>({
    schema_slug: "blog-posts",
    entrySlug: slug,
    select: [
      "title",
      "hero",
      "body",
      { field: "author", single: true, select: ["name", "avatar"] },
    ],
  });

  if (loading) return <p>Loading…</p>;
  if (error || !data) return <p>Not found.</p>;

  return (
    <article className="mx-auto max-w-prose px-4 py-10">
      {data.hero && (
        <img src={cmsImage(data.hero)} alt="" className="rounded-xl mb-6" />
      )}
      <h1 className="text-4xl font-bold">{data.title}</h1>
      <p className="text-sm text-slate-500 mb-8">
        {data.author?.name} · {getContentReadTime(data.body)}
      </p>
      <RichTextContent
        html={data.body}
        classMap={{
          p: "leading-relaxed my-4",
          h2: "text-2xl font-semibold mt-10 mb-3",
          a: "text-blue-600 underline",
          inlineCode: "bg-slate-100 rounded px-1",
        }}
      />
    </article>
  );
}
```

Continue to **[Advanced topics »](./11-advanced.md)**.
