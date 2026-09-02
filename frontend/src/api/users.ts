import { api } from "./axiosClient";
import type { Page, UserMe, UserPublic, UserWithRelation } from "../types";

export interface ProfileUpdate {
  display_name?: string;
  bio?: string;
  lives_in?: string;
  caption?: string;
}

export async function updateMe(patch: ProfileUpdate): Promise<UserMe> {
  const { data } = await api.patch<UserMe>("/users/me", patch);
  return data;
}

export async function updateAvatar(file: File): Promise<UserMe> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.put<UserMe>("/users/me/profile-picture", fd);
  return data;
}

export async function getUser(id: number): Promise<UserWithRelation> {
  const { data } = await api.get<UserWithRelation>(`/users/${id}`);
  return data;
}

export async function searchUsers(term: string, cursor?: string): Promise<Page<UserPublic>> {
  const { data } = await api.get<Page<UserPublic>>("/users", {
    params: { search: term, cursor },
  });
  return data;
}
