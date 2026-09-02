import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/users";
import { useUserMemes } from "../hooks/useInfiniteFeed";
import { MemeCard } from "../components/MemeCard";
import { FriendButton } from "../components/FriendButton";
import { useAuth } from "../auth/useAuth";

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

  if (isLoading || !user) return <p className="p-8 text-center text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
        <img
          src={user.profile_picture_url}
          alt=""
          className="h-20 w-20 rounded-full object-cover"
        />
        <div className="flex-1">
          <h1 className="text-lg font-bold">{user.display_name || user.username}</h1>
          <p className="text-sm text-gray-500">@{user.username} · {user.lives_in}</p>
          <p className="text-sm">{user.caption}</p>
          {user.bio && <p className="mt-1 text-sm text-gray-600">{user.bio}</p>}
        </div>
        {isMe ? (
          <Link
            to="/settings/profile"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium"
          >
            Edit
          </Link>
        ) : (
          <FriendButton userId={user.id} status={user.friendship_status} />
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-500">Memes</h2>
      {memes.map((m) => (
        <MemeCard key={m.id} meme={m} />
      ))}
      {memesQ.hasNextPage && (
        <button
          onClick={() => memesQ.fetchNextPage()}
          className="w-full rounded-md border py-2 text-sm text-gray-600"
        >
          Load more
        </button>
      )}
    </div>
  );
}
