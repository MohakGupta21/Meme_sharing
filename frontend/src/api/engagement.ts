import { api } from "./axiosClient";
import type { Comment, Page } from "../types";

export interface LikeState {
  like_count: number;
  liked_by_me: boolean;
}

export async function likeMeme(memeId: number): Promise<LikeState> {
  const { data } = await api.put<LikeState>(`/memes/${memeId}/like`);
  return data;
}

export async function unlikeMeme(memeId: number): Promise<LikeState> {
  const { data } = await api.delete<LikeState>(`/memes/${memeId}/like`);
  return data;
}

export async function listComments(memeId: number, cursor?: string): Promise<Page<Comment>> {
  const { data } = await api.get<Page<Comment>>(`/memes/${memeId}/comments`, {
    params: { cursor },
  });
  return data;
}

export async function addComment(memeId: number, body: string): Promise<Comment> {
  const { data } = await api.post<Comment>(`/memes/${memeId}/comments`, { body });
  return data;
}

export async function deleteComment(commentId: number): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}
