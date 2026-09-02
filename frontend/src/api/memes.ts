import { api } from "./axiosClient";
import type { Meme, Page } from "../types";

export async function getFeed(cursor?: string, limit = 10): Promise<Page<Meme>> {
  const { data } = await api.get<Page<Meme>>("/memes/feed", { params: { cursor, limit } });
  return data;
}

export async function getUserMemes(userId: number, cursor?: string): Promise<Page<Meme>> {
  const { data } = await api.get<Page<Meme>>(`/users/${userId}/memes`, { params: { cursor } });
  return data;
}

export async function getMeme(id: number): Promise<Meme> {
  const { data } = await api.get<Meme>(`/memes/${id}`);
  return data;
}

export async function uploadMeme(
  file: File,
  fields: { title?: string; description?: string },
  onProgress?: (pct: number) => void,
): Promise<Meme> {
  const fd = new FormData();
  fd.append("media", file);
  if (fields.title) fd.append("title", fields.title);
  if (fields.description) fd.append("description", fields.description);
  const { data } = await api.post<Meme>("/memes", fd, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

export async function deleteMeme(id: number): Promise<void> {
  await api.delete(`/memes/${id}`);
}
