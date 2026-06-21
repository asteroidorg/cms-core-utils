// Pure types + config shape for the SEO surface. Server-safe (no React, no DOM).

export interface ISeoValues {
  title: string;
  siteName: string;
  twitter: string;
  description: string;
  url: string;
  keywords: string;
  image?: string;
}

export type SeoClientProps = {
  title: string;
  description: string;
  url: string;
  siteName?: string;
  keywords?: string;
  twitter?: string;
  image?: string;
};

/** Theme colors used when generating dynamic OG images. */
export interface AsteroidOgImagePalette {
  background: string;
  foreground: string;
  accent: string;
  accentMuted?: string;
  mutedText?: string;
}

export interface AsteroidOgImageParams {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  type?: "article" | "listing";
}

/** Options for the generic per-page SEO builder (landing pages, etc.). */
export interface AsteroidPageSeoOptions {
  /** Raw page title; the config `titleTemplate` (or the `| siteName` default) is applied. */
  title: string;
  description?: string;
  /** Path appended to `baseUrl`. Default: `/`. */
  path?: string;
  keywords?: string;
  /** Explicit social image URL. If absent, a generated OG image is used. */
  image?: string;
  /** Eyebrow label for the generated OG image. */
  eyebrow?: string;
  /** Open Graph object type. Default: `website`. */
  ogType?: "website" | "article";
}

/** Site-level identity used to build the Organization/WebSite JSON-LD graph. */
export interface AsteroidOrganizationConfig {
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: { street?: string; city?: string; country?: string };
  /** Generic list of profile URLs (LinkedIn, X, etc.). Maps to schema.org `sameAs`. */
  socials?: string[];
}

/** Site-level SEO config passed into the headless Asteroid content components. */
export interface AsteroidSeoConfig {
  siteName: string;
  baseUrl: string;
  twitter?: string;
  defaultDescription?: string;
  defaultKeywords?: string;
  /** Path prefix for the article collection (e.g. `/blog`, `/news`, `/docs`). Default: `/blog` */
  articlePath?: string;
  /**
   * Human label for the article collection, used in default titles/eyebrows
   * (e.g. "Blog", "News", "Documentation"). Default: `"Articles"`.
   */
  contentLabel?: string;
  /**
   * Override how a raw page/article title becomes the final `<title>`.
   * Default: `(title) => `${title} | ${siteName}``.
   */
  titleTemplate?: (title: string) => string;
  ogImage?: {
    palette: AsteroidOgImagePalette;
    /** OG image API route path. Default: `/api/og` */
    apiPath?: string;
  };
  /** Override dynamic OG image URL generation (e.g. custom CDN or renderer). */
  getOgImageUrl?: (params: AsteroidOgImageParams) => string | undefined;

  /** Site identity for the Organization/WebSite JSON-LD graph. */
  organization?: AsteroidOrganizationConfig;
  /** Extra schema.org @graph nodes (e.g. a ProfessionalService node). */
  extraJsonLdNodes?: object[];
  /** CMS base URL for resolving featured-image URLs. Required server-side for featured images. */
  cmsUrl?: string;
}
