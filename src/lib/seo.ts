const SITE_URL = "https://basira-data-viewer.lovable.app";
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** Shared entity graph keeps publisher identity consistent across every route. */
export function siteIdentity() {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": ORGANIZATION_ID,
          name: "بصيرة",
          alternateName: "Basira",
          url: `${SITE_URL}/`,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/basira-logo.png` },
        },
        {
          "@type": "WebSite",
          "@id": WEBSITE_ID,
          name: "بصيرة",
          alternateName: "Basira",
          url: `${SITE_URL}/`,
          inLanguage: "ar",
          publisher: { "@id": ORGANIZATION_ID },
        },
      ],
    }),
  };
}

/** Structured data for an individual evergreen guide/article. */
export function guideArticle(title: string, description: string, url: string) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: title,
      description,
      url,
      inLanguage: "ar",
      articleSection: "أدلة بصيرة",
      isAccessibleForFree: true,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      isPartOf: { "@id": WEBSITE_ID },
      author: { "@type": "Organization", "@id": ORGANIZATION_ID, name: "بصيرة" },
      publisher: { "@id": ORGANIZATION_ID, name: "بصيرة" },
    }),
  };
}

/** Mirrors the visible home → guide library → article navigation. */
export function guideBreadcrumb(title: string, url: string) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "بصيرة", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "أدلة بصيرة", item: `${SITE_URL}/guide` },
        { "@type": "ListItem", position: 3, name: title, item: url },
      ],
    }),
  };
}
