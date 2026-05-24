---
title: Rich text
description: Render stored HTML safely with <RichTextContent>, style it with a classMap, opt out of syntax highlighting via parseRichText, and compute reading time.
order: 10
---

# Rich text

CMS rich-text fields are stored as HTML. Rendering them safely takes two pieces:

- **`parseRichText`** — turns the stored HTML into a sanitized HTML string, applying classes from a `classMap`. Pure function, server-safe.
- **`<RichTextContent>`** — a React component that wraps `parseRichText` and lazily runs syntax highlighting on the client.

| Use this              | Where                                                          | Import from                       |
| --------------------- | -------------------------------------------------------------- | --------------------------------- |
| `<RichTextContent>`   | React trees, including Server Components (it self-marks).      | `@asteroidcms/core-utils/client`  |
| `parseRichText`       | Anywhere — Server Components, scripts, Markdown pipelines.     | `@asteroidcms/core-utils`         |

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
- Pullquote `<figure>` elements (a blockquote followed by an `— Author` attribution) get default classes so they look right out of the box.

---

## Props

| Prop        | Type                                  | Default | Notes                                                          |
| ----------- | ------------------------------------- | ------- | -------------------------------------------------------------- |
| `html`      | `string` (required)                   | —       | The raw HTML stored in the CMS field.                          |
| `classMap`  | `RichTextClassMap`                    | `{}`    | Per-tag and per-variant class overrides. Merges over defaults. |
| `as`        | `keyof JSX.IntrinsicElements`         | `"div"` | The wrapper element. Use `"article"` for blog posts.           |
| `className` | `string`                              | —       | Applied to the wrapper.                                        |

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

If you don't want the highlight.js side effect (~50 KB of CSS + the JS), or you're rendering inside a Markdown pipeline, use the parser directly:

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

`<RichTextContent>` highlights any `<pre><code class="language-xxx">…</code></pre>` block once after mount. The bundled theme is `tokyo-night-dark`. To swap it, override the relevant `.hljs-*` classes in your own stylesheet.

To opt out entirely, render through `parseRichText` instead — that path doesn't import highlight.js.

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
