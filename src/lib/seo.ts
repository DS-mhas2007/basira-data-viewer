const SITE_URL = "https://basira-data-viewer.lovable.app";

/** Shared identities connect the site, publisher, application, and guides. */
export function siteIdentity() {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "بصيرة",
          alternateName: "Basira",
          url: `${SITE_URL}/`,
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "بصيرة",
          alternateName: "Basira",
          url: `${SITE_URL}/`,
          inLanguage: "ar",
          publisher: { "@id": `${SITE_URL}/#organization` },
        },
      ],
    }),
  };
}

export function guideArticle(title: string, description: string, url: string) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      headline: title,
      description,
      url,
      inLanguage: "ar",
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      isPartOf: { "@id": `${SITE_URL}/#website` },
      author: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "بصيرة" },
      publisher: { "@id": `${SITE_URL}/#organization` },
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