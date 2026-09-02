import { type ReactNode, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  acceptRequest,
  declineRequest,
  listRequests,
  sendFriendRequest,
  unfriend,
} from "../api/friends";
import { apiErrorMessage } from "../api/axiosClient";
import type { FriendshipStatus } from "../types";

/**
 * State machine:
 *   none              -> [Add friend]        -> pending_outgoing
 *   pending_outgoing   -> (disabled) "Requested"
 *   pending_incoming   -> [Accept] [Decline] -> friends / none
 *   friends            -> [Unfriend]         -> none
 *   self               -> nothing
 */
export function FriendButton({
  userId,
  status,
}: {
  userId: number;
  status: FriendshipStatus;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => {
    setError(null);
    qc.invalidateQueries({ queryKey: ["user", userId] });
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["friend-requests"] });
  };
  const onError = (e: unknown) => setError(apiErrorMessage(e, "Action failed"));

  const send = useMutation({
    mutationFn: () => sendFriendRequest(userId),
    onSuccess: invalidate,
    onError,
  });
  const drop = useMutation({
    mutationFn: () => unfriend(userId),
    onSuccess: invalidate,
    onError,
  });
  const respond = useMutation({
    mutationFn: async (action: "accept" | "decline") => {
      const incoming = await listRequests("incoming");
      const req = incoming.find((r) => r.user.id === userId);
      if (!req) throw new Error("Request no longer exists");
      if (action === "accept") await acceptRequest(req.id);
      else await declineRequest(req.id);
    },
    onSuccess: invalidate,
    onError,
  });

  const btn = "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50";
  const busy = send.isPending || drop.isPending || respond.isPending;

  let control: ReactNode = null;
  if (status === "self") return null;
  else if (status === "friends")
    control = (
      <button
        onClick={() => drop.mutate()}
        disabled={busy}
        className={`${btn} bg-gray-100 text-gray-700`}
      >
        Unfriend
      </button>
    );
  else if (status === "pending_outgoing")
    control = (
      <button disabled className={`${btn} bg-gray-100 text-gray-400`}>
        Requested
      </button>
    );
  else if (status === "pending_incoming")
    control = (
      <span className="flex gap-2">
        <button
          onClick={() => respond.mutate("accept")}
          disabled={busy}
          className={`${btn} bg-indigo-600 text-white`}
        >
          Accept
        </button>
        <button
          onClick={() => respond.mutate("decline")}
          disabled={busy}
          className={`${btn} bg-gray-100 text-gray-700`}
        >
          Decline
        </button>
      </span>
    );
  else
    control = (
      <button
        onClick={() => send.mutate()}
        disabled={busy}
        className={`${btn} bg-indigo-600 text-white`}
      >
        Add friend
      </button>
    );

  return (
    <span className="inline-flex flex-col items-end gap-1">
      {control}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}
