const SITE_URL = "https://basira-data-viewer.lovable.app";

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