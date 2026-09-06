import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listConversations, listMessages, markRead } from "../api/chat";
import { useChatSocket } from "../hooks/useChatSocket";
import { useAuth } from "../auth/useAuth";
import { parseUtc } from "../lib/format";
import { ChatIcon } from "../components/icons";
import type { Message } from "../types";

function formatTime(ts: string): string {
  return parseUtc(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    <div className="-mb-24 flex h-[calc(100dvh-3.25rem)] gap-0 lg:-mb-10 lg:h-screen lg:gap-4 lg:py-4">
      <aside className="flex w-[86px] shrink-0 flex-col border-r border-slate-200/70 bg-white sm:w-72 lg:rounded-2xl lg:border">
        <div className="flex items-center justify-between px-3 py-3.5 sm:px-4">
          <h2 className="hidden font-extrabold text-slate-900 sm:block">Messages</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              connected ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`}
            />
            <span className="hidden sm:inline">{connected ? "online" : "offline"}</span>
          </span>
        </div>
        <ul className="flex-1 overflow-y-auto px-1.5 pb-2">
          {convsQ.data?.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${
                  c.id === activeId ? "bg-brand-50" : "hover:bg-slate-100"
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={c.other_user.profile_picture_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  {c.unread_count > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                <span className="hidden min-w-0 flex-1 sm:block">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {c.other_user.display_name || c.other_user.username}
                  </span>
                  {c.last_message && (
                    <span className="block truncate text-xs text-slate-400">
                      {c.last_message.body}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {convsQ.data?.length === 0 && (
            <p className="p-3 text-xs text-slate-400 sm:text-sm">
              Add a friend to start chatting.
            </p>
          )}
        </ul>
      </aside>

      <section className="flex flex-1 flex-col bg-white lg:rounded-2xl lg:border lg:border-slate-200/70">
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-3 lg:rounded-t-2xl">
              <img
                src={active.other_user.profile_picture_url}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
              <Link
                to={`/users/${active.other_user.id}`}
                className="text-sm font-bold text-slate-900 hover:underline"
              >
                {active.other_user.display_name || active.other_user.username}
              </Link>
            </header>

            <div className="flex-1 space-y-1.5 overflow-y-auto bg-slate-50/60 p-4">
              {olderCursor && (
                <button
                  onClick={loadOlder}
                  className="mx-auto mb-2 block rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  Load earlier messages
                </button>
              )}
              {messages.map((m, i) => {
                const mine = m.sender_id === user?.id;
                const prev = messages[i - 1];
                const grouped = prev && prev.sender_id === m.sender_id;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"} ${
                      grouped ? "mt-0.5" : "mt-2.5"
                    }`}
                  >
                    <div
                      className={`max-w-[78%] break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        mine
                          ? "rounded-br-md bg-gradient-to-br from-brand-600 to-brand-600 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      <span>{m.body}</span>
                      <span
                        className={`mt-1 block text-right text-[10px] ${
                          mine ? "text-white/70" : "text-slate-400"
                        }`}
                      >
                        {formatTime(m.created_at)}
                        {mine && m.read_at && " · read"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {peerTyping && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 border-t border-slate-200/70 bg-white p-3 lg:rounded-b-2xl">
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                placeholder="Type a message…"
                className="input flex-1"
                maxLength={4000}
              />
              <button
                onClick={onSend}
                disabled={!draft.trim()}
                className="btn btn-primary px-5"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
              <ChatIcon className="text-2xl" />
            </span>
            <p className="text-sm font-semibold text-slate-700">Your messages</p>
            <p className="max-w-xs text-sm text-slate-400">
              Pick a conversation to start chatting — messages, typing and read receipts update
              live.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
