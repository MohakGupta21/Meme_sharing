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
import type { Friend } from "../types";

type Tab = "friends" | "incoming" | "outgoing";

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

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button
      onClick={() => setTab(t)}
      className={`px-3 py-2 text-sm font-medium ${
        tab === t ? "border-b-2 border-indigo-600 text-indigo-700" : "text-gray-500"
      }`}
    >
      {label}
      {count ? ` (${count})` : ""}
    </button>
  );

  const friends: Friend[] = friendsQ.data?.items ?? [];

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-3 text-xl font-bold">Friends</h1>
      <div className="mb-4 flex border-b">
        {tabBtn("friends", "Friends", friends.length)}
        {tabBtn("incoming", "Requests", incomingQ.data?.length)}
        {tabBtn("outgoing", "Sent", outgoingQ.data?.length)}
      </div>

      {actionError && (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </p>
      )}

      {tab === "friends" && (
        <ul className="space-y-2">
          {friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-md border bg-white p-3">
              <img src={f.profile_picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              <Link to={`/users/${f.id}`} className="flex-1 text-sm font-medium">
                {f.display_name || f.username}
              </Link>
              <Link to="/chat" className="text-sm text-indigo-600">
                Message
              </Link>
            </li>
          ))}
          {friends.length === 0 && <p className="text-sm text-gray-500">No friends yet.</p>}
          {friendsQ.data?.next_cursor && (
            <p className="text-xs text-gray-400">More friends not shown.</p>
          )}
        </ul>
      )}

      {tab === "incoming" && (
        <ul className="space-y-2">
          {incomingQ.data?.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-md border bg-white p-3">
              <img src={r.user.profile_picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              <Link to={`/users/${r.user.id}`} className="flex-1 text-sm font-medium">
                {r.user.display_name || r.user.username}
              </Link>
              <button
                onClick={() => accept.mutate(r.id)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white"
              >
                Accept
              </button>
              <button
                onClick={() => decline.mutate(r.id)}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm"
              >
                Decline
              </button>
            </li>
          ))}
          {incomingQ.data?.length === 0 && (
            <p className="text-sm text-gray-500">No pending requests.</p>
          )}
        </ul>
      )}

      {tab === "outgoing" && (
        <ul className="space-y-2">
          {outgoingQ.data?.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-md border bg-white p-3">
              <img src={r.user.profile_picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              <Link to={`/users/${r.user.id}`} className="flex-1 text-sm font-medium">
                {r.user.display_name || r.user.username}
              </Link>
              <span className="text-sm text-gray-400">Pending</span>
            </li>
          ))}
          {outgoingQ.data?.length === 0 && (
            <p className="text-sm text-gray-500">No sent requests.</p>
          )}
        </ul>
      )}
    </div>
  );
}
