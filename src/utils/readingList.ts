import { getCollection } from "astro:content";

/** One source for the homepage and both reading-list URLs. No network during builds. */
export async function getReadingList() {
  const entries = await getCollection("publications");
  return entries
    .map(({ data }) => {
      const doi = data.doi
        .trim()
        .replace(/^(?:https?:\/\/)?doi\.org\//i, "")
        .replace(/^doi:\s*/i, "");
      return {
        ...data,
        doi,
        title: data.title ?? doi,
        authors: data.authors ?? [],
        url: data.url ?? `https://doi.org/${doi}`,
      };
    })
    .sort(
      (a, b) =>
        (b.year ?? 0) - (a.year ?? 0) || (b.order ?? 0) - (a.order ?? 0),
    );
}
