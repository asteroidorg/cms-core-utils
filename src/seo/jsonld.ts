// Pure schema.org JSON-LD builders. Server-safe. No hardcoded site identity.

import type { AsteroidSeoConfig } from "./seo.config";

/** Build the site-wide Organization + WebSite @graph from config. */
export function buildSiteJsonLd(config: AsteroidSeoConfig): object {
  const siteUrl = config.baseUrl.replace(/\/$/, "");
  const org = config.organization;

  const organizationNode: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: config.siteName,
    legalName: config.siteName,
    url: siteUrl,
  };
  if (org?.logoUrl) {
    organizationNode.logo = { "@type": "ImageObject", url: org.logoUrl };
  }
  if (org?.contactPhone || org?.contactEmail) {
    organizationNode.contactPoint = {
      "@type": "ContactPoint",
      ...(org.contactPhone ? { telephone: org.contactPhone } : {}),
      ...(org.contactEmail ? { email: org.contactEmail } : {}),
      contactType: "customer service",
    };
  }
  if (org?.address) {
    organizationNode.address = {
      "@type": "PostalAddress",
      ...(org.address.street ? { streetAddress: org.address.street } : {}),
      ...(org.address.city ? { addressLocality: org.address.city } : {}),
      ...(org.address.country ? { addressCountry: org.address.country } : {}),
    };
  }
  if (org?.socials?.length) {
    organizationNode.sameAs = org.socials;
  }

  const websiteNode: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: config.siteName,
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en-US",
  };
  if (config.defaultDescription) {
    websiteNode.description = config.defaultDescription;
  }

  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode, websiteNode, ...(config.extraJsonLdNodes ?? [])],
  };
}

/** schema.org Article subtypes; pick per content kind. */
export type ArticleJsonLdType =
  | "Article"
  | "BlogPosting"
  | "NewsArticle"
  | "TechArticle"
  | (string & {});

export type ArticleJsonLdProps = {
  title: string;
  description: string;
  url: string;
  /** Site name; used as the author fallback. */
  siteName: string;
  /** Normalized base URL (no trailing slash); used to reference the org/website @ids. */
  siteUrl: string;
  /** schema.org @type. Default: `"Article"`. */
  articleType?: ArticleJsonLdType;
  image?: string;
  authorName?: string;
  publishedTime?: string;
  tags?: string[];
  category?: string;
};

export function buildArticleJsonLd(props: ArticleJsonLdProps): object {
  return {
    "@context": "https://schema.org",
    "@type": props.articleType ?? "Article",
    headline: props.title,
    description: props.description,
    url: props.url,
    ...(props.image ? { image: props.image } : {}),
    ...(props.publishedTime ? { datePublished: props.publishedTime } : {}),
    ...(props.category ? { articleSection: props.category } : {}),
    ...(props.tags && props.tags.length > 0
      ? { keywords: props.tags.join(", ") }
      : {}),
    author: { "@type": "Person", name: props.authorName || props.siteName },
    publisher: { "@id": `${props.siteUrl}/#organization` },
    isPartOf: { "@id": `${props.siteUrl}/#website` },
    inLanguage: "en-US",
  };
}

export type CollectionJsonLdProps = {
  name: string;
  description: string;
  url: string;
  /** Normalized base URL (no trailing slash); used to reference the org/website @ids. */
  siteUrl: string;
};

export function buildCollectionJsonLd(props: CollectionJsonLdProps): object {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: props.name,
    description: props.description,
    url: props.url,
    isPartOf: { "@id": `${props.siteUrl}/#website` },
    publisher: { "@id": `${props.siteUrl}/#organization` },
    inLanguage: "en-US",
  };
}

export type WebPageJsonLdProps = {
  name: string;
  description: string;
  url: string;
  /** Normalized base URL (no trailing slash); used to reference the org/website @ids. */
  siteUrl: string;
};

/** Generic WebPage node for landing/marketing pages with no article concept. */
export function buildWebPageJsonLd(props: WebPageJsonLdProps): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: props.name,
    description: props.description,
    url: props.url,
    isPartOf: { "@id": `${props.siteUrl}/#website` },
    publisher: { "@id": `${props.siteUrl}/#organization` },
    inLanguage: "en-US",
  };
}
