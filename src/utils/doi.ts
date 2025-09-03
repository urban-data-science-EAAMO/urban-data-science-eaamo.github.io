export interface PublicationMeta {
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  url?: string;
  doi: string;
}

function formatAuthors(authorArr: any[] | undefined): string[] {
  if (!authorArr || !Array.isArray(authorArr)) return [];
  return authorArr
    .map((a) => {
      const given = a?.given ?? "";
      const family = a?.family ?? "";
      return [given, family].filter(Boolean).join(" ").trim();
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
    const title: string = Array.isArray(item.title) ? item.title[0] : item.title ?? doi;
    const authors = formatAuthors(item.author);
    const venue: string | undefined = item['container-title']?.[0] ?? item.publisher;
    const year: number | undefined = item.issued?.["date-parts"]?.[0]?.[0];
    const urlOut: string | undefined = item.URL ?? (doi.startsWith("http") ? doi : `https://doi.org/${doi}`);
    return { title, authors, venue, year, url: urlOut, doi };
  } catch (e) {
    return null;
  }
}


