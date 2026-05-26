---
title: Rich text
description: Render CMS HTML safely with <RichTextContent>, style it with classMap, use callouts and collapsibles, highlight code blocks, and compute reading time.
order: 10
---

# Rich text

CMS rich-text fields are stored as HTML. Rendering them safely takes two pieces:

| Use this | Where | Import from |
| --- | --- | --- |
| `<RichTextContent>` | React trees (including Server Components). | `@asteroidcms/core-utils/client` |
| `parseRichText` | Anywhere — Server Components, scripts, pipelines. | `@asteroidcms/core-utils` |
| `extractHeadingsFromHtml` | Server-side ToC (RSC, sitemaps, RSS). | `@asteroidcms/core-utils` |

`<RichTextContent>` wraps `parseRichText` and adds lazy syntax highlighting on the client.

---

## Quick start

```tsx
import { RichTextContent } from "@asteroidcms/core-utils/client";

export function PostBody({ html }: { html: string }) {
  return <RichTextContent html={html} as="article" className="prose" />;
}
```

### What you get out of the box

- A safe allowlist of semantic tags (`p`, `h1`–`h6`, `a`, `ul`/`ol`/`li`, `blockquote`, `pre`, `code`, `kbd`, `table`, `figure`, `img`, `span`, ...).
- `<script>` tags, inline event handlers, and `javascript:` URLs are stripped.
- Code blocks (`<pre><code class="language-...">`) highlighted with highlight.js after mount — no hydration flicker.
- Copy buttons on every code block.
- Pullquote decorations (curly quote marks, author treatment) on blockquotes with attribution.
- Headings get slugified `id` attributes automatically for anchor links.
- Self-healing enhancements — a `MutationObserver` re-applies them if the DOM changes (e.g. Apollo cache refetch swaps the `html` prop).

---

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `html` | `string` (required) | — | Raw HTML from the CMS field. |
| `classMap` | `RichTextClassMap` | `{}` | Per-tag and per-variant class overrides. Merges over defaults. |
| `as` | `keyof JSX.IntrinsicElements` | `"div"` | Wrapper element. Use `"article"` for blog posts. |
| `className` | `string` | — | Applied to the wrapper. |
| `contentRef` | `MutableRefObject<HTMLElement \| null>` | — | Receives the wrapper element. Useful for scroll observers, ToC hooks, etc. |
| `onReady` | `(root: HTMLElement) => void` | — | Fires after enhancements (highlighting, copy buttons, callouts) have run. |
| `calloutIcons` | `Partial<Record<string, ReactNode>>` | — | Per-variant icon override for callouts with `data-icon`. |

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

`inlineCode` styles `<code>` that is **not** wrapped in `<pre>` (inline code). Code inside `<pre>` is styled via the `pre` and `code` keys plus the bundled highlight.js theme.

> **Performance tip:** Memoize big `classMap` objects to module scope. `<RichTextContent>` re-parses when inputs change — inline maps cause parsing on every render.

---

## Variants

Some elements support variant classes — applied when the parser detects a semantic role.

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
      "callout:info": "border-l-4 border-blue-500 bg-blue-50 px-4 py-3",
    },
  }}
/>
```

The variant key format is `"<tag>:<variant>"`. The default class map already styles pullquote variants — your map merges on top.

### Available variants

| Variant key | When it applies |
| --- | --- |
| `figure:pullquote` | Blockquote ends with an attribution line (`— Name`). |
| `blockquote:pullquote` | Quote body inside a pullquote figure. |
| `figcaption:pullquote` | Attribution caption. |
| `span:quote-open` / `span:quote-close` | Decorative curly quote marks. |
| `span:author` | Author name inside the figcaption. |
| `figure:image` / `figcaption:image` | Standalone `<img>` blocks with alt/title captions. |
| `callout:<variant>` | Callout boxes (see below). |
| `calloutTitle:<variant>` | Callout title paragraph. |

---

## Code blocks

`<RichTextContent>` highlights any `<pre data-language="xxx"><code>...</code></pre>` block after mount. The bundled theme is `tokyo-night-dark`, injected as a `<style>` tag on first render.

### Built-in chrome

Every code block gets:

- **Copy button** — top-right, copies the original source text.
- **Filename label** — set `<pre data-filename="server.ts">` for a small tag in the top-left.

### Terminal variant

`<pre data-variant="terminal" data-language="sh">` renders:

- macOS-style traffic lights
- A green `$` prompt on every line
- "Copy commands" button (copies without prompts)

```tsx
// The CMS stores:
// <pre data-variant="terminal" data-language="sh"><code>npm install
// npm run build</code></pre>
```

### Diff variant

`<pre data-variant="diff" data-language="ts">` with a `@@---@@` separator in the code content:

- Side-by-side, syntax-highlighted, line-numbered diff
- Per-side copy buttons
- Red/green highlights for removed/added lines

```tsx
// The CMS stores:
// <pre data-variant="diff" data-language="ts"><code>
// const name = "old";
// @@---@@
// const name = "new";
// </code></pre>
```

### Opting out of highlight.js

Use `parseRichText` directly — it doesn't import highlight.js:

```tsx
import { parseRichText } from "@asteroidcms/core-utils";

const html = parseRichText(post.body, { classMap: { p: "my-3" } });
return <article dangerouslySetInnerHTML={{ __html: html }} />;
```

---

## Callouts

The parser preserves `<aside data-callout>` blocks for info/warning/success/danger boxes.

### Titles

Add `data-title="Heads up"` to the aside — the renderer inserts a title paragraph as the first child.

### Icons

Add `data-icon` to opt into a chip in the leading column. Set to `"false"` or `"0"` to explicitly disable.

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

Built-in glyphs ship for `info`, `warning`, `success`, `danger`, and `default`. Custom variant names work too — anything in `data-variant` is the key.

### Styling callouts

```tsx
<RichTextContent
  html={post.body}
  classMap={{
    callout: "rounded-lg border px-4 py-3",
    calloutTitle: "font-semibold mb-1",
    variants: {
      "callout:info": "border-blue-200 bg-blue-50 text-blue-900",
      "callout:warning": "border-amber-200 bg-amber-50 text-amber-900",
      "callout:success": "border-emerald-200 bg-emerald-50 text-emerald-900",
      "callout:danger": "border-rose-200 bg-rose-50 text-rose-900",
    },
  }}
/>;
```

---

## Collapsible (FAQ accordion)

Native `<details data-collapsible>` / `<summary>` pairs are preserved by the sanitizer. A rotating chevron is added automatically.

```tsx
<RichTextContent
  html={post.body}
  classMap={{
    collapsible: "rounded-lg border border-slate-200 px-4 py-3 my-3",
    collapsibleTitle: "font-medium cursor-pointer",
  }}
/>;
```

Only structural styling (chevron, layout) is built in — colors, padding, and typography belong to your `classMap`.

---

## Heading IDs (auto-slugged)

Every `<h1>`–`<h6>` gets a slugified `id` attribute automatically:

- Existing `id` attributes are preserved verbatim.
- Generated slugs are de-duplicated (`intro`, `intro-1`, `intro-2`, ...).
- IDs are part of the parsed string, so they're stable across SSR/hydration.

Turn it off:

```ts
const html = parseRichText(post.body, { autoHeadingIds: false });
```

---

## Table of contents

### Server-side (static)

Use `extractHeadingsFromHtml` for sitemaps, RSC layouts, or RSS feeds:

```ts
import { extractHeadingsFromHtml } from "@asteroidcms/core-utils";

const toc = extractHeadingsFromHtml(post.body, { levels: [2, 3] });
// → [{ id: "intro", text: "Intro", level: 2 }, ...]
```

### Client-side (live DOM)

Use `extractHeadingsFromElement` to walk a live element:

```ts
import { extractHeadingsFromElement } from "@asteroidcms/core-utils/client";

const headings = extractHeadingsFromElement(articleRef.current, {
  levels: [2, 3],
});
```

### Building a scroll-tracked ToC

Pair `contentRef` with an IntersectionObserver or scroll listener to build live active-heading tracking:

```tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { RichTextContent } from "@asteroidcms/core-utils/client";
import { extractHeadingsFromElement } from "@asteroidcms/core-utils/client";

export function ArticleWithToc({ slug, html }: { slug: string; html: string }) {
  const contentRef = useRef<HTMLElement | null>(null);
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);

  useEffect(() => {
    if (contentRef.current) {
      setHeadings(extractHeadingsFromElement(contentRef.current, { levels: [2, 3] }));
    }
  }, [slug]);

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
        <p className="mb-3 text-xs uppercase tracking-wider text-slate-500">On this page</p>
        <ol className="space-y-1">
          {headings.map((h) => (
            <li key={h.id} style={{ marginLeft: h.level === 3 ? 12 : 0 }}>
              <a href={`#${h.id}`}>{h.text}</a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
```

---

## Inline font-size

The sanitizer normally strips inline `style=`. `<span style="font-size: ...">` is the one exception: values matching `<number>px|rem|em|%` pass through verbatim. Anything else is silently dropped.

---

## Reading time

Estimate reading time from the same HTML:

```tsx
import { getContentReadTime } from "@asteroidcms/core-utils";

<p>{getContentReadTime(post.body, { wordsPerMinute: 220 })}</p>
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `wordsPerMinute` | `number` | `200` | Average reading speed. |
| `format` | `"short" \| "long"` | `"short"` | `"3 min read"` vs `"3 minutes read"` |
| `round` | `"ceil" \| "round" \| "floor"` | `"ceil"` | Rounding strategy. |
| `minMinutes` | `number` | `1` | Floor for the returned value. |

---

## `parseRichText` — the pure parser

For fully static rendering without highlight.js:

```tsx
import { parseRichText, removeEmptyParagraphs } from "@asteroidcms/core-utils";

const html = removeEmptyParagraphs(
  parseRichText(post.body, {
    classMap: { p: "my-3 leading-relaxed", a: "underline" },
  }),
);

return <article dangerouslySetInnerHTML={{ __html: html }} />;
```

### Custom allowlist

```tsx
const safe = parseRichText(post.body, {
  allowlist: ["p", "a", "iframe", "img", "h1", "h2"],
  classMap: { p: "my-4" },
});
```

> Adding `"iframe"` skips default protections — sanitize iframe `src` attributes yourself.

The parser is **idempotent** — re-running it on its own output produces the same string.

---

## Complete example

A blog post page combining reads, images, and rich text:

```tsx
"use client";

import { useCmsContent, useCmsImage, RichTextContent } from "@asteroidcms/core-utils/client";
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
      "title", "hero", "body",
      { field: "author", single: true, select: ["name", "avatar"] },
    ],
  });

  if (loading) return <p>Loading...</p>;
  if (error || !data) return <p>Not found.</p>;

  return (
    <article className="mx-auto max-w-prose px-4 py-10">
      {data.hero && <img src={cmsImage(data.hero)} alt="" className="rounded-xl mb-6" />}
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

---

## Comparison: `<RichTextContent>` vs. `parseRichText`

| | `<RichTextContent>` | `parseRichText` |
| --- | --- | --- |
| **Type** | React component | Pure function |
| **Syntax highlighting** | Yes (highlight.js, lazy) | No |
| **Copy buttons** | Yes | No |
| **Callout icons** | Yes (via portals) | No |
| **Bundle size impact** | +~35KB gzipped (highlight.js) | None |
| **Server-safe** | Yes (but JS shipped for highlighting) | Fully static |
| **Best for** | Blog posts, docs, content pages | Static HTML, email, RSS, Markdown pipelines |

---

## FAQ

**Do I need to import any CSS?**
No. The `tokyo-night-dark` theme and all structural styles are injected via a `<style>` tag on mount. To customize, override the `.hljs-*` or `.rt-*` classes in your own stylesheet.

**Can I swap the highlight.js theme?**
Override the `.hljs-*` classes in your stylesheet — your rules cascade after the injected `<style>` tag.

**Is `parseRichText` safe for user-generated content?**
Yes, with the default allowlist. Scripts, event handlers, and `javascript:` URLs are stripped. Be careful if you extend the allowlist.

**Why do my styles keep resetting?**
Your `classMap` is probably built inline on every render, causing `<RichTextContent>` to re-parse each time. Lift the object to module scope or wrap it in `useMemo`.
