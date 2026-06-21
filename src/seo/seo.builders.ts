// Pure builders that turn CMS posts + config into SEO values. Server-safe.

import { cmsImage } from "../utils/cmsImage";
import type {
  AsteroidOgImageParams,
  AsteroidPageSeoOptions,
  AsteroidSeoConfig,
  ISeoValues,
  SeoClientProps,
} from "./seo.config";

/** Apply the configured title template, defaulting to `${title} | ${siteName}`. */
export function applyTitleTemplate(
  config: AsteroidSeoConfig,
  title: string,
): string {
  return config.titleTemplate
    ? config.titleTemplate(title)
    : `${title} | ${config.siteName}`;
}

export function buildOgImageUrl(
  config: AsteroidSeoConfig,
  params: AsteroidOgImageParams,
): string | undefined {
  if (config.getOgImageUrl) {
    return config.getOgImageUrl(params);
  }

  const palette = config.ogImage?.palette;
  if (!palette) return undefined;

  const apiPath = config.ogImage?.apiPath ?? "/api/og";
  const base = config.baseUrl.replace(/\/$/, "");
  const searchParams = new URLSearchParams({
    title: params.title,
    type: params.type ?? "article",
    siteName: config.siteName,
    bg: palette.background,
    fg: palette.foreground,
    accent: palette.accent,
  });

  if (params.subtitle?.trim()) searchParams.set("subtitle", params.subtitle.trim());
  if (params.eyebrow?.trim()) searchParams.set("eyebrow", params.eyebrow.trim());
  if (palette.accentMuted) searchParams.set("accentMuted", palette.accentMuted);
  if (palette.mutedText) searchParams.set("muted", palette.mutedText);

  return `${base}${apiPath}?${searchParams.toString()}`;
}

type ArticleLike = {
  title: string;
  description?: string;
  meta_description?: string;
  featured_image?: string;
};

/**
 * Generic per-page SEO builder. Use it directly for landing/marketing pages, or
 * as the base for the article/listing wrappers below. Content-type agnostic.
 */
export function buildPageSeoValues(
  config: AsteroidSeoConfig,
  options: AsteroidPageSeoOptions,
): ISeoValues {
  const base = config.baseUrl.replace(/\/$/, "");
  const path = options.path ?? "/";
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const description =
    options.description?.trim() ||
    config.defaultDescription ||
    `${options.title} - ${config.siteName}.`;

  return {
    title: applyTitleTemplate(config, options.title),
    siteName: config.siteName,
    twitter: config.twitter ?? "",
    description,
    url,
    keywords: options.keywords ?? config.defaultKeywords ?? options.title,
    image:
      options.image ??
      buildOgImageUrl(config, {
        title: options.title,
        subtitle: description,
        eyebrow: options.eyebrow,
        type: options.ogType === "article" ? "article" : "listing",
      }),
    noindex: options.noindex ?? config.noindex,
    manifestUrl: config.manifestUrl,
  };
}

function resolveArticleImage<TPost extends ArticleLike>(
  post: TPost,
  config: AsteroidSeoConfig,
): string | undefined {
  // cmsUrl is required to resolve a real featured image. Without it we fall
  // back to the generated OG image rather than throwing; server builders must
  // never crash a render.
  const featuredImage = config.cmsUrl
    ? cmsImage(post.featured_image, { cmsUrl: config.cmsUrl })
    : "";

  if (featuredImage) return featuredImage;

  const description =
    post.meta_description?.trim() ||
    post.description?.trim() ||
    config.defaultDescription;

  return buildOgImageUrl(config, {
    title: post.title,
    subtitle: description,
    eyebrow: config.contentLabel ?? "Article",
    type: "article",
  });
}

/** SEO for a single article; works for news, articles, or docs pages. */
export function buildArticleSeoValues<TPost extends ArticleLike>(
  post: TPost,
  config: AsteroidSeoConfig,
  slug: string,
  options?: { noindex?: boolean },
): ISeoValues {
  const articlePath = config.articlePath ?? "/blog";
  const url = `${config.baseUrl.replace(/\/$/, "")}${articlePath}/${slug}`;
  const description =
    post.meta_description?.trim() ||
    post.description?.trim() ||
    config.defaultDescription ||
    `Read the latest from ${config.siteName}.`;

  return {
    title: applyTitleTemplate(config, post.title),
    siteName: config.siteName,
    twitter: config.twitter ?? "",
    description,
    url,
    keywords: config.defaultKeywords ?? post.title,
    image: resolveArticleImage(post, config),
    noindex: options?.noindex ?? config.noindex,
    manifestUrl: config.manifestUrl,
  };
}

/** SEO for an article collection / category listing (any content type). */
export function buildArticleListingSeoValues(
  config: AsteroidSeoConfig,
  options?: { categoryName?: string; categorySlug?: string; noindex?: boolean },
): ISeoValues {
  const articlePath = config.articlePath ?? "/blog";
  const base = config.baseUrl.replace(/\/$/, "");
  const label = config.contentLabel ?? "Articles";
  const categoryName = options?.categoryName?.trim();
  const categorySlug = options?.categorySlug?.trim();

  const titleText = categoryName ? `${categoryName} ${label}` : label;

  const description = categoryName
    ? `Explore ${categoryName} ${label.toLowerCase()}, guides, and the latest updates from ${config.siteName}.`
    : config.defaultDescription ||
      `Browse ${label.toLowerCase()}, insights, and the latest updates from ${config.siteName}.`;

  const url = categorySlug
    ? `${base}${articlePath}/category/${categorySlug}`
    : `${base}${articlePath}`;

  return {
    title: applyTitleTemplate(config, titleText),
    siteName: config.siteName,
    twitter: config.twitter ?? "",
    description,
    url,
    keywords:
      config.defaultKeywords ??
      (categoryName
        ? `${categoryName}, ${config.siteName}`
        : `${config.siteName} ${label.toLowerCase()}`),
    image: buildOgImageUrl(config, {
      title: titleText,
      subtitle: description,
      eyebrow: categoryName ? "Category" : label,
      type: "listing",
    }),
    noindex: options?.noindex ?? config.noindex,
    manifestUrl: config.manifestUrl,
  };
}

export function seoValuesToClientProps(values: ISeoValues): SeoClientProps {
  return {
    title: values.title,
    description: values.description,
    url: values.url,
    siteName: values.siteName,
    keywords: values.keywords,
    twitter: values.twitter,
    image: values.image,
    noindex: values.noindex,
  };
}
