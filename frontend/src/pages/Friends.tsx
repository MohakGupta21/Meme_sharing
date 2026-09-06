import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptRequest,
  declineRequest,
  listFriends,
  listRequests,
} from "../api/friends";
import { apiErrorMessage } from "../api/axiosClient";
import { ChatIcon } from "../components/icons";
import type { Friend } from "../types";

type Tab = "friends" | "incoming" | "outgoing";

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="card card-interactive flex items-center gap-3 p-3">{children}</li>
  );
}

function Avatar({ src }: { src: string }) {
  return <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-slate-100" />;
}

function EmptyState({ text }: { text: string }) {
  return <p className="card p-8 text-center text-sm text-slate-400">{text}</p>;
}

export function Friends() {
  const [tab, setTab] = useState<Tab>("friends");
  const qc = useQueryClient();

  const friendsQ = useQuery({ queryKey: ["friends"], queryFn: () => listFriends() });
  const incomingQ = useQuery({
    queryKey: ["friend-requests", "incoming"],
    queryFn: () => listRequests("incoming"),
  });
  const outgoingQ = useQuery({
    queryKey: ["friend-requests", "outgoing"],
    queryFn: () => listRequests("outgoing"),
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const invalidate = () => {
    setActionError(null);
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["friend-requests"] });
  };
  const onError = (e: unknown) => setActionError(apiErrorMessage(e, "Action failed"));
  const accept = useMutation({ mutationFn: acceptRequest, onSuccess: invalidate, onError });
  const decline = useMutation({ mutationFn: declineRequest, onSuccess: invalidate, onError });

  const friends: Friend[] = friendsQ.data?.items ?? [];
  const tabs: [Tab, string, number | undefined][] = [
    ["friends", "Friends", friends.length || undefined],
    ["incoming", "Requests", incomingQ.data?.length || undefined],
    ["outgoing", "Sent", outgoingQ.data?.length || undefined],
  ];

  return (
    <div className="mx-auto max-w-[600px] px-3 py-5 sm:px-5">
      <h1 className="mb-4 text-xl font-extrabold tracking-tight text-slate-900">Friends</h1>

      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map(([t, label, count]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
              tab === t ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
            {count ? ` · ${count}` : ""}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
      )}

      {tab === "friends" && (
        <ul className="space-y-2.5">
          {friends.map((f) => (
            <Row key={f.id}>
              <Avatar src={f.profile_picture_url} />
              <Link to={`/users/${f.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">
                  {f.display_name || f.username}
                </span>
                <span className="block truncate text-xs text-slate-400">@{f.username}</span>
              </Link>
              <Link to="/chat" className="btn btn-soft px-3 py-1.5 text-xs">
                <ChatIcon className="text-sm" />
                Message
              </Link>
            </Row>
          ))}
          {friends.length === 0 && (
            <EmptyState text="No friends yet — head to Discover to find people." />
          )}
          {friendsQ.data?.next_cursor && (
            <p className="px-1 text-xs text-slate-400">More friends not shown.</p>
          )}
        </ul>
      )}

      {tab === "incoming" && (
        <ul className="space-y-2.5">
          {incomingQ.data?.map((r) => (
            <Row key={r.id}>
              <Avatar src={r.user.profile_picture_url} />
              <Link to={`/users/${r.user.id}`} className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                {r.user.display_name || r.user.username}
              </Link>
              <button
                onClick={() => accept.mutate(r.id)}
                disabled={accept.isPending}
                className="btn btn-primary px-3 py-1.5 text-xs"
              >
                Accept
              </button>
              <button
                onClick={() => decline.mutate(r.id)}
                disabled={decline.isPending}
                className="btn btn-soft px-3 py-1.5 text-xs"
              >
                Decline
              </button>
            </Row>
          ))}
          {incomingQ.data?.length === 0 && <EmptyState text="No pending requests." />}
        </ul>
      )}

      {tab === "outgoing" && (
        <ul className="space-y-2.5">
          {outgoingQ.data?.map((r) => (
            <Row key={r.id}>
              <Avatar src={r.user.profile_picture_url} />
              <Link to={`/users/${r.user.id}`} className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                {r.user.display_name || r.user.username}
              </Link>
              <span className="chip">Pending</span>
            </Row>
          ))}
          {outgoingQ.data?.length === 0 && <EmptyState text="No sent requests." />}
        </ul>
      )}
    </div>
  );
}
