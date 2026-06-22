// src/components/articles/articles.view.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderArticlesListingBody } from "./articles.view";
import { buildArticlesViewState } from "./articles.state";
import type { AsteroidArticlePost } from "./articles.types";

const posts: AsteroidArticlePost[] = [
  { slug: "a", title: "Alpha", featured: true, category: { slug: "news", name: "News" } },
  { slug: "b", title: "Beta", category: { slug: "news", name: "News" } },
];

function render(loading = false, hasError = false) {
  const state = buildArticlesViewState(posts, {});
  return renderToStaticMarkup(
    <>{renderArticlesListingBody({
      state,
      loading,
      hasError,
      error: undefined,
      cmsImage: (x) => x ?? "",
      searchNode: null,
      seoNode: null,
      jsonLdNode: null,
      renderProps: {
        renderPostCard: ({ post }) => <article>{post.title}</article>,
        renderFeaturedCard: ({ post }) => <h2>{post.title}</h2>,
        renderSkeleton: () => <div data-testid="skeleton" />,
      },
    })}</>,
  );
}

describe("renderArticlesListingBody", () => {
  it("renders featured + post cards when loaded", () => {
    const html = render();
    expect(html).toContain("<h2>Alpha</h2>");
    expect(html).toContain("<article>Beta</article>");
  });
  it("renders the skeleton while loading", () => {
    expect(render(true)).toContain("data-testid=\"skeleton\"");
  });
});
