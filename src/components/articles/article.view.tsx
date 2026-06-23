// src/components/articles/article.view.tsx
import type { ReactNode } from "react";
import type { ArticleImageResolver } from "./articles.types";

export interface AsteroidArticlePagePost {
  slug: string;
  title: string;
  description?: string;
  content?: string;
  featured_image?: string;
  tags?: string;
  published_date?: string | null;
  category?: { slug: string; name: string };
  author?: { name: string; bio?: string };
}

type Slot<TPost> = (params: { post: TPost; cmsImage: ArticleImageResolver }) => ReactNode;

export interface ArticleBodyRenderProps<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  backLink?: ReactNode;
  renderHeader?: Slot<TPost>;
  renderMeta?: Slot<TPost>;
  renderDescription?: Slot<TPost>;
  renderFeaturedImage?: Slot<TPost>;
  renderToc?: Slot<TPost>;
  renderContent?: Slot<TPost>;
  renderPreArticle?: Slot<TPost>;
  renderMidArticle?: Slot<TPost>;
  renderPostArticle?: Slot<TPost>;
  renderTags?: Slot<TPost>;
  renderAuthorDetails?: Slot<TPost>;
  renderRelatedPosts?: (params: {
    post: TPost;
    relatedPosts: TPost[];
    cmsImage: ArticleImageResolver;
  }) => ReactNode;
  renderCTA?: Slot<TPost>;
}

export interface RenderArticleBodyArgs<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
> {
  post: TPost;
  cmsImage: ArticleImageResolver;
  relatedPosts: TPost[];
  seoNode: ReactNode;
  jsonLdNode: ReactNode;
  renderProps: ArticleBodyRenderProps<TPost>;
}

export function renderArticleBody<
  TPost extends AsteroidArticlePagePost = AsteroidArticlePagePost,
>(args: RenderArticleBodyArgs<TPost>): ReactNode {
  const { post, cmsImage, relatedPosts, seoNode, jsonLdNode, renderProps: r } = args;
  const slot = { post, cmsImage };

  return (
    <>
      {seoNode}
      {jsonLdNode}
      {r.backLink}
      {r.renderPreArticle?.(slot)}
      {r.renderHeader?.(slot)}
      {r.renderMeta?.(slot)}
      {r.renderDescription?.(slot)}
      {r.renderFeaturedImage?.(slot)}
      {r.renderToc?.(slot)}
      {r.renderContent?.(slot)}
      {r.renderMidArticle?.(slot)}
      {r.renderTags?.(slot)}
      {r.renderAuthorDetails?.(slot)}
      {r.renderRelatedPosts?.({ post, relatedPosts, cmsImage })}
      {r.renderCTA?.(slot)}
      {r.renderPostArticle?.(slot)}
    </>
  );
}
