export interface PublicationMeta {
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  url?: string;
  doi: string;
}

// Decode common HTML entities and numeric entities (decimal & hex)
function decodeHtmlEntities(input: string): string {
  if (!input) return input;
  const named = input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  const numericDecimal = named.replace(/&#(\d+);/g, (_m, dec) => {
    const codePoint = Number.parseInt(dec, 10);
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return _m;
    }
  });
  const numericHex = numericDecimal.replace(/&#x([\da-fA-F]+);/g, (_m, hex) => {
    const codePoint = Number.parseInt(hex, 16);
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return _m;
    }
  });
  return numericHex;
}

// Remove any HTML/JATS tags like <i>, <sup>, <jats:italic>, etc.
function stripHtmlTags(input: string): string {
  if (!input) return input;
  return input.replace(/<[^>]*>/g, "");
}

function normalizeWhitespace(input: string): string {
  if (!input) return input;
  return input.replace(/\s+/g, " ").trim();
}

function sanitizeText(input: string | undefined): string | undefined {
  if (!input) return input;
  // Decode first (e.g. &lt;sup&gt; -> <sup>), strip tags, decode again in case of nested, then normalize
  const decoded = decodeHtmlEntities(input);
  const noTags = stripHtmlTags(decoded);
  const decodedAgain = decodeHtmlEntities(noTags);
  return normalizeWhitespace(decodedAgain);
}

function formatAuthors(authorArr: any[] | undefined): string[] {
  if (!authorArr || !Array.isArray(authorArr)) return [];
  return authorArr
    .map((a) => {
      const given = a?.given ?? "";
      const family = a?.family ?? "";
      const name = [given, family].filter(Boolean).join(" ").trim();
      return sanitizeText(name) ?? name;
    })
    .filter(Boolean);
}

export async function resolveDoi(doi: string, signal?: AbortSignal): Promise<PublicationMeta | null> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  try {
    const res = await fetch(url, { signal, headers: { "Accept": "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.message;
    if (!item) return null;
    const rawTitle: string = Array.isArray(item.title) ? item.title[0] : item.title ?? doi;
    const title: string = sanitizeText(rawTitle) ?? rawTitle;
    const authors = formatAuthors(item.author);
    const rawVenue: string | undefined = item['container-title']?.[0] ?? item.publisher;
    const venue: string | undefined = sanitizeText(rawVenue);
    const year: number | undefined = item.issued?.["date-parts"]?.[0]?.[0];
    const urlOut: string | undefined = item.URL ?? (doi.startsWith("http") ? doi : `https://doi.org/${doi}`);
    return { title, authors, venue, year, url: urlOut, doi };
  } catch (e) {
    return null;
  }
}


