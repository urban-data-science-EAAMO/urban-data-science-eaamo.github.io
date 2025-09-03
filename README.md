[![Deploy to GitHub Pages](https://github.com/mattwfranchi/mattwfranchi.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/mattwfranchi/mattwfranchi.github.io/actions/workflows/deploy.yml)

## Contributing: Add Members and Reading List Items

This site supports two easy contribution paths using GitHub Issues. When you open an issue with the appropriate template, a GitHub Action will turn it into a content file and open a pull request for review.

### Add a Member Card

1. Open a new issue and choose “Member: Add person”.
2. Fill in the form fields:
   - Full name (required)
   - Role (optional)
   - Affiliation (optional)
   - Image URL (optional; you can also attach an image via PR later)
   - Website (optional)
   - Order (optional; lower numbers show earlier)
   - Tags (optional)
3. Submit the issue.

What happens next:
- The workflow `.github/workflows/issue-add-member.yml` parses the issue.
- It creates a new file at `src/content/members/<slug>.md` and, if the image is a URL, downloads it to `src/assets/members/`.
- It opens a PR titled `[Member] Add: <Name>` for CODEOWNERS to review.
- Duplicate slugs are detected and the workflow will comment and stop.

Manual (advanced):
- You can also add a file directly under `src/content/members/your-name.md` with this frontmatter:

```yaml
---
name: "Jane Doe"
role: "Organizer"
affiliation: "University / Org"
image: "../../assets/members/jane-doe.jpg" # or full URL
website: "https://example.com"
order: 100
tags: ["member"]
---
```

### Add an Item to the Reading List

Preferred path is DOI-first via issue:
1. Open a new issue and choose “Reading List: Add paper”.
2. Provide the DOI (required) and any optional overrides (title, authors, venue, year, URL).
3. Submit the issue.

What happens next:
- The workflow `.github/workflows/issue-to-content.yml` resolves the DOI via Crossref.
- It will comment and fail if the DOI can’t be resolved.
- It creates a new file at `src/content/publications/<doi-slug>.md` with metadata (from your inputs or Crossref).
- It opens a PR titled `Add reading list entry: #<issue-number>` for CODEOWNERS to review.
- Duplicate DOIs are detected; the workflow will comment and stop.

Manual (advanced):
- You can add a file directly under `src/content/publications/*.md` with at least a DOI:

```yaml
---
doi: 10.1145/3640792.3675740
# Optional overrides
title: "Paper Title"
authors: ["First Last", "Second Last"]
venue: "Conference / Journal"
year: 2024
url: "https://doi.org/10.1145/3640792.3675740"
tags: ["publication"]
---
```

Rendering details:
- The Reading List page is at `/publications` and DOIs are resolved at build-time.
- A compact Reading List panel appears on the home page’s right column.

### Review and Merge

All auto-generated PRs require review from CODEOWNERS:

```
.github/CODEOWNERS
* @mattwfranchi @gsagostini
```

### Local Development

```bash
pnpm install
pnpm dev
```

### Notes
- Image optimization: member photos can be external URLs or committed to `src/assets/members/`.
- Security: workflows are gated to run only on this repository and include duplicate checks.