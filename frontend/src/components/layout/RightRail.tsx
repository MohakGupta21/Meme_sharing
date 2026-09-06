import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acceptRequest, declineRequest, listFriends, listRequests } from "../../api/friends";
import { useAuth } from "../../auth/useAuth";
import { CheckIcon, FireIcon, SearchIcon, SparkleIcon } from "../icons";
import type { Friend } from "../../types";

function Widget({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickSearch() {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = term.trim();
        if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
      }}
      className="relative"
    >
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400" />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search people"
        className="input pl-10"
        aria-label="Search people"
      />
    </form>
  );
}

function RequestsWidget() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["friend-requests", "incoming"],
    queryFn: () => listRequests("incoming"),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["friend-requests"] });
    qc.invalidateQueries({ queryKey: ["friends"] });
  };
  const accept = useMutation({ mutationFn: acceptRequest, onSuccess: invalidate });
  const decline = useMutation({ mutationFn: declineRequest, onSuccess: invalidate });
  const busy = accept.isPending || decline.isPending;

  const requests = data ?? [];

  return (
    <Widget
      title="Friend requests"
      action={
        requests.length > 0 ? (
          <Link to="/friends" className="text-xs font-semibold text-brand-600 hover:underline">
            See all
          </Link>
        ) : null
      }
    >
      {requests.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <CheckIcon className="text-base text-emerald-500" />
          You&rsquo;re all caught up.
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.slice(0, 3).map((r) => (
            <li key={r.id} className="flex items-center gap-2.5">
              <img
                src={r.user.profile_picture_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
              <Link
                to={`/users/${r.user.id}`}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 hover:underline"
              >
                {r.user.display_name || r.user.username}
              </Link>
              <button
                onClick={() => accept.mutate(r.id)}
                disabled={busy}
                className="btn btn-primary px-2.5 py-1 text-xs"
              >
                Accept
              </button>
              <button
                onClick={() => decline.mutate(r.id)}
                disabled={busy}
                className="btn btn-soft px-2 py-1 text-xs"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

function FriendsWidget() {
  const { data } = useQuery({ queryKey: ["friends"], queryFn: () => listFriends() });
  const friends: Friend[] = data?.items ?? [];

  return (
    <Widget
      title="Your circle"
      action={
        friends.length > 0 ? (
          <Link to="/chat" className="text-xs font-semibold text-brand-600 hover:underline">
            Message
          </Link>
        ) : null
      }
    >
      {friends.length === 0 ? (
        <div className="text-sm text-slate-400">
          <p className="mb-2">No friends yet — go find your people.</p>
          <Link to="/search" className="btn btn-soft w-full py-2 text-xs">
            Discover people
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {friends.slice(0, 5).map((f) => (
            <li key={f.id}>
              <Link
                to={`/users/${f.id}`}
                className="group flex items-center gap-2.5"
              >
                <img
                  src={f.profile_picture_url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-transparent transition group-hover:ring-brand-200"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">
                    {f.display_name || f.username}
                  </span>
                  <span className="block truncate text-xs text-slate-400">@{f.username}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

function AboutCard() {
  const { user } = useAuth();
  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-br from-brand-500 to-fuchsia-600 p-4 text-white">
        <SparkleIcon className="text-2xl" />
        <p className="mt-2 text-sm font-bold">
          {user?.meme_count ? "Keep the streak going" : "Post your first meme"}
        </p>
        <p className="mt-0.5 text-xs text-white/80">
          {user?.meme_count
            ? `You've shared ${user.meme_count} ${user.meme_count === 1 ? "meme" : "memes"} so far.`
            : "The feed only shows you and your friends — start it off."}
        </p>
      </div>
      <div className="space-y-1.5 p-4 text-xs text-slate-500">
        <p className="flex items-center gap-2 font-medium text-slate-600">
          <FireIcon className="text-sm text-orange-500" /> Tips
        </p>
        <p>Like and comment to keep friends&rsquo; posts near the top.</p>
        <p>Add friends from Discover to grow your feed.</p>
        <p className="pt-2 text-[11px] text-slate-400">
          MemeShare · built with FastAPI + React
        </p>
      </div>
    </section>
  );
}

/** Desktop-only right rail (xl+). Hidden on the wide chat view. */
export function RightRail() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 flex-col gap-4 overflow-y-auto py-5 xl:flex">
      <QuickSearch />
      <RequestsWidget />
      <FriendsWidget />
      <AboutCard />
    </aside>
  );
}
