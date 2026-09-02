import { api } from "./axiosClient";
import type { Friend, FriendRequest, Page } from "../types";

export async function sendFriendRequest(userId: number): Promise<FriendRequest> {
  const { data } = await api.post<FriendRequest>("/friends/requests", { user_id: userId });
  return data;
}

export async function listRequests(
  direction: "incoming" | "outgoing",
): Promise<FriendRequest[]> {
  const { data } = await api.get<FriendRequest[]>("/friends/requests", {
    params: { direction },
  });
  return data;
}

export async function acceptRequest(requestId: number): Promise<FriendRequest> {
  const { data } = await api.post<FriendRequest>(`/friends/requests/${requestId}/accept`);
  return data;
}

export async function declineRequest(requestId: number): Promise<void> {
  await api.post(`/friends/requests/${requestId}/decline`);
}

export async function listFriends(cursor?: string): Promise<Page<Friend>> {
  const { data } = await api.get<Page<Friend>>("/friends", { params: { cursor } });
  return data;
}

export async function unfriend(userId: number): Promise<void> {
  await api.delete(`/friends/${userId}`);
}
