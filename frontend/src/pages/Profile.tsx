import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/users";
import { useUserMemes } from "../hooks/useInfiniteFeed";
import { MemeCard } from "../components/MemeCard";
import { FriendButton } from "../components/FriendButton";
import { useAuth } from "../auth/useAuth";
import { SettingsIcon } from "../components/icons";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-extrabold text-slate-900">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

export function Profile() {
  const { id } = useParams();
  const userId = Number(id);
  const { user: me } = useAuth();
  const isMe = me?.id === userId;

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
  });
  const memesQ = useUserMemes(userId);
  const memes = memesQ.data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-[600px] px-3 py-5 sm:px-5">
        <div className="card h-52 animate-pulse" />
      </div>
    );
  }

  const memberSince = new Date(
    user.created_at.includes("T") ? user.created_at : user.created_at.replace(" ", "T") + "Z",
  ).toLocaleDateString([], { month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-[600px] px-3 py-5 sm:px-5">
      <div className="card animate-fade-in overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-brand-500 via-brand-600 to-fuchsia-600" />
        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between">
            <img
              src={user.profile_picture_url}
              alt=""
              className="h-24 w-24 rounded-2xl object-cover ring-4 ring-white"
            />
            <div className="mb-1">
              {isMe ? (
                <Link to="/settings/profile" className="btn btn-outline px-3.5 py-2">
                  <SettingsIcon className="text-base" />
                  Edit profile
                </Link>
              ) : (
                <FriendButton userId={user.id} status={user.friendship_status} />
              )}
            </div>
          </div>

          <h1 className="mt-3 text-xl font-extrabold text-slate-900">
            {user.display_name || user.username}
          </h1>
          <p className="text-sm text-slate-400">@{user.username}</p>
          <p className="mt-2 text-sm text-slate-700">{user.caption}</p>
          {user.bio && <p className="mt-1 text-sm text-slate-500">{user.bio}</p>}

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="chip">📍 {user.lives_in}</span>
            <span className="chip">🗓 Joined {memberSince}</span>
          </div>

          {isMe && me && (
            <div className="mt-4 flex justify-around rounded-2xl bg-slate-50 py-3">
              <Stat label="Memes" value={me.meme_count} />
              <Stat label="Friends" value={me.friend_count} />
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-6 px-1 text-sm font-bold text-slate-500">
        {isMe ? "Your memes" : "Memes"}
      </h2>

      <div className="space-y-4">
        {memes.map((m) => (
          <MemeCard key={m.id} meme={m} />
        ))}
      </div>

      {!memesQ.isLoading && memes.length === 0 && (
        <p className="card p-8 text-center text-sm text-slate-400">No memes yet.</p>
      )}

      {memesQ.hasNextPage && (
        <button
          onClick={() => memesQ.fetchNextPage()}
          className="btn btn-outline mt-4 w-full"
        >
          Load more
        </button>
      )}
    </div>
  );
}
