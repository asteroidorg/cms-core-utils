// src/server/articleMetadata.test.ts
import { describe, expect, it } from "vitest";
import { seoValuesToMetadata } from "./articleMetadata";

describe("seoValuesToMetadata", () => {
  it("maps seo values to Next Metadata with the given og type", () => {
    const meta = seoValuesToMetadata(
      {
        title: "T",
        siteName: "S",
        twitter: "@s",
        description: "D",
        url: "https://x/y",
        keywords: "k",
        image: "https://x/img.png",
      },
      "article",
    );
    expect(meta.title).toBe("T");
    expect(meta.alternates?.canonical).toBe("https://x/y");
    expect((meta.openGraph as { type?: string })?.type).toBe("article");
    expect(meta.robots).toEqual({ index: true, follow: true });
  });
  it("sets noindex robots when flagged", () => {
    const meta = seoValuesToMetadata(
      { title: "T", siteName: "S", twitter: "", description: "D", url: "u", keywords: "k", noindex: true },
      "website",
    );
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});
