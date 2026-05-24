/**
 * Heading extraction helpers used to build tables of contents (ToC) from
 * rich-text HTML. Server-safe — no React, no DOM dependency in the HTML
 * variant. The DOM variant assigns missing `id`s in-place so anchor links
 * resolve immediately.
 */

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface ExtractedHeading {
  id: string;
  text: string;
  level: HeadingLevel;
}

export interface ExtractHeadingsOptions {
  /** Levels to include. Defaults to `[2, 3]` — typical doc page outline. */
  levels?: ReadonlyArray<HeadingLevel>;
  /** Custom slug function. Defaults to a lowercase/kebab/diacritic-safe slug. */
  slugify?: (text: string, index: number) => string;
}

const DEFAULT_LEVELS: ReadonlyArray<HeadingLevel> = [2, 3];

export function slugify(text: string): string {
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

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s: string): string {
  return decodeBasicEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueId(base: string, used: Map<string, number>): string {
  const seed = base || "section";
  const n = used.get(seed) ?? 0;
  used.set(seed, n + 1);
  return n === 0 ? seed : `${seed}-${n}`;
}

/**
 * Parse headings out of a raw HTML string. Returns headings in document
 * order with stable, de-duplicated IDs.
 *
 * If a heading already has an `id` attribute, it's preserved verbatim
 * (and reserved so later slugs don't collide with it).
 */
export function extractHeadingsFromHtml(
  html: string,
  options: ExtractHeadingsOptions = {},
): ExtractedHeading[] {
  if (!html) return [];
  const levels = options.levels ?? DEFAULT_LEVELS;
  const slug = options.slugify ?? slugify;
  const used = new Map<string, number>();
  const out: ExtractedHeading[] = [];
  const re = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(html)) !== null) {
    const level = Number(m[1]) as HeadingLevel;
    if (!levels.includes(level)) continue;
    const attrs = m[2] ?? "";
    const inner = m[3] ?? "";
    const text = stripTags(inner);
    if (!text) continue;
    const explicitIdMatch = attrs.match(/\bid\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/i);
    let id: string;
    if (explicitIdMatch) {
      id = explicitIdMatch[2] ?? explicitIdMatch[3] ?? explicitIdMatch[4] ?? "";
      if (id) used.set(id, (used.get(id) ?? 0) + 1);
    } else {
      id = uniqueId(slug(text, i), used);
    }
    out.push({ id, text, level });
    i++;
  }
  return out;
}

/**
 * Walk a rendered DOM subtree, collect headings, and assign missing `id`s
 * in-place so anchor links resolve immediately. Also sets `scrollMarginTop`
 * on each heading when `scrollMarginTop` is provided so navigation lands
 * cleanly below a sticky header.
 */
export function extractHeadingsFromElement(
  root: HTMLElement,
  options: ExtractHeadingsOptions & { scrollMarginTop?: number } = {},
): ExtractedHeading[] {
  const levels = options.levels ?? DEFAULT_LEVELS;
  const slug = options.slugify ?? slugify;
  const selector = levels.map((l) => `h${l}`).join(",");
  const nodes = root.querySelectorAll<HTMLHeadingElement>(selector);
  const used = new Map<string, number>();
  // Reserve already-present IDs so generated ones don't collide.
  nodes.forEach((n) => {
    if (n.id) used.set(n.id, (used.get(n.id) ?? 0) + 1);
  });
  const out: ExtractedHeading[] = [];
  let i = 0;
  nodes.forEach((node) => {
    const level = Number(node.tagName.slice(1)) as HeadingLevel;
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (!node.id) {
      node.id = uniqueId(slug(text, i), used);
    }
    if (options.scrollMarginTop != null) {
      node.style.scrollMarginTop = `${options.scrollMarginTop}px`;
    }
    out.push({ id: node.id, text, level });
    i++;
  });
  return out;
}
