import { describe, expect, it } from "vitest";
import { guideArticle, guideBreadcrumb, siteIdentity } from "./seo";

describe("structured data identity linkage", () => {
  it("resolves article site and publisher references to declared identities", () => {
    const site = JSON.parse(siteIdentity().children);
    const article = JSON.parse(guideArticle("Example", "Description", "https://basira-data-viewer.lovable.app/guide/csv-vs-excel").children);
    const identities = site["@graph"].map((entity: { "@id": string }) => entity["@id"]);
    expect(identities).toContain(article.isPartOf["@id"]);
    expect(identities).toContain(article.publisher["@id"]);
    expect(article.author["@id"]).toBe(article.publisher["@id"]);
    expect(article.mainEntityOfPage["@id"]).toBe(article.url);
  });

  it("keeps breadcrumb destinations ordered from home through the library to the article", () => {
    const url = "https://basira-data-viewer.lovable.app/guide/remove-duplicates";
    const breadcrumb = JSON.parse(guideBreadcrumb("Example", url).children);
    expect(breadcrumb.itemListElement.map((item: { position: number }) => item.position)).toEqual([1, 2, 3]);
    expect(breadcrumb.itemListElement.map((item: { item: string }) => item.item)).toEqual([
      "https://basira-data-viewer.lovable.app/",
      "https://basira-data-viewer.lovable.app/guide",
      url,
    ]);
  });
});