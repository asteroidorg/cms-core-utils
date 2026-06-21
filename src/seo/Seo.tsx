"use client";

import { useEffect } from "react";
import type { SeoClientProps } from "./seo.config";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!element) {
    if (!content) return;
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  } else if (!content) {
    element.remove();
    return;
  }
  element.setAttribute("content", content);
}

function setCanonical(url: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

/** Render a JSON-LD <script>. Pass a built graph via `data`; renders nothing if absent. */
export function JsonLd({ data }: { data?: object }) {
  if (!data) return null;
  const html = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Imperatively sets document title, meta description, canonical URL and social
 * tags. Works in plain React apps and Next.js client components. In a Next.js
 * App Router app, prefer server `generateMetadata` from the `/next` entry.
 */
export function Seo({
  title,
  description,
  url,
  siteName,
  keywords,
  twitter,
  image,
  noindex,
}: SeoClientProps) {
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setCanonical(url);

    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:site_name", siteName || "");
    setMeta("name", "keywords", keywords || "");
    setMeta("name", "robots", noindex ? "noindex" : "index");

    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:site", twitter || "");
    setMeta("property", "og:image", image || "");
    setMeta("name", "twitter:image", image || "");
  }, [title, description, url, siteName, keywords, twitter, image, noindex]);

  return null;
}
