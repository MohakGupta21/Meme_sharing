import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listConversations, listMessages, markRead } from "../api/chat";
import { useChatSocket } from "../hooks/useChatSocket";
import { useAuth } from "../auth/useAuth";
import type { Message } from "../types";

/** Backend stores naive UTC ("2026-09-02 18:05:19"); render it as a local HH:MM. */
function formatTime(ts: string): string {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T");
  const hasTz = /[zZ]|[+-]\d\d:?\d\d$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Chat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingSentAt = useRef(0);
  const typingClear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const convsQ = useQuery({ queryKey: ["conversations"], queryFn: listConversations });

  const { connected, sendMessage, sendRead, sendTyping } = useChatSocket({
    onMessage: (m) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (m.conversation_id === activeId) {
        setPeerTyping(false);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    },
    onRead: (conversationId) => {
      if (conversationId === activeId) {
        setMessages((prev) =>
          prev.map((m) => ({ ...m, read_at: m.read_at ?? new Date().toISOString() })),
        );
      }
    },
    onTyping: (conversationId, fromUserId) => {
      if (conversationId === activeId && fromUserId !== user?.id) {
        setPeerTyping(true);
        if (typingClear.current) clearTimeout(typingClear.current);
        typingClear.current = setTimeout(() => setPeerTyping(false), 4000);
      }
    },
  });

  // load history when switching conversation
  useEffect(() => {
    if (activeId == null) return;
    let cancelled = false;
    setPeerTyping(false);
    listMessages(activeId).then((page) => {
      if (!cancelled) {
        setMessages([...page.items].reverse());
        setOlderCursor(page.next_cursor);
      }
    });
    markRead(activeId).then(() => qc.invalidateQueries({ queryKey: ["conversations"] }));
    sendRead(activeId);
    return () => {
      cancelled = true;
    };
  }, [activeId, qc, sendRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const active = useMemo(
    () => convsQ.data?.find((c) => c.id === activeId) ?? null,
    [convsQ.data, activeId],
  );

  const loadOlder = async () => {
    if (activeId == null || !olderCursor) return;
    const page = await listMessages(activeId, olderCursor);
    setMessages((prev) => [...[...page.items].reverse(), ...prev]);
    setOlderCursor(page.next_cursor);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (activeId != null && now - typingSentAt.current > 2000) {
      typingSentAt.current = now;
      sendTyping(activeId);
    }
  };

  const onSend = () => {
    if (!draft.trim() || activeId == null) return;
    sendMessage(activeId, draft.trim());
    setDraft("");
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-52px)] max-w-4xl">
      <aside className="w-64 shrink-0 overflow-y-auto border-r bg-white">
        <div className="flex items-center justify-between p-3">
          <h2 className="font-semibold">Chats</h2>
          <span className={`text-xs ${connected ? "text-green-600" : "text-gray-400"}`}>
            {connected ? "online" : "offline"}
          </span>
        </div>
        <ul>
          {convsQ.data?.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                  c.id === activeId ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                <img
                  src={c.other_user.profile_picture_url}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
                <span className="flex-1 truncate text-sm font-medium">
                  {c.other_user.display_name || c.other_user.username}
                </span>
                {c.unread_count > 0 && (
                  <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">
                    {c.unread_count}
                  </span>
                )}
              </button>
            </li>
          ))}
          {convsQ.data?.length === 0 && (
            <p className="p-3 text-sm text-gray-500">Add a friend to start chatting.</p>
          )}
        </ul>
      </aside>

      <section className="flex flex-1 flex-col">
        {active ? (
          <>
            <header className="border-b bg-white p-3 text-sm font-semibold">
              {active.other_user.display_name || active.other_user.username}
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {olderCursor && (
                <button
                  onClick={loadOlder}
                  className="mx-auto block rounded-md border px-3 py-1 text-xs text-gray-500"
                >
                  Load earlier messages
                </button>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`w-fit max-w-[70%] break-words rounded-lg px-3 py-2 text-sm ${
                      mine ? "ml-auto bg-indigo-600 text-white" : "bg-white"
                    }`}
                  >
                    <span>{m.body}</span>
                    <span
                      className={`mt-1 block text-right text-[10px] ${
                        mine ? "text-white/70" : "text-gray-400"
                      }`}
                    >
                      {formatTime(m.created_at)}
                      {mine && m.read_at && " · read"}
                    </span>
                  </div>
                );
              })}
              {peerTyping && <p className="text-xs italic text-gray-400">typing…</p>}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t bg-white p-3">
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                placeholder="Type a message…"
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                maxLength={4000}
              />
              <button
                onClick={onSend}
                disabled={!draft.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Select a conversation
          </div>
        )}
      </section>
    </div>
  );
}
