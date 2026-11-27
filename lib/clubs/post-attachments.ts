export type PostAttachment = { id: string; width: number; height: number };

export function postAttachmentsUrl(clubId: string, postId: string, id?: string, size: "full" | "thumbnail" = "full") {
  const query = new URLSearchParams({ clubId, postId });
  if (id) {
    query.set("id", id);
    query.set("size", size);
  }
  return `/api/clubs/content/photos?${query}`;
}
