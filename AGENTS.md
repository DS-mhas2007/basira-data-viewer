<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep page titles, descriptions, and self-referencing canonicals in leaf route heads; shared root metadata must remain sitewide to prevent conflicting search identities.
- Reuse the browser-safe SEO helper for guide breadcrumbs and derive the guide-directory structured list from the visible guide catalog so navigation and search metadata stay aligned.
- Keep shared site and publisher identities and guide Article schema in the browser-safe SEO helper; preserve specific HowTo schema alongside Article to avoid divergent publisher metadata.
