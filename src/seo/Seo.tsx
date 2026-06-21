"use client";

import { useEffect } from "react";
import type { SeoClientProps } from "./seo.config";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
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
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
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
}: SeoClientProps) {
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setCanonical(url);

    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    if (siteName) setMeta("property", "og:site_name", siteName);
    if (keywords) setMeta("name", "keywords", keywords);

    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    if (twitter) setMeta("name", "twitter:site", twitter);

    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }
  }, [title, description, url, siteName, keywords, twitter, image]);

  return null;
}
