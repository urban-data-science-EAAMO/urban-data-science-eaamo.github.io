import type { CollectionEntry } from "astro:content";

const getSortedAlbums = (albums: CollectionEntry<"albums">[]) =>
  albums
    .filter(({ data }) => !data.draft)
    .sort(
      (a, b) =>
        Math.floor(new Date(b.data.pubDatetime).getTime() / 1000) -
        Math.floor(new Date(a.data.pubDatetime).getTime() / 1000)
    );

export default getSortedAlbums;