import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tokenStore } from "../api/tokenStore";
import { sendMessageRest } from "../api/chat";
import type { Message } from "../types";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/chat";

type ServerFrame =
  | ({ type: "message" } & Message)
  | { type: "read"; conversation_id: number; user_id: number }
  | { type: "typing"; conversation_id: number; user_id: number }
  | { type: "error"; detail: string };

interface UseChatSocket {
  connected: boolean;
  sendMessage: (conversationId: number, body: string) => void;
  sendRead: (conversationId: number) => void;
  sendTyping: (conversationId: number) => void;
}

export function useChatSocket(handlers: {
  onMessage?: (m: Message) => void;
  onRead?: (conversationId: number, userId: number) => void;
  onTyping?: (conversationId: number, userId: number) => void;
}): UseChatSocket {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (closedRef.current) return;
    const token = tokenStore.getAccess();
    if (!token) {
      // no token yet — try again shortly rather than giving up forever
      retryTimerRef.current = setTimeout(connect, 1000);
      return;
    }
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setConnected(true);
    };
    ws.onclose = () => {
      setConnected(false);
      if (closedRef.current) return;
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
      retryRef.current += 1;
      retryTimerRef.current = setTimeout(connect, delay);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (evt) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(evt.data);
      } catch {
        return;
      }
      const h = handlersRef.current;
      if (frame.type === "message") h.onMessage?.(frame);
      else if (frame.type === "read") h.onRead?.(frame.conversation_id, frame.user_id);
      else if (frame.type === "typing") h.onTyping?.(frame.conversation_id, frame.user_id);
    };
  }, []);

  useEffect(() => {
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const sendMessage = useCallback(
    (conversationId: number, body: string) => {
      if (!send({ type: "message", conversation_id: conversationId, body })) {
        // fall back to REST when the socket is down
        sendMessageRest(conversationId, body).catch(() => {
          /* surfaced by the conversations refetch; nothing to do here */
        });
      }
    },
    [send],
  );
  const sendRead = useCallback(
    (conversationId: number) => send({ type: "read", conversation_id: conversationId }),
    [send],
  );
  const sendTyping = useCallback(
    (conversationId: number) => send({ type: "typing", conversation_id: conversationId }),
    [send],
  );

  return useMemo(
    () => ({ connected, sendMessage, sendRead, sendTyping }),
    [connected, sendMessage, sendRead, sendTyping],
  );
}
