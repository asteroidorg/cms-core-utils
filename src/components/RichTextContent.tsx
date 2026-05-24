import {
  createElement,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import hljs from "highlight.js/lib/common";
import {
  parseRichText,
  type ParseRichTextOptions,
  type RichTextClassMap,
} from "./richTextParser";

export type { RichTextClassMap, ParseRichTextOptions };

interface RichTextContentProps {
  html: string;
  classMap?: RichTextClassMap;
  /** Wrapper element. Defaults to `div`. Use `article` for blog content. */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  /**
   * Fires after the parsed HTML is in the DOM and post-render enhancements
   * (syntax highlighting, copy buttons, blockquote decorations) have run.
   * The wrapper element is passed back so callers can read headings, attach
   * a ToC observer, or do other DOM work without re-querying.
   */
  onReady?: (root: HTMLElement) => void;
  /**
   * Optional ref to the wrapper element. Useful for hooks like
   * `useTableOfContents` that need a stable reference to the rendered tree.
   */
  contentRef?: React.MutableRefObject<HTMLElement | null>;
  /**
   * Per-variant icon override for callouts that opt into icons via
   * `data-icon`. Provide a React element for any variant key — these
   * elements are rendered into the chip via a portal, so they live in
   * React land (refs, event handlers, theme context all work). Variants
   * you don't provide fall back to the built-in SVG glyph.
   *
   * Common variants: `"info" | "warning" | "success" | "danger" | "default"`.
   * Custom variant names work too — anything you set via
   * `data-variant` on an `<aside data-callout>`.
   *
   * Example:
   * ```tsx
   * import { Info, AlertTriangle } from "lucide-react";
   *
   * <RichTextContent
   *   html={article.doc}
   *   calloutIcons={{
   *     info: <Info size={14} strokeWidth={2.4} />,
   *     warning: <AlertTriangle size={14} strokeWidth={2.4} />,
   *   }}
   * />
   * ```
   */
  calloutIcons?: Partial<Record<string, ReactNode>>;
}

/**
 * Default look for the pullquote figure emitted by the parser when a
 * blockquote ends with an attribution line (`— Name`). Styles the decorative
 * curly quote marks and gives the author its own treatment so it reads as a
 * separate element from the quote body.
 */
const DEFAULT_CLASS_MAP: RichTextClassMap = {
  variants: {
    "figure:pullquote": "relative my-8",
    "blockquote:pullquote":
      "relative italic text-lg leading-snug tracking-[-0.01em] sm:text-xl",
    "figcaption:pullquote":
      "mt-4 pt-3 border-t border-current/15 not-italic text-xs uppercase tracking-[0.14em] opacity-80",
    "span:quote-open":
      "mr-1 font-serif text-[1.4em] leading-none align-[-0.15em] opacity-60 select-none",
    "span:quote-close":
      "ml-1 font-serif text-[1.4em] leading-none align-[-0.15em] opacity-60 select-none",
    "span:author":
      "ml-1 font-semibold not-italic tracking-[0.16em] text-current",
  },
};

function mergeClassMap(
  defaults: RichTextClassMap,
  user?: RichTextClassMap,
): RichTextClassMap {
  if (!user) return defaults;
  return {
    ...defaults,
    ...user,
    variants: { ...defaults.variants, ...user.variants },
  };
}

/**
 * Server-safe React renderer for CMS rich text fields.
 *
 * Pairs with `parseRichText` from `richTextParser.ts`. Pass a `classMap`
 * keyed by tag, plus special wrapper keys like `tableWrapper`
 * (and `variants` keyed by `${tag}:${variantName}`) to apply frontend-specific
 * Tailwind classes without changing stored content.
 *
 * Built-in figure variants emitted by the parser:
 *   - `figure:image` / `figcaption:image` — wraps standalone `<img>` blocks
 *     and renders the alt/title as a centered caption.
 *   - `figure:pullquote` / `blockquote:pullquote` / `figcaption:pullquote` —
 *     emitted when a blockquote ends with an attribution line like
 *     `— Name` (em/en dash or `--`). The author moves to the `<figcaption>`.
 *     The blockquote body is wrapped with `<span data-variant="quote-open">“</span>`
 *     and `<span data-variant="quote-close">”</span>`, addressable via the
 *     `span:quote-open` / `span:quote-close` keys in `classMap.variants` so
 *     the decorative marks can be sized, colored, or hidden independently.
 *     The author name inside `<figcaption>` is wrapped in
 *     `<span data-variant="author">…</span>` (after the em-dash separator)
 *     so it can be styled with its own `span:author` variant key without
 *     affecting the dash.
 *   - `tableWrapper` — wraps each sanitized `<table>` in a scroll container
 *     before the table tag itself is rendered. Useful when you need the
 *     table to match a bordered, horizontally scrollable design exactly.
 *
 * Sensible defaults for the pullquote layout (decorative quote marks +
 * distinct author treatment) ship in `DEFAULT_CLASS_MAP` and are merged with
 * the caller's `classMap` — user values win on conflict.
 *
 * Example:
 *   ```
 *    <RichTextContent
 *     html={post.body}
 *     classMap={{
 *       figure: "mt-10",
 *       variants: {
 *         "figure:pullquote":
 *           "rounded-xl border-l-4 border-primary-color bg-primary-color/4 p-6 sm:p-8",
 *         "blockquote:pullquote":
 *           "text-lg font-medium leading-snug tracking-[-0.01em] sm:text-xl",
 *         "figcaption:pullquote":
 *           "mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary-color",
 *         "figcaption:image": "mt-3 text-center text-xs text-secondary-color",
 *       },
 *     }}
 *   />
 *   ```
 *
 * Copy this file + `richTextParser.ts` into any consuming frontend; both
 * are dependency-free aside from React.
 */
const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

const ATTRIBUTION_RE = /^(?:[—–-]+|--)\s+\S/;

function isAttributionEl(el: Element | null): boolean {
  if (!el) return false;
  if (el.getAttribute("data-variant") === "attribution") return true;
  return ATTRIBUTION_RE.test((el.textContent ?? "").trim());
}

function findQuoteBody(bq: HTMLQuoteElement): {
  first: HTMLElement | null;
  last: HTMLElement | null;
} {
  const children = Array.from(bq.children) as HTMLElement[];
  if (children.length === 0) return { first: null, last: null };
  let lastIdx = children.length - 1;
  // Skip trailing attribution paragraph(s) when picking where the closing
  // quote mark belongs.
  while (lastIdx >= 0 && isAttributionEl(children[lastIdx])) lastIdx--;
  if (lastIdx < 0) return { first: null, last: null };
  return { first: children[0], last: children[lastIdx] };
}

/* -------------------------------------------------------------------------- */
/* Callout icon injection                                                     */
/* -------------------------------------------------------------------------- */

// Per-variant SVG glyphs rendered inside the callout chip when the author
// opts into the icon. Kept as raw strings so they can be inlined cheaply via
// `innerHTML`. All glyphs share the same 16×16 viewBox so they line up in
// the chip.
const CALLOUT_ICON_SVG: Record<string, string> = {
  info: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  success: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  danger: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
  default: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.6 5.4a4 4 0 0 0 2.5 2.5L21.5 12l-5.4 1.6a4 4 0 0 0-2.5 2.5L12 21.5l-1.6-5.4a4 4 0 0 0-2.5-2.5L2.5 12l5.4-1.6a4 4 0 0 0 2.5-2.5z"/></svg>`,
};

function calloutVariantOf(el: Element): string {
  return el.getAttribute("data-variant") ?? "default";
}

function isIconEnabled(el: Element): boolean {
  const v = el.getAttribute("data-icon");
  // Treat presence-only (`data-icon`) as truthy; explicit "false"/"0" disables.
  if (v === null) return false;
  return v !== "false" && v !== "0";
}

/**
 * Walk the callouts in the rendered subtree and ensure each one that has
 * `data-icon` set carries an empty `<span class="rt-callout-icon">` chip at
 * its first child. The chip's contents are filled later by React (either
 * a portal of the user-supplied element, or the built-in SVG glyph),
 * which lets consumers swap in their own icon components.
 *
 * Returns the chip spans currently in the DOM in document order so the
 * component can render portals into them.
 */
function enhanceCallouts(
  root: HTMLElement,
): Array<{ el: HTMLElement; variant: string }> {
  const callouts = root.querySelectorAll<HTMLElement>("aside[data-callout]");
  callouts.forEach((el) => {
    if (el.dataset.rtCalloutEnhanced === "1") return;
    el.dataset.rtCalloutEnhanced = "1";
    if (!isIconEnabled(el)) return;
    if (el.querySelector(":scope > .rt-callout-icon")) return;
    const variant = calloutVariantOf(el);
    const icon = document.createElement("span");
    icon.className = "rt-callout-icon";
    icon.dataset.variant = variant;
    icon.setAttribute("aria-hidden", "true");
    el.prepend(icon);
  });
  const chips: Array<{ el: HTMLElement; variant: string }> = [];
  root
    .querySelectorAll<HTMLElement>(
      "aside[data-callout] > .rt-callout-icon",
    )
    .forEach((chip) => {
      chips.push({
        el: chip,
        variant:
          chip.dataset.variant ||
          (chip.parentElement?.getAttribute("data-variant") ?? "default"),
      });
    });
  return chips;
}

function enhanceBlockquotes(root: HTMLElement) {
  const quotes = root.querySelectorAll<HTMLQuoteElement>("blockquote");
  quotes.forEach((bq) => {
    if (bq.dataset.rtQuoted === "1") return;
    // Pullquotes inside a figure already get curly quotes from the parser.
    if (bq.closest('figure[data-variant="pullquote"]')) return;
    bq.dataset.rtQuoted = "1";

    const { first, last } = findQuoteBody(bq);
    if (!first || !last) return;

    const open = document.createElement("span");
    open.className = "rt-quote-open";
    open.setAttribute("aria-hidden", "true");
    open.textContent = "“";

    const close = document.createElement("span");
    close.className = "rt-quote-close";
    close.setAttribute("aria-hidden", "true");
    close.textContent = "”";

    first.prepend(open);
    last.append(close);
  });
}

/* -------------------------------------------------------------------------- */
/* Syntax highlighting (highlight.js)                                         */
/* -------------------------------------------------------------------------- */

// `highlight.js/lib/common` ships ~35 popular languages — enough for typical
// CMS content without dragging in every grammar. The theme CSS is imported at
// the top of the file. To add an obscure language, register it explicitly:
//   import lang from "highlight.js/lib/languages/foo"; hljs.registerLanguage("foo", lang);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function preserveSpaces(html: string): string {
  // Keep runs of 2+ spaces visible inside table cells / inline contexts where
  // the browser would otherwise collapse them.
  return html.replace(/ {2,}/g, (m) => "&nbsp;".repeat(m.length));
}

function highlightSource(src: string, lang?: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(src, { language: lang, ignoreIllegals: true })
        .value;
    } catch {
      // fall through to escaped plain text
    }
  }
  return escapeHtml(src);
}

function highlightLine(line: string, lang: string | undefined): string {
  if (!line) return "";
  return preserveSpaces(highlightSource(line, lang));
}

function highlightCodeBlock(pre: HTMLPreElement) {
  const lang = pre.dataset.language;
  if (!lang) return;
  const code = pre.querySelector("code");
  if (!code) return;
  if ((code as HTMLElement).dataset.rtHighlighted === "1") return;
  const source = code.textContent ?? "";
  code.innerHTML = highlightSource(source, lang);
  code.classList.add("hljs");
  (code as HTMLElement).dataset.rtHighlighted = "1";
}

const DIFF_SEPARATOR_RE = /\n?@@---@@\n?/;

type DiffOp = { t: "eq" | "rem" | "add"; line: string };

function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.unshift({ t: "eq", line: a[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.unshift({ t: "rem", line: a[i - 1] });
      i--;
    } else {
      ops.unshift({ t: "add", line: b[j - 1] });
      j--;
    }
  }
  while (i > 0) ops.unshift({ t: "rem", line: a[--i] });
  while (j > 0) ops.unshift({ t: "add", line: b[--j] });
  return ops;
}

function renderDiff(before: string, after: string, lang?: string): string {
  const ops = diffLines(before.split("\n"), after.split("\n"));
  type Cell = { n: number | null; line: string | null; cls: string };
  type Row = { left: Cell; right: Cell };
  const rows: Row[] = [];
  let aNo = 0;
  let bNo = 0;
  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.t === "eq") {
      aNo++;
      bNo++;
      rows.push({
        left: { n: aNo, line: op.line, cls: "" },
        right: { n: bNo, line: op.line, cls: "" },
      });
      k++;
      continue;
    }
    const rems: string[] = [];
    while (k < ops.length && ops[k].t === "rem") {
      rems.push(ops[k].line);
      k++;
    }
    const adds: string[] = [];
    while (k < ops.length && ops[k].t === "add") {
      adds.push(ops[k].line);
      k++;
    }
    const len = Math.max(rems.length, adds.length);
    for (let x = 0; x < len; x++) {
      const remLine = x < rems.length ? rems[x] : null;
      const addLine = x < adds.length ? adds[x] : null;
      rows.push({
        left: {
          n: remLine !== null ? ++aNo : null,
          line: remLine,
          cls: remLine !== null ? "rt-diff-rem" : "rt-diff-empty",
        },
        right: {
          n: addLine !== null ? ++bNo : null,
          line: addLine,
          cls: addLine !== null ? "rt-diff-add" : "rt-diff-empty",
        },
      });
    }
  }
  const cell = (c: Cell, side: "l" | "r") => {
    const sign = side === "l" ? "-" : "+";
    const showSign = c.cls === "rt-diff-rem" || c.cls === "rt-diff-add";
    return (
      `<td class="rt-diff-num">${c.n ?? ""}</td>` +
      `<td class="rt-diff-sign">${showSign ? sign : ""}</td>` +
      `<td class="rt-diff-line ${c.cls}">${c.line === null ? "" : highlightLine(c.line, lang) || "&nbsp;"}</td>`
    );
  };
  const body = rows
    .map((r) => `<tr>${cell(r.left, "l")}${cell(r.right, "r")}</tr>`)
    .join("");
  return `<table class="rt-diff-table"><tbody>${body}</tbody></table>`;
}

function makeCopyButton(
  getText: () => string,
  opts: { className?: string; label?: string } = {},
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = opts.className ?? "rt-codeblock__copy";
  btn.setAttribute("aria-label", opts.label ?? "Copy code");
  btn.innerHTML = COPY_ICON_SVG;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getText());
      btn.innerHTML = CHECK_ICON_SVG;
      btn.classList.add("is-copied");
      window.setTimeout(() => {
        btn.innerHTML = COPY_ICON_SVG;
        btn.classList.remove("is-copied");
      }, 1500);
    } catch {
      // clipboard unavailable; no-op
    }
  });
  return btn;
}

function buildCodeBlockLabel(pre: HTMLPreElement): HTMLElement | null {
  const filename = pre.dataset.filename;
  if (!filename) return null;
  const tag = document.createElement("span");
  tag.className = "rt-codeblock__label";
  const file = document.createElement("span");
  // Use the language-pill styling for the filename so it reads as a small
  // tag rather than plain text. Language itself is no longer displayed.
  file.className = "rt-codeblock__filename rt-codeblock__language";
  file.textContent = filename;
  tag.appendChild(file);
  return tag;
}

function enhanceCodeBlocks(root: HTMLElement) {
  const blocks = root.querySelectorAll<HTMLPreElement>("pre");
  blocks.forEach((pre) => {
    if (pre.dataset.rtEnhanced === "1") return;
    pre.dataset.rtEnhanced = "1";
    pre.classList.add("rt-codeblock");

    const variant = pre.dataset.variant;

    // Diff variant: split content on the @@---@@ marker and render a
    // side-by-side LCS diff. Skip the regular code-block chrome.
    if (variant === "diff") {
      const codeEl = pre.querySelector("code");
      const src = codeEl?.textContent ?? "";
      const [beforeSrc = "", afterSrc = ""] = src.split(DIFF_SEPARATOR_RE);
      pre.innerHTML = renderDiff(beforeSrc, afterSrc, pre.dataset.language);

      // Per-side copy buttons. Each copies only its own snippet (no signs,
      // no line numbers — just the raw text the author originally pasted).
      // Wrap in half-width cells so the buttons sit at the top-right of
      // their respective column instead of bunching on one side.
      const bar = document.createElement("div");
      bar.className = "rt-diff-copy-bar";
      const leftHalf = document.createElement("div");
      leftHalf.className = "rt-diff-copy-half";
      leftHalf.appendChild(
        makeCopyButton(() => beforeSrc, {
          className: "rt-diff-copy",
          label: "Copy before",
        }),
      );
      const rightHalf = document.createElement("div");
      rightHalf.className = "rt-diff-copy-half";
      rightHalf.appendChild(
        makeCopyButton(() => afterSrc, {
          className: "rt-diff-copy",
          label: "Copy after",
        }),
      );
      bar.appendChild(leftHalf);
      bar.appendChild(rightHalf);
      pre.prepend(bar);

      const label = buildCodeBlockLabel(pre);
      if (label) pre.prepend(label);
      return;
    }

    // Terminal variant: synthetic chrome (traffic lights) via CSS; render
    // a `$ ` prompt on every visible line so multi-line snippets read like a
    // real shell session. Copying yields just the commands without prompts.
    if (variant === "terminal") {
      pre.classList.add("rt-terminal");
      const codeEl = pre.querySelector("code");
      const source = codeEl?.textContent ?? "";
      if (codeEl) {
        // Default to shell highlighting when no explicit language is set —
        // a terminal block without `bash`/`sh` selected almost certainly
        // contains shell commands, and `tokenizeFor("sh", …)` is safe to fall
        // back to (it just returns text tokens for content it can't classify).
        const lang = pre.dataset.language || "sh";
        const lines = source.split("\n");
        codeEl.innerHTML = lines
          .map(
            (line) =>
              `<span class="rt-term-line"><span class="rt-term-prompt" aria-hidden="true">$</span> ${highlightLine(line, lang) || "&nbsp;"}</span>`,
          )
          .join("");
      }
      pre.appendChild(makeCopyButton(() => source, { label: "Copy commands" }));
      return;
    }

    const label = buildCodeBlockLabel(pre);
    if (label) pre.prepend(label);

    pre.appendChild(
      makeCopyButton(
        () => pre.querySelector("code")?.textContent ?? pre.innerText,
      ),
    );

    highlightCodeBlock(pre);
  });
}

// Inlined `tokyo-night-dark` highlight.js theme. Bundled as a string rather
// than imported as a CSS file so the package works in SSR environments
// (Node throws "Unknown file extension '.css'" otherwise). Injected once on
// the client via `ensureCodeBlockStyles`.
const HLJS_THEME = `
pre code.hljs { display: block; overflow-x: auto; padding: 1em; }
code.hljs { padding: 3px 5px; }
.hljs-meta, .hljs-comment { color: #565f89; }
.hljs-tag, .hljs-doctag, .hljs-selector-id, .hljs-selector-class,
.hljs-regexp, .hljs-template-tag, .hljs-selector-pseudo,
.hljs-selector-attr, .hljs-variable.language_, .hljs-deletion { color: #f7768e; }
.hljs-variable, .hljs-template-variable, .hljs-number, .hljs-literal,
.hljs-type, .hljs-params, .hljs-link { color: #ff9e64; }
.hljs-built_in, .hljs-attribute { color: #e0af68; }
.hljs-selector-tag { color: #73daca; }
.hljs-keyword, .hljs-title.function_, .hljs-title, .hljs-title.class_,
.hljs-title.class_.inherited__, .hljs-subst, .hljs-property { color: #7dcfff; }
.hljs-quote, .hljs-string, .hljs-symbol, .hljs-bullet,
.hljs-addition { color: #9ece6a; }
.hljs-code, .hljs-formula, .hljs-section { color: #7aa2f7; }
.hljs-name, .hljs-operator, .hljs-char.escape_, .hljs-attr { color: #bb9af7; }
.hljs-punctuation { color: #c0caf5; }
.hljs { background: #1a1b26; color: #9aa5ce; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
`;

const CODEBLOCK_STYLE = `
.rt-codeblock { position: relative; }
.rt-codeblock[data-filename]:not([data-filename=""]) { padding-top: 2rem; }
.rt-codeblock__label {
  position: absolute; top: 0.45rem; left: 0.85rem;
  display: inline-flex; align-items: center; gap: 0.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  pointer-events: none;
}
.rt-codeblock__filename {
  font-size: 0.72rem; letter-spacing: 0.02em;
  color: #d1d5db;
}
.rt-codeblock__sep {
  color: #6b7280;
  font-size: 0.72rem;
}
.rt-codeblock__language {
  font-size: 0.6rem; letter-spacing: 0.08em;
  text-transform: lowercase;
  color: #9ca3af;
  padding: 0.05rem 0.35rem;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.25rem;
}
.rt-codeblock__copy {
  position: absolute; top: 0.4rem; right: 0.4rem;
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.75rem; height: 1.75rem; padding: 0;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.375rem;
  background: rgba(255,255,255,0.04);
  color: #d1d5db;
  cursor: pointer;
  opacity: 0; transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}
.rt-codeblock:hover .rt-codeblock__copy,
.rt-codeblock:focus-within .rt-codeblock__copy { opacity: 1; }
.rt-codeblock__copy:hover { background: rgba(255,255,255,0.1); color: #fff; }
.rt-codeblock__copy.is-copied { color: #34d399; opacity: 1; }
@media (hover: none) { .rt-codeblock__copy { opacity: 1; } }
.rt-quote-open, .rt-quote-close {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.4em;
  line-height: 0;
  vertical-align: -0.15em;
  opacity: 0.6;
  user-select: none;
}
.rt-quote-open { margin-right: 0.15em; }
.rt-quote-close { margin-left: 0.15em; }

/* Callout chip ----------------------------------------------------------- */
/* Layout: when a callout opts into an icon, use a 2-column grid so the chip
   sits left of the title + body. Consumers can override via classMap. */
aside[data-callout][data-icon]:not([data-icon="false"]):not([data-icon="0"]) {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.85rem;
  align-items: start;
}
aside[data-callout][data-icon]:not([data-icon="false"]):not([data-icon="0"]) > .rt-callout-icon {
  grid-row: 1 / span 99;
  margin-top: 0.05rem;
}
.rt-callout-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 0.4rem;
  color: #fff;
  background: #475569;
  flex-shrink: 0;
}
.rt-callout-icon[data-variant="info"]    { background: #2563eb; }
.rt-callout-icon[data-variant="warning"] { background: #d97706; }
.rt-callout-icon[data-variant="success"] { background: #16a34a; }
.rt-callout-icon[data-variant="danger"]  { background: #dc2626; }
.rt-callout-icon[data-variant="default"] { background: #475569; }

/* Collapsible (FAQ accordion) ------------------------------------------ */
/* Native <details>/<summary> with a rotating chevron. Only structural
   styling lives here — colors, padding, and typography belong to
   consumers via the \`collapsible\` and \`collapsibleTitle\` classMap keys. */
details[data-collapsible] > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
details[data-collapsible] > summary::-webkit-details-marker { display: none; }
details[data-collapsible] > summary::after {
  content: "";
  width: 0.55rem;
  height: 0.55rem;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg) translate(-0.1rem, 0.05rem);
  transition: transform 0.18s ease;
  opacity: 0.55;
  flex-shrink: 0;
}
details[data-collapsible][open] > summary::after {
  transform: rotate(45deg) translate(-0.05rem, -0.05rem);
}
/* highlight.js theme handles .hljs-* color classes; we only override the
   default .hljs background so the per-block chrome (dark bg, terminal,
   diff red/green rows) wins. */
.rt-codeblock .hljs,
.rt-codeblock code.hljs { background: transparent; padding: 0; }

/* Terminal variant ------------------------------------------------------- */
.rt-codeblock.rt-terminal,
.rt-codeblock[data-variant="terminal"] {
  position: relative;
  padding-top: 2.25rem;
  background: #0b0b0d;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.65rem;
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset,
              0 10px 30px -10px rgba(0,0,0,0.6);
}
.rt-codeblock.rt-terminal::before,
.rt-codeblock[data-variant="terminal"]::before {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 1.75rem;
  background: linear-gradient(#1a1a1d, #141417);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  border-radius: 0.65rem 0.65rem 0 0;
}
.rt-codeblock.rt-terminal::after,
.rt-codeblock[data-variant="terminal"]::after {
  content: "";
  position: absolute; top: 0.55rem; left: 0.75rem;
  width: 0.65rem; height: 0.65rem; border-radius: 50%;
  background: #ff5f57;
  box-shadow:
    1.1rem 0 0 0 #febc2e,
    2.2rem 0 0 0 #28c840;
}
.rt-codeblock.rt-terminal code,
.rt-codeblock[data-variant="terminal"] code {
  color: #d4d4d8;
  display: block;
}
.rt-term-line { display: block; white-space: pre-wrap; }
.rt-term-prompt {
  color: #28c840;
  font-weight: 600;
  margin-right: 0.35em;
  user-select: none;
}

/* Diff variant ----------------------------------------------------------- */
.rt-codeblock[data-variant="diff"] {
  padding: 0;
  overflow: hidden;
  background: #0b0b0d;
  border: 1px solid rgba(255,255,255,0.08);
}
.rt-codeblock[data-variant="diff"][data-filename]:not([data-filename=""]) {
  padding-top: 2rem;
}
.rt-diff-table {
  width: 100%;
  border-collapse: collapse;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.55;
  color: #e5e7eb;
  table-layout: fixed;
}
.rt-diff-table colgroup { display: none; }
.rt-diff-table td {
  padding: 0 0.5rem;
  vertical-align: top;
  white-space: pre-wrap;
  word-break: break-word;
}
.rt-diff-table td.rt-diff-num {
  width: 2.25rem;
  text-align: right;
  color: rgba(156,163,175,0.55);
  user-select: none;
  background: rgba(255,255,255,0.02);
}
.rt-diff-table td.rt-diff-sign {
  width: 0.85rem;
  text-align: center;
  user-select: none;
  color: rgba(255,255,255,0.45);
}
.rt-diff-table td.rt-diff-line.rt-diff-rem {
  background: rgba(248,113,113,0.12);
  color: #fecaca;
}
.rt-diff-table tr:has(td.rt-diff-rem) td.rt-diff-sign:first-of-type {
  color: #f87171;
}
.rt-diff-table td.rt-diff-line.rt-diff-add {
  background: rgba(74,222,128,0.12);
  color: #bbf7d0;
}
.rt-diff-table tr:has(td.rt-diff-add) td.rt-diff-sign + td + td + td.rt-diff-sign {
  color: #4ade80;
}
.rt-diff-table td.rt-diff-line.rt-diff-empty {
  background: rgba(255,255,255,0.025);
}
.rt-diff-table tr td:nth-child(4) { border-left: 1px solid rgba(255,255,255,0.06); }
.rt-diff-copy-bar {
  position: absolute; top: 0.4rem; left: 0; right: 0; z-index: 2;
  display: grid; grid-template-columns: 1fr 1fr;
  pointer-events: none;
}
.rt-diff-copy-half {
  display: flex;
  justify-content: flex-end;
  padding-right: 0.4rem;
}
.rt-diff-copy {
  pointer-events: auto;
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.6rem; height: 1.6rem; padding: 0;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.375rem;
  background: rgba(20,20,23,0.85);
  color: #d1d5db;
  cursor: pointer;
  opacity: 0; transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}
.rt-codeblock[data-variant="diff"]:hover .rt-diff-copy,
.rt-codeblock[data-variant="diff"]:focus-within .rt-diff-copy { opacity: 1; }
.rt-diff-copy:hover { background: rgba(0,0,0,0.92); color: #fff; }
.rt-diff-copy.is-copied { color: #34d399; opacity: 1; }
@media (hover: none) { .rt-diff-copy { opacity: 1; } }
`;

let styleInjected = false;
function ensureCodeBlockStyles() {
  if (styleInjected || typeof document === "undefined") return;
  if (document.getElementById("rt-codeblock-style")) {
    styleInjected = true;
    return;
  }
  const tag = document.createElement("style");
  tag.id = "rt-codeblock-style";
  tag.textContent = HLJS_THEME + "\n" + CODEBLOCK_STYLE;
  document.head.appendChild(tag);
  styleInjected = true;
}

type CalloutChip = { el: HTMLElement; variant: string };

function calloutChipsEqual(a: CalloutChip[], b: CalloutChip[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].el !== b[i].el || a[i].variant !== b[i].variant) return false;
  }
  return true;
}

function BuiltinCalloutIcon({ variant }: { variant: string }) {
  const html = CALLOUT_ICON_SVG[variant] ?? CALLOUT_ICON_SVG.default;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function RichTextContent({
  html,
  classMap,
  as = "div",
  className,
  onReady,
  contentRef,
  calloutIcons,
}: RichTextContentProps) {
  const merged = useMemo(
    () => mergeClassMap(DEFAULT_CLASS_MAP, classMap),
    [classMap],
  );
  const safe = useMemo(
    () => parseRichText(html, { classMap: merged }),
    [html, merged],
  );

  const ref = useRef<HTMLElement | null>(null);
  const [chips, setChips] = useState<CalloutChip[]>([]);

  useEffect(() => {
    ensureCodeBlockStyles();
    const root = ref.current;
    if (!root) return;
    if (contentRef) contentRef.current = root;

    // `dangerouslySetInnerHTML` rebuilds the subtree whenever the parsed HTML
    // changes — and on a parent re-render that produces a new `html` string
    // reference even with identical content (common with Apollo's
    // `cache-and-network` returning a fresh object after a background
    // refetch). The freshly-mounted `<pre>` / `<blockquote>` nodes carry no
    // `data-rt-*` markers, so re-enhancing is just a matter of re-running
    // the helpers. A `MutationObserver` makes that automatic: any subtree
    // mutation triggers a re-application, so syntax highlighting and copy
    // buttons survive every kind of re-render without the consumer having
    // to think about effect deps or stable prop identity.
    const apply = () => {
      // The enhancers themselves mutate the subtree (inject copy buttons,
      // rewrite `<code>` innerHTML for hljs). Disconnect while running so
      // the observer doesn't loop on its own writes.
      mo.disconnect();
      enhanceCodeBlocks(root);
      enhanceBlockquotes(root);
      const nextChips = enhanceCallouts(root);
      // Equality short-circuit so re-renders triggered by other DOM
      // mutations (highlighter writes, copy buttons) don't loop us through
      // setState → portal write → MO fires → apply → setState…
      setChips((prev) => (calloutChipsEqual(prev, nextChips) ? prev : nextChips));
      onReady?.(root);
      mo.observe(root, { childList: true, subtree: true });
    };

    let raf = 0;
    const mo = new MutationObserver(() => {
      // Coalesce bursts of mutations from a single React commit into one
      // enhancement pass.
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    });

    apply();

    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [safe, onReady, contentRef]);

  // `createElement` avoids the JSX type explosion that happens when a dynamic
  // `<Tag />` widens to the union of every IntrinsicElement
  // (TS2590: Expression produces a union type that is too complex to represent).
  //
  // Pass the stable object ref directly — using an inline callback ref here
  // would be recreated on every render, causing React to null-then-reset the
  // ref on each commit. That churn breaks downstream observers
  // (`useTableOfContents`, custom MutationObservers) that expect the node
  // identity to be stable across renders of the same article.
  return (
    <Fragment>
      {createElement(as, {
        ref,
        className,
        dangerouslySetInnerHTML: { __html: safe },
      })}
      {chips.map((chip, i) =>
        createPortal(
          calloutIcons && chip.variant in calloutIcons ? (
            calloutIcons[chip.variant]
          ) : (
            <BuiltinCalloutIcon variant={chip.variant} />
          ),
          chip.el,
          `${chip.variant}:${i}`,
        ),
      )}
    </Fragment>
  );
}
