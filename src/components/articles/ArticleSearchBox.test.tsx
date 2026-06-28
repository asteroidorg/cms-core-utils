import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleSearchBox } from "./ArticleSearchBox";

describe("ArticleSearchBox (framework-agnostic)", () => {
  it("renders a search input without requiring next/navigation", () => {
    const html = renderToStaticMarkup(<ArticleSearchBox placeholder="Find articles" />);
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="Find articles"');
  });

  it("honors a custom render prop", () => {
    const html = renderToStaticMarkup(
      <ArticleSearchBox render={({ value }) => <span>query:{value}</span>} />,
    );
    expect(html).toContain("query:");
  });
});
