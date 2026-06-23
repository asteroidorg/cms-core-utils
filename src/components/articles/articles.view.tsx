// src/components/articles/articles.view.tsx
import { Fragment, type ReactNode } from "react";
import type {
  ArticleImageResolver,
  ArticlesViewState,
  AsteroidArticleCategoryGroup,
  AsteroidArticlePost,
  AsteroidArticlesCategoryGroupParams,
  AsteroidArticlesCategoryHeadingParams,
  AsteroidArticlesContentParams,
  AsteroidArticlesEmptyParams,
  AsteroidArticlesFeaturedCardParams,
  AsteroidArticlesHeaderParams,
  AsteroidArticlesPostCardParams,
  AsteroidArticlesPostGridParams,
} from "./articles.types";

export interface ArticlesListingRenderProps<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  renderRoot?: (params: { children: ReactNode }) => ReactNode;
  renderHeader?: (params: AsteroidArticlesHeaderParams) => ReactNode;
  renderFeaturedCard?: (params: AsteroidArticlesFeaturedCardParams<TPost>) => ReactNode;
  renderPostCard: (params: AsteroidArticlesPostCardParams<TPost>) => ReactNode;
  renderCategoryHeading?: (params: AsteroidArticlesCategoryHeadingParams<TPost>) => ReactNode;
  renderPostGrid?: (params: AsteroidArticlesPostGridParams<TPost>) => ReactNode;
  renderCategoryGroup?: (params: AsteroidArticlesCategoryGroupParams<TPost>) => ReactNode;
  renderSkeleton?: () => ReactNode;
  renderEmpty?: (params: AsteroidArticlesEmptyParams) => ReactNode;
  renderContent?: (params: AsteroidArticlesContentParams) => ReactNode;
}

export interface RenderArticlesListingArgs<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
> {
  state: ArticlesViewState<TPost>;
  loading: boolean;
  hasError: boolean;
  error: unknown;
  cmsImage: ArticleImageResolver;
  searchNode: ReactNode;
  seoNode: ReactNode;
  jsonLdNode: ReactNode;
  renderProps: ArticlesListingRenderProps<TPost>;
}

export function renderArticlesListingBody<
  TPost extends AsteroidArticlePost = AsteroidArticlePost,
>(args: RenderArticlesListingArgs<TPost>): ReactNode {
  const { state, loading, hasError, error, cmsImage, searchNode, seoNode, jsonLdNode, renderProps } = args;
  const {
    eyebrow,
    title,
    description,
    renderRoot,
    renderHeader,
    renderFeaturedCard,
    renderPostCard,
    renderCategoryHeading,
    renderPostGrid,
    renderCategoryGroup,
    renderSkeleton,
    renderEmpty,
    renderContent,
  } = renderProps;

  const headerNode = renderHeader
    ? renderHeader({ eyebrow, title, description, search: searchNode })
    : (
        <>
          {eyebrow}
          {title}
          {description}
          {searchNode}
        </>
      );

  const featuredNode =
    state.featured && !state.isSearching && renderFeaturedCard
      ? renderFeaturedCard({ post: state.featured, cmsImage })
      : null;

  const noSearchResultsNode =
    state.isSearching && !loading && state.posts.length === 0
      ? renderEmpty?.({ reason: "no-results", searchQuery: state.searchQuery }) ?? null
      : null;

  const groupsNode = noSearchResultsNode
    ? null
    : state.categoryGroups.map((group: AsteroidArticleCategoryGroup<TPost>) => {
        const postCards = group.posts.map((post, index) => (
          <Fragment key={post.slug ?? index}>
            {renderPostCard({ post, index, group, cmsImage })}
          </Fragment>
        ));

        const gridNode = renderPostGrid
          ? renderPostGrid({ posts: group.posts, group, children: postCards })
          : <>{postCards}</>;

        const headingNode = renderCategoryHeading
          ? renderCategoryHeading({ group })
          : group.categoryName;

        const defaultContent = (
          <>
            {headingNode}
            {gridNode}
          </>
        );

        return (
          <Fragment key={group.categorySlug}>
            {renderCategoryGroup ? renderCategoryGroup({ group, defaultContent }) : defaultContent}
          </Fragment>
        );
      });

  const contentNode =
    !loading && !hasError && (state.featured || state.rest.length > 0)
      ? renderContent
        ? renderContent({ featured: featuredNode, groups: groupsNode, noSearchResults: noSearchResultsNode })
        : (
            <>
              {featuredNode}
              {noSearchResultsNode}
              {groupsNode}
            </>
          )
      : null;

  const body = (
    <>
      {seoNode}
      {jsonLdNode}
      {headerNode}
      {loading ? renderSkeleton?.() : null}
      {!loading && (hasError || state.isEmpty)
        ? renderEmpty?.({
            reason: hasError ? "error" : state.isSearching ? "no-results" : "no-posts",
            searchQuery: state.searchQuery,
            error,
          })
        : null}
      {contentNode}
    </>
  );

  return renderRoot ? renderRoot({ children: body }) : <>{body}</>;
}
