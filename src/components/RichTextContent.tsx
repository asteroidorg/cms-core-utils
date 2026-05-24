import { createElement, useEffect, useMemo, useRef } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/tokyo-night-dark.css";
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
  tag.textContent = CODEBLOCK_STYLE;
  document.head.appendChild(tag);
  styleInjected = true;
}

export function RichTextContent({
  html,
  classMap,
  as = "div",
  className,
  onReady,
  contentRef,
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
  return createElement(as, {
    ref,
    className,
    dangerouslySetInnerHTML: { __html: safe },
  });
}
