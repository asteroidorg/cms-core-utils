// src/components/articles/article.view.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderArticleBody } from "./article.view";
import type { AsteroidArticlePagePost } from "./article.view";

const post: AsteroidArticlePagePost = { slug: "a", title: "Alpha", content: "<p>Body</p>" };

describe("renderArticleBody", () => {
  it("renders slots in order and passes relatedPosts", () => {
    const html = renderToStaticMarkup(
      <>{renderArticleBody({
        post,
        cmsImage: (x) => x ?? "",
        relatedPosts: [{ slug: "b", title: "Beta" }],
        seoNode: null,
        jsonLdNode: null,
        renderProps: {
          renderHeader: ({ post }) => <h1>{post.title}</h1>,
          renderContent: ({ post }) => <div dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />,
          renderRelatedPosts: ({ relatedPosts }) => <aside>{relatedPosts.map((p) => p.title).join(",")}</aside>,
        },
      })}</>,
    );
    expect(html).toContain("<h1>Alpha</h1>");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("<aside>Beta</aside>");
  });
});
