# Urban Data & Equitable Cities

An Astro website that builds to static HTML for GitHub Pages. Content lives in Markdown files; the original two-column layout, cards, maps, and styling are retained.

## Where to edit

| To change… | Edit |
| --- | --- |
| Homepage heading and introductory text | `src/content/home/intro.md` |
| Number of recent talks/papers on the homepage | `recentTalksLimit` / `readingLimit` in that same file |
| Speakers and activities | `src/content/speakers/*.md` |
| Reading list | `src/content/publications/*.md` |
| Members / organizer cards | `src/content/members/*.md` |
| Mailing-list link and subscription guidance | `src/pages/join/index.astro` |
| Navigation | `src/components/Header.astro` |
| Site title and description for search/social sharing | `src/config.ts` |
| Appearance | `src/styles/base.css` |

The block between `---` lines at the top of a content file is YAML. Keep its indentation; quote text containing colons. For the intro, everything below the second `---` is Markdown: **bold**, *italic*, and `[link text](https://example.com)` work.

## Preview locally

Install Node 22 and pnpm 9.15.9 once (with Node installed, `corepack enable` and `corepack prepare pnpm@9.15.9 --activate`). Then:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:4321`. Saved edits automatically refresh the preview.

To inspect the actual generated HTML:

```bash
pnpm build
python3 scripts/preview.py
```

Or use `pnpm inspect` to build and start that server together. On a remote machine, forward port 4321 in VS Code's Ports panel. The preview server listens only on localhost.

The generated homepage is `dist/index.html`; other pages have their own `index.html` directories. Serve `dist/` over HTTP to load the site's absolute asset paths and interactive cards correctly. After building, previewing only needs Python, not Node. You can also run `pnpm preview`.

## Speakers and activities

Copy an existing file into `src/content/speakers/`, preferably named `YYYY-MM-DD.md`, and edit its frontmatter:

```yaml
---
name: "Speaker name or activity host"
affiliation: "University or organization"
eventDate: 2026-11-02
talkTitle: "Talk or activity title"
abstract: |
  Describe the talk here. Multiple lines are fine.
tags: ["urban planning", "equity"]
website: "https://example.com/"
# Optional: zoomLink, slidesUrl, recordingUrl, blogPostUrl
papers:
  - title: "Related paper"
    url: "https://doi.org/10.1234/example"
---
```

Required fields are `name`, `eventDate`, and `talkTitle`. Delete optional fields you do not need. Up to three related papers are supported. Activities use the same cards as talks. The homepage separates upcoming and past events at build time and shows the most recent past events first. Rebuild after an event passes to update its placement; the All Talks page lists every event. Edit `abstract:` for the card text (the Markdown body below the frontmatter is not displayed on these cards).

## Reading list

Copy a file into `src/content/publications/` and edit:

```yaml
---
doi: "10.1234/example"
title: "Paper title"
authors: ["First Author", "Second Author"]
year: 2026
venue: "Journal or conference"
tags: ["publication"]
# Optional URL override; otherwise links to https://doi.org/<doi>.
# url: "https://example.com/paper"
---
```

Only `doi` is required, but provide the title/year/venue/authors to display useful details. Build-time metadata fetching has been removed: the values you edit are the values displayed, and builds work without Crossref. The homepage, `/publications/`, and the older `/reading/` URL all use these files. Papers sort by newest year first; optional `order` breaks ties (larger values first).

## Members

Copy a file into `src/content/members/` and edit:

```yaml
---
name: "Person name"
affiliation: "University or organization"
website: "https://example.com/"
image: "https://example.com/photo.jpg"
order: 2
tags: ["organizer"]
---
```

Only `name` is required. Lower `order` values appear first. Without `website`, the card has no link; without `image`, it shows a placeholder. For a local image, put it in `src/assets/members/` and use `image: "../../assets/members/person.jpg"`. The optional `role` field is stored but is not currently shown on cards.

## Repository structure

- `src/content/`: editable content and `config.ts` field validation.
- `src/pages/`: routes and page layouts.
- `src/components/`: reusable cards, header, footer, and map grid.
- `src/utils/readingList.ts`: shared reading-list ordering and DOI links.
- `src/styles/`: existing design.
- `public/`, `30DoM-2025/`: static assets and map materials.
- `scripts/preview.py`: serves generated HTML for review.
- `.github/workflows/deploy.yml`: reproducible build and main-only deployment.

Other inherited template code and collections remain available; content editing does not require changing them. Issue-based content automation is experimental; editing Markdown directly is the supported path.

## Branch review and deployment

Work on `chore/content-and-deploy-cleanup` to review these changes. The workflow builds that branch and pull requests targeting `main`, uploading a downloadable `website-html` artifact. Extract it and serve the folder containing `index.html` with `python3 -m http.server 4321`.

Only a push to `main` (or a manual workflow run on `main`) deploys the live site. A branch preview never deploys to GitHub Pages.

The October 5, 2026 failure was an install error: `withastro/action@v2` replaced pnpm 8 with `pnpm@latest` (12.9.1), which refused the esbuild/sharp install scripts with `ERR_PNPM_IGNORED_BUILDS`. The workflow now uses the pinned `packageManager` in `package.json`, Node from `.nvmrc`, and explicit install/build/upload steps. `pnpm-lock.yaml` is the single dependency lockfile; use pnpm when updating dependencies.
