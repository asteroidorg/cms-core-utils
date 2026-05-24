/**
 * Portable rich-text parser for CMS content.
 *
 * Zero runtime dependencies. Safe to copy into any consuming frontend.
 *
 * Pipeline:
 *   1. Detect & migrate legacy "markdown-in-divs" content to clean semantic HTML.
 *   2. Walk the HTML through a tag/attribute allowlist (strips <script>, event
 *      handlers, javascript: URLs, unknown tags).
 *   3. Merge per-tag and per-variant classes from `options.classMap`.
 *
 * Idempotent: parseRichText(parseRichText(x, opts), opts) === parseRichText(x, opts).
 */

export type RichTextClassKey =
  | "p"
  | "br"
  | "hr"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "ul"
  | "ol"
  | "li"
  | "blockquote"
  | "pre"
  | "code"
  | "inlineCode"
  | "a"
  | "strong"
  | "em"
  | "u"
  | "s"
  | "kbd"
  | "table"
  | "tableWrapper"
  | "thead"
  | "tbody"
  | "tr"
  | "th"
  | "td"
  | "figure"
  | "figcaption"
  | "img"
  | "span"
  | "callout"
  | "calloutTitle";

export type RichTextClassMap = Partial<Record<RichTextClassKey, string>> & {
  /** Variant overrides keyed as `${matchKey}:${variant}`, e.g. "callout:warning". */
  variants?: Record<string, string>;
};

export interface ParseRichTextOptions {
  classMap?: RichTextClassMap;
  /** Tag allowlist override. Defaults to a safe semantic set. */
  allowlist?: ReadonlyArray<string>;
  /**
   * When `true` (default), inject slugified `id` attributes on `<h1>`–`<h6>`
   * tags that don't already have one. Lets ToC anchors resolve from the
   * server-rendered markup without a client-side mutation step.
   */
  autoHeadingIds?: boolean;
}

const DEFAULT_ALLOWLIST: ReadonlyArray<string> = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "kbd",
  "a",
  "strong",
  "em",
  "u",
  "b",
  "i",
  "s",
  "strike",
  "del",
  "mark",
  "small",
  "sub",
  "sup",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "colgroup",
  "col",
  "figure",
  "figcaption",
  "img",
  "aside",
  "section",
  "article",
  "div",
  "span",
];

/** Per-tag attribute allowlist. Global attrs from GLOBAL_ALLOWED_ATTRS apply to all. */
const ALLOWED_ATTRS: Record<string, ReadonlyArray<string>> = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  col: ["span", "width"],
  colgroup: ["span"],
  table: ["border", "cellpadding", "cellspacing"],
  span: ["style"],
};

/**
 * Tag → allowlisted CSS property names. Inline `style` is otherwise blocked
 * by the sanitizer; properties listed here are extracted and re-emitted with
 * value-level validation.
 */
const ALLOWED_STYLE_PROPS: Record<string, ReadonlyArray<string>> = {
  span: ["font-size"],
};

/** Strict per-property value validators for inline `style` declarations. */
const STYLE_VALUE_VALIDATORS: Record<string, (value: string) => boolean> = {
  "font-size": (v) => /^\d{1,3}(?:\.\d+)?(?:px|rem|em|%)$/.test(v.trim()),
};

function sanitizeStyle(tag: string, style: string): string {
  const allowed = ALLOWED_STYLE_PROPS[tag];
  if (!allowed || !style) return "";
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const name = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!allowed.includes(name)) continue;
    const validate = STYLE_VALUE_VALIDATORS[name];
    if (!validate || !validate(value)) continue;
    out.push(`${name}: ${value}`);
  }
  return out.join("; ");
}

const GLOBAL_ALLOWED_ATTRS: ReadonlyArray<string> = [
  "id",
  "class",
  "lang",
  "dir",
  "data-variant",
  "data-callout",
  "data-title",
  "data-callout-title",
  "data-language",
  "data-filename",
];

const URL_ATTRS = new Set(["href", "src"]);

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function parseRichText(
  html: string,
  options: ParseRichTextOptions = {},
): string {
  if (!html || typeof html !== "string") return "";

  let working = isLegacyFormat(html) ? migrateLegacyToHtml(html) : html;
  working = removeEmptyParagraphs(working);
  working = upgradeStandaloneImages(working);
  working = upgradeAuthoredBlockquotes(working);
  working = flattenTableCellParagraphs(working);
  working = sanitizeAndStyle(working, options);
  if (options.autoHeadingIds !== false) {
    working = injectHeadingIds(working);
  }
  return working;
}

/**
 * Add a slugified `id` to each `<h1>`–`<h6>` that doesn't already have one.
 * Pure string transform; safe to run as a post-pass after sanitization.
 */
function injectHeadingIds(html: string): string {
  const used = new Map<string, number>();
  // First, reserve existing IDs so generated slugs don't collide with them.
  const existingRe = /<h[1-6]\b[^>]*\bid\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/gi;
  let em: RegExpExecArray | null;
  while ((em = existingRe.exec(html)) !== null) {
    const id = em[2] ?? em[3] ?? em[4] ?? "";
    if (id) used.set(id, (used.get(id) ?? 0) + 1);
  }
  return html.replace(
    /<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag: string, attrs: string, inner: string) => {
      if (/\bid\s*=/i.test(attrs)) return full;
      const text = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return full;
      const base = slugifyHeading(text) || tag;
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n}`;
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    },
  );
}

function slugifyHeading(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Tiptap stores table-cell content as `<p>` blocks (`<td><p>x</p></td>`),
 * which produces unwanted vertical margin and an extra block element when
 * consumers style table cells. Unwrap the paragraphs so cells hold inline
 * content directly. Multiple `<p>` siblings inside the same cell are joined
 * with `<br />` so line breaks survive.
 */
function flattenTableCellParagraphs(html: string): string {
  return html.replace(
    /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, attrs: string, inner: string) => {
      let flat = inner;
      // Drop opening <p ...> tags.
      flat = flat.replace(/<p\b[^>]*>/gi, "");
      // Replace closing </p> followed by more content with a <br/>, drop trailing ones.
      flat = flat.replace(/<\/p>(\s*)(?=\S)/gi, "<br />$1");
      flat = flat.replace(/<\/p>\s*$/i, "");
      return `<${tag}${attrs}>${flat.trim()}</${tag}>`;
    },
  );
}

/**
 * Strips `<p>` elements that contain nothing but whitespace, `&nbsp;`, or a
 * single `<br>`. Editor placeholders and stray blank lines in stored content
 * disappear without touching paragraphs that hold real content.
 */
export function removeEmptyParagraphs(html: string): string {
  return html.replace(/<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "");
}

/* -------------------------------------------------------------------------- */
/* Figure transforms (run on already-HTML content, before sanitize)           */
/* -------------------------------------------------------------------------- */

/**
 * Wraps a standalone `<p><img/></p>` in `<figure data-variant="image">` with a
 * `<figcaption>` derived from the image's title or alt. Images already nested
 * inside a `<figure>` are left untouched.
 */
function upgradeStandaloneImages(html: string): string {
  return html.replace(
    /<p\b[^>]*>\s*(<img\b[^>]*?>)\s*<\/p>/gi,
    (_full, img: string) => {
      const altMatch = img.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const titleMatch = img.match(/\btitle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const alt = altMatch ? (altMatch[1] ?? altMatch[2] ?? "") : "";
      const title = titleMatch ? (titleMatch[1] ?? titleMatch[2] ?? "") : "";
      const caption = title || alt;
      const captionHtml = caption
        ? `<figcaption data-variant="image">${escapeHtml(caption)}</figcaption>`
        : "";
      return `<figure data-variant="image">${img}${captionHtml}</figure>`;
    },
  );
}

/**
 * Injects decorative curly-quote spans inside the first and last paragraph
 * of pullquote body HTML so they flow inline with the quote text instead of
 * appearing on their own lines as siblings of `<p>` blocks.
 */
function injectQuoteSpans(inner: string): string {
  const trimmed = inner.trim();
  if (!trimmed) return trimmed;

  const openSpan = `<span data-variant="quote-open">“</span>`;
  const closeSpan = `<span data-variant="quote-close">”</span>`;

  let result = trimmed.replace(
    /^(\s*<p\b[^>]*>)/,
    (_m, tag) => `${tag}${openSpan}`,
  );
  if (result === trimmed) {
    // No leading <p>; just prepend the span as a sibling.
    result = `${openSpan}${result}`;
  }

  const replaced = result.replace(
    /(<\/p>\s*)$/,
    (_m, tag) => `${closeSpan}${tag}`,
  );
  if (replaced === result) {
    result = `${result}${closeSpan}`;
  } else {
    result = replaced;
  }

  return result;
}

/**
 * Detects blockquotes whose last paragraph is an attribution line (`— Name`,
 * `–- Name`, or `-- Name`) and rewrites them as a pull-quote figure:
 *
 *   <figure data-variant="pullquote">
 *     <blockquote data-variant="pullquote">…rest…</blockquote>
 *     <figcaption data-variant="pullquote">— Name</figcaption>
 *   </figure>
 *
 * Blockquotes already nested inside a `<figure>` are left untouched.
 */
function upgradeAuthoredBlockquotes(html: string): string {
  const figureRanges: Array<[number, number]> = [];
  const figRe = /<figure\b[\s\S]*?<\/figure>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = figRe.exec(html)) !== null) {
    figureRanges.push([fm.index, fm.index + fm[0].length]);
  }
  const insideFigure = (pos: number): boolean =>
    figureRanges.some(([s, e]) => pos >= s && pos < e);

  return html.replace(
    /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (full, inner: string, offset: number) => {
      if (typeof offset === "number" && insideFigure(offset)) return full;

      const lastP = inner.match(/<p\b[^>]*>([\s\S]*?)<\/p>\s*$/i);
      if (!lastP) return full;
      const text = stripInlineTags(decodeEntities(lastP[1])).trim();
      const authorMatch = text.match(/^(?:[—–]+|--)\s+(.+)$/);
      if (!authorMatch) return full;

      const author = authorMatch[1].trim();
      const rest = inner.slice(0, inner.length - lastP[0].length).trim();
      if (!rest) return full;

      const wrapped = injectQuoteSpans(rest);
      return `<figure data-variant="pullquote"><blockquote data-variant="pullquote">${wrapped}</blockquote><figcaption data-variant="pullquote">— <span data-variant="author">${escapeHtml(author)}</span></figcaption></figure>`;
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Legacy "markdown-in-divs" detection + migration                            */
/* -------------------------------------------------------------------------- */

function isLegacyFormat(html: string): boolean {
  if (!/<div\b/i.test(html)) return false;
  return /<div[^>]*>\s*(?:&gt;|```|\|)/i.test(html);
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractLegacyLines(html: string): string[] {
  const normalized = html
    .replace(/\r\n?/g, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/div>/gi, "\n")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n");
  return normalized.split("\n").map((line) => line.replace(/\s+$/g, ""));
}

function stripInlineTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function renderInline(raw: string): string {
  let out = decodeEntities(raw);

  out = out.replace(
    /`([^`]+)`/g,
    (_m, code) => `<code>${escapeHtml(decodeEntities(code))}</code>`,
  );
  // Image markdown must run before links so `![alt](url)` isn't matched as a link.
  out = out.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt, src) =>
      `<img src="${escapeHtml(String(src).trim())}" alt="${escapeHtml(String(alt))}" />`,
  );
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text, href) =>
      `<a href="${escapeHtml(String(href).trim())}" target="_blank" rel="noreferrer noopener">${text}</a>`,
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");

  return out;
}

function isCodeFence(line: string): boolean {
  return /^\s*```/.test(stripInlineTags(decodeEntities(line)).trim());
}

function isBlockquoteLine(line: string): boolean {
  return stripInlineTags(decodeEntities(line)).trim().startsWith(">");
}

function calloutHeaderOf(
  line: string,
): { title: string; variant: string } | null {
  const text = stripInlineTags(decodeEntities(line)).trim();
  const m = text.match(/^>\s*\[!\s*([^\]]+?)\s*\]\s*$/);
  if (!m) return null;
  const raw = m[1];
  const lower = raw.toLowerCase();
  const knownVariants = [
    "info",
    "warning",
    "success",
    "danger",
    "note",
    "tip",
    "caution",
    "important",
  ];
  const variant = knownVariants.includes(lower)
    ? lower === "note"
      ? "info"
      : lower === "tip"
        ? "success"
        : lower === "caution" || lower === "important"
          ? "warning"
          : lower
    : "info";
  return { title: raw, variant };
}

function stripBlockquoteMarker(line: string): string {
  return stripInlineTags(decodeEntities(line)).replace(/^\s*>\s?/, "");
}

function isTableLine(line: string): boolean {
  return /^\|.*\|$/.test(stripInlineTags(decodeEntities(line)).trim());
}

function isTableDivider(line: string): boolean {
  return /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(
    stripInlineTags(decodeEntities(line)).trim(),
  );
}

function splitTableRow(line: string): string[] {
  return stripInlineTags(decodeEntities(line))
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(rows: string[]): string {
  if (rows.length === 0) return "";
  let headerCells: string[] = [];
  let bodyStart = 0;
  if (rows.length >= 2 && isTableDivider(rows[1])) {
    headerCells = splitTableRow(rows[0]);
    bodyStart = 2;
  }
  const bodyRows = rows.slice(bodyStart).map(splitTableRow);
  const head = headerCells.length
    ? `<thead><tr>${headerCells.map((c) => `<th>${renderInline(c)}</th>`).join("")}</tr></thead>`
    : "";
  const body = bodyRows.length
    ? `<tbody>${bodyRows.map((cells) => `<tr>${cells.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`
    : "";
  return `<table>${head}${body}</table>`;
}

function renderCallout(
  title: string,
  variant: string,
  bodyLines: string[],
): string {
  const body = bodyLines.map((l) => renderInline(l)).join("<br />");
  return `<aside data-callout data-variant="${escapeHtml(variant)}" data-title="${escapeHtml(title)}">${body ? `<p>${body}</p>` : ""}</aside>`;
}

function renderBlockquote(lines: string[]): string {
  if (lines.length > 0) {
    const last = stripInlineTags(
      decodeEntities(lines[lines.length - 1]),
    ).trim();
    const authorMatch = last.match(/^(?:[—–]+|--)\s+(.+)$/);
    if (authorMatch && lines.length > 1) {
      const author = authorMatch[1].trim();
      const quoteLines = lines.slice(0, -1);
      const body = quoteLines.map((l) => renderInline(l)).join("<br />");
      return `<figure data-variant="pullquote"><blockquote data-variant="pullquote"><p><span data-variant="quote-open">“</span>${body}<span data-variant="quote-close">”</span></p></blockquote><figcaption data-variant="pullquote">— <span data-variant="author">${escapeHtml(author)}</span></figcaption></figure>`;
    }
  }
  return `<blockquote><p>${lines.map((l) => renderInline(l)).join("<br />")}</p></blockquote>`;
}

function isImageOnlyLine(line: string): boolean {
  const text = stripInlineTags(decodeEntities(line)).trim();
  return /^!\[[^\]]*\]\([^)]+\)$/.test(text);
}

function renderImageFigure(line: string): string {
  const m = stripInlineTags(decodeEntities(line))
    .trim()
    .match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!m) return "";
  const alt = m[1];
  const src = m[2].trim();
  const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
  const cap = alt
    ? `<figcaption data-variant="image">${escapeHtml(alt)}</figcaption>`
    : "";
  return `<figure data-variant="image">${img}${cap}</figure>`;
}

function renderParagraph(lines: string[]): string {
  const body = lines.map((l) => renderInline(l)).join("<br />");
  return body.length === 0 ? "" : `<p>${body}</p>`;
}

function migrateLegacyToHtml(html: string): string {
  const lines = extractLegacyLines(html);
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = stripInlineTags(decodeEntities(line)).trim();

    if (trimmed.length === 0) {
      i++;
      continue;
    }

    if (isCodeFence(line)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !isCodeFence(lines[i])) {
        codeLines.push(stripInlineTags(decodeEntities(lines[i])));
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const callout = calloutHeaderOf(line);
    if (callout) {
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && isBlockquoteLine(lines[i])) {
        bodyLines.push(stripBlockquoteMarker(lines[i]));
        i++;
      }
      blocks.push(renderCallout(callout.title, callout.variant, bodyLines));
      continue;
    }

    if (isBlockquoteLine(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && isBlockquoteLine(lines[i])) {
        quoteLines.push(stripBlockquoteMarker(lines[i]));
        i++;
      }
      blocks.push(renderBlockquote(quoteLines));
      continue;
    }

    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push(renderTable(tableLines));
      continue;
    }

    if (isImageOnlyLine(line)) {
      blocks.push(renderImageFigure(line));
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      stripInlineTags(decodeEntities(lines[i])).trim().length > 0 &&
      !isCodeFence(lines[i]) &&
      !isBlockquoteLine(lines[i]) &&
      !isTableLine(lines[i]) &&
      !isImageOnlyLine(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    const p = renderParagraph(paragraphLines);
    if (p) blocks.push(p);
  }

  return blocks.join("");
}

/* -------------------------------------------------------------------------- */
/* Sanitize + classMap pass                                                   */
/* -------------------------------------------------------------------------- */

type Token =
  | { type: "text"; value: string }
  | { type: "comment" }
  | {
      type: "open";
      tag: string;
      attrs: Record<string, string>;
      selfClosing: boolean;
    }
  | { type: "close"; tag: string };

const VOID_TAGS = new Set([
  "br",
  "hr",
  "img",
  "input",
  "meta",
  "link",
  "source",
  "wbr",
  "col",
]);

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      tokens.push({ type: "text", value: html.slice(i) });
      break;
    }
    if (lt > i) tokens.push({ type: "text", value: html.slice(i, lt) });

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end === -1) {
        i = html.length;
        break;
      }
      tokens.push({ type: "comment" });
      i = end + 3;
      continue;
    }

    let end = lt + 1;
    let inQuote: string | null = null;
    while (end < html.length) {
      const ch = html[end];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else {
        if (ch === '"' || ch === "'") inQuote = ch;
        else if (ch === ">") break;
      }
      end++;
    }
    if (end >= html.length) {
      tokens.push({ type: "text", value: html.slice(lt) });
      break;
    }

    const tagContent = html.slice(lt + 1, end).trim();
    if (tagContent.startsWith("/")) {
      tokens.push({
        type: "close",
        tag: tagContent.slice(1).trim().toLowerCase(),
      });
    } else {
      const selfClosingMark = tagContent.endsWith("/");
      const inner = selfClosingMark
        ? tagContent.slice(0, -1).trim()
        : tagContent;
      const spaceIdx = inner.search(/\s/);
      const tag = (
        spaceIdx === -1 ? inner : inner.slice(0, spaceIdx)
      ).toLowerCase();
      const attrStr = spaceIdx === -1 ? "" : inner.slice(spaceIdx + 1);
      const attrs = parseAttrs(attrStr);
      tokens.push({
        type: "open",
        tag,
        attrs,
        selfClosing: selfClosingMark || VOID_TAGS.has(tag),
      });
    }
    i = end + 1;
  }

  return tokens;
}

function parseAttrs(str: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re =
    /([a-zA-Z_][a-zA-Z0-9_:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    out[name] = decodeEntities(value);
  }
  return out;
}

function isAttrAllowed(tag: string, attr: string): boolean {
  if (attr.startsWith("on")) return false;
  if (GLOBAL_ALLOWED_ATTRS.includes(attr)) return true;
  const list = ALLOWED_ATTRS[tag];
  return Boolean(list && list.includes(attr));
}

function isSafeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (
    v.startsWith("javascript:") ||
    (v.startsWith("data:") && !v.startsWith("data:image/"))
  )
    return false;
  if (v.startsWith("vbscript:") || v.startsWith("file:")) return false;
  return true;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function classKeyForTag(
  tag: string,
  attrs: Record<string, string>,
  openStack: ReadonlyArray<string>,
): RichTextClassKey | null {
  if (tag === "aside" && "data-callout" in attrs) return "callout";
  if (tag === "p" && "data-callout-title" in attrs) return "calloutTitle";
  if (tag === "code" && openStack[openStack.length - 1] !== "pre")
    return "inlineCode";

  const known: ReadonlyArray<RichTextClassKey> = [
    "p",
    "br",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "kbd",
    "a",
    "strong",
    "em",
    "u",
    "s",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "figure",
    "figcaption",
    "img",
    "span",
  ];
  return (known as ReadonlyArray<string>).includes(tag)
    ? (tag as RichTextClassKey)
    : null;
}

function variantClass(
  classMap: RichTextClassMap | undefined,
  matchKey: string | null,
  variant: string | undefined,
): string | undefined {
  if (!classMap?.variants || !matchKey || !variant) return undefined;
  return classMap.variants[`${matchKey}:${variant}`];
}

function sanitizeAndStyle(html: string, options: ParseRichTextOptions): string {
  const allowlist = options.allowlist ?? DEFAULT_ALLOWLIST;
  const classMap = options.classMap;
  const tokens = tokenize(html);
  const out: string[] = [];
  const openStack: string[] = [];
  const skipStack: Array<{ tag: string; dropChildren: boolean }> = [];
  const tableWrapperStack: boolean[] = [];

  for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
    const token = tokens[tokenIdx];
    if (token.type === "comment") continue;

    if (token.type === "text") {
      if (skipStack.length > 0 && skipStack[skipStack.length - 1].dropChildren)
        continue;
      out.push(token.value);
      continue;
    }

    if (token.type === "open") {
      const allowed = allowlist.includes(token.tag);
      const dropChildren = token.tag === "script" || token.tag === "style";

      if (!allowed) {
        if (!token.selfClosing)
          skipStack.push({ tag: token.tag, dropChildren });
        continue;
      }

      const safeAttrs: Record<string, string> = {};
      for (const [name, value] of Object.entries(token.attrs)) {
        if (!isAttrAllowed(token.tag, name)) continue;
        if (URL_ATTRS.has(name) && !isSafeUrl(value)) continue;
        if (name === "style") {
          const cleaned = sanitizeStyle(token.tag, value);
          if (cleaned) safeAttrs.style = cleaned;
          continue;
        }
        safeAttrs[name] = value;
      }

      const matchKey = classKeyForTag(token.tag, token.attrs, openStack);
      const variant = token.attrs["data-variant"];

      const classes: string[] = [];
      if (safeAttrs.class) classes.push(safeAttrs.class);
      if (matchKey && classMap?.[matchKey])
        classes.push(classMap[matchKey] as string);
      const variantCls = variantClass(classMap, matchKey, variant);
      if (variantCls) classes.push(variantCls);

      if (token.tag === "a") {
        if (safeAttrs.target === "_blank" && !safeAttrs.rel)
          safeAttrs.rel = "noreferrer noopener";
      }

      const merged = classes.join(" ").trim();
      if (merged) safeAttrs.class = merged;
      else delete safeAttrs.class;

      const attrStr = Object.entries(safeAttrs)
        .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
        .join(" ");

      if (token.tag === "table") {
        const wrapperClass = classMap?.tableWrapper;
        if (wrapperClass) {
          out.push(`<div class="${escapeAttr(wrapperClass)}">`);
          tableWrapperStack.push(true);
        } else {
          tableWrapperStack.push(false);
        }
      }

      out.push(
        `<${token.tag}${attrStr ? " " + attrStr : ""}${token.selfClosing ? " /" : ""}>`,
      );
      if (!token.selfClosing) openStack.push(token.tag);

      if (
        token.tag === "aside" &&
        "data-callout" in token.attrs &&
        token.attrs["data-title"]
      ) {
        const title = token.attrs["data-title"];
        let lookahead = tokenIdx + 1;
        while (lookahead < tokens.length) {
          const next = tokens[lookahead];
          if (next.type === "comment") {
            lookahead++;
            continue;
          }
          if (next.type === "text" && next.value.trim() === "") {
            lookahead++;
            continue;
          }
          break;
        }
        const next = tokens[lookahead];
        const alreadyHasTitle =
          next &&
          next.type === "open" &&
          next.tag === "p" &&
          "data-callout-title" in next.attrs;
        if (!alreadyHasTitle) {
          const titleClasses: string[] = [];
          if (classMap?.calloutTitle) titleClasses.push(classMap.calloutTitle);
          const titleVariantCls = variantClass(
            classMap,
            "calloutTitle",
            token.attrs["data-variant"],
          );
          if (titleVariantCls) titleClasses.push(titleVariantCls);
          const titleClassAttr = titleClasses.length
            ? ` class="${escapeAttr(titleClasses.join(" "))}"`
            : "";
          out.push(
            `<p data-callout-title="true"${titleClassAttr}>${escapeHtml(title)}</p>`,
          );
        }
      }
      continue;
    }

    if (token.type === "close") {
      if (
        skipStack.length > 0 &&
        skipStack[skipStack.length - 1].tag === token.tag
      ) {
        skipStack.pop();
        continue;
      }
      if (!allowlist.includes(token.tag)) continue;
      const idx = openStack.lastIndexOf(token.tag);
      if (idx === -1) continue;
      while (openStack.length > idx + 1) {
        const orphan = openStack.pop() as string;
        out.push(`</${orphan}>`);
      }
      openStack.pop();
      out.push(`</${token.tag}>`);
      if (token.tag === "table" && tableWrapperStack.pop()) {
        out.push(`</div>`);
      }
    }
  }

  while (openStack.length > 0) {
    const tag = openStack.pop() as string;
    out.push(`</${tag}>`);
    if (tag === "table" && tableWrapperStack.pop()) {
      out.push(`</div>`);
    }
  }

  return out.join("");
}
