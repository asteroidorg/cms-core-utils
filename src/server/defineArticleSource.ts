// src/server/defineArticleSource.ts
import { fetchCmsContent } from "../fetchCmsContent";
import type {
  CmsSearchCondition,
  ContentStatus,
  UseCmsContentOptions,
} from "../build-query";
import type { AsteroidSeoConfig } from "../seo/seo.config";
import type { ArticleJsonLdType } from "../seo/jsonld";
import type { AsteroidArticlePost } from "../components/articles/articles.types";
import type { AsteroidArticlePagePost } from "../components/articles/article.view";
import type { CmsServerClient } from "./cmsServerClient";

type Select = NonNullable<UseCmsContentOptions["select"]>;

export interface ArticleSourceConfig<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  client: CmsServerClient;
  schemaSlug: string;
  listSelect: Select;
  detailSelect: Select;
  seo: AsteroidSeoConfig;
  searchFields?: string[];
  status?: ContentStatus;
  articleType?: ArticleJsonLdType;
  relatedLimit?: number;
  groupPostsByCategory?: (posts: TPost[]) => unknown;
}

export interface ArticleSource<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  client: CmsServerClient;
  schemaSlug: string;
  listSelect: Select;
  detailSelect: Select;
  seo: AsteroidSeoConfig;
  searchFields: string[];
  status: ContentStatus;
  articleType: ArticleJsonLdType;
  relatedLimit: number;
  groupPostsByCategory?: (posts: TPost[]) => unknown;
}

export function buildSearchConditions(
  fields: string[],
  query?: string,
): CmsSearchCondition[] | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return fields.map((field) => ({ field, value: trimmed, mode: "i" }));
}

export function defineArticleSource<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(config: ArticleSourceConfig<TPost, TDetail>): ArticleSource<TPost, TDetail> {
  return Object.freeze({
    client: config.client,
    schemaSlug: config.schemaSlug,
    listSelect: config.listSelect,
    detailSelect: config.detailSelect,
    seo: config.seo.cmsUrl ? config.seo : { ...config.seo, cmsUrl: config.client.cmsUrl },
    searchFields: config.searchFields ?? ["title", "description"],
    status: config.status ?? "PUBLISHED",
    articleType: config.articleType ?? "Article",
    relatedLimit: config.relatedLimit ?? 3,
    groupPostsByCategory: config.groupPostsByCategory,
  });
}

export async function fetchArticles<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(
  source: ArticleSource<TPost>,
  opts: { searchQuery?: string; categorySlug?: string; limit?: number } = {},
): Promise<TPost[]> {
  const search = buildSearchConditions(source.searchFields, opts.searchQuery);
  const data = await fetchCmsContent<TPost[]>(source.client.getClient, {
    schema_slug: source.schemaSlug,
    select: source.listSelect,
    status: source.status,
    ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
    ...(opts.categorySlug ? { filter: { category: opts.categorySlug } } : {}),
    ...(search ? { search } : {}),
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchArticle<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(source: ArticleSource<AsteroidArticlePost, TDetail>, slug: string): Promise<TDetail | null> {
  try {
    const data = await fetchCmsContent<TDetail>(source.client.getClient, {
      schema_slug: source.schemaSlug,
      entrySlug: slug,
      select: source.detailSelect,
      status: source.status,
    });
    return data ?? null;
  } catch {
    return null;
  }
}

export async function fetchRelatedArticles<
  TDetail extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(
  source: ArticleSource<AsteroidArticlePost, TDetail>,
  post: TDetail,
  slug: string,
): Promise<TDetail[]> {
  const categorySlug = post.category?.slug?.trim();
  if (!categorySlug || source.relatedLimit <= 0) return [];
  const data = await fetchCmsContent<TDetail[]>(source.client.getClient, {
    schema_slug: source.schemaSlug,
    select: source.listSelect,
    status: source.status,
    limit: source.relatedLimit + 1,
    filter: { category: categorySlug },
  });
  return (Array.isArray(data) ? data : [])
    .filter((p) => p.slug !== slug)
    .slice(0, source.relatedLimit);
}
