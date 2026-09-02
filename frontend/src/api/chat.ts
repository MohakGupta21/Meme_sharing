import { api } from "./axiosClient";
import type { Conversation, Message, Page } from "../types";

export async function listConversations(): Promise<Conversation[]> {
  const { data } = await api.get<Conversation[]>("/chat/conversations");
  return data;
}

export async function openConversation(userId: number): Promise<Conversation> {
  const { data } = await api.post<Conversation>("/chat/conversations", { user_id: userId });
  return data;
}

export async function listMessages(
  conversationId: number,
  cursor?: string,
): Promise<Page<Message>> {
  const { data } = await api.get<Page<Message>>(
    `/chat/conversations/${conversationId}/messages`,
    { params: { cursor } },
  );
  return data;
}

export async function sendMessageRest(conversationId: number, body: string): Promise<Message> {
  const { data } = await api.post<Message>(
    `/chat/conversations/${conversationId}/messages`,
    { body },
  );
  return data;
}

export async function markRead(conversationId: number): Promise<void> {
  await api.post(`/chat/conversations/${conversationId}/read`);
}
