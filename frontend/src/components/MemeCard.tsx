import { Link } from "react-router-dom";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { likeMeme, unlikeMeme } from "../api/engagement";
import type { Meme, Page } from "../types";

/** Apply a transform to every cached meme wherever it appears. */
export function patchMemeEverywhere(qc: QueryClient, fn: (m: Meme) => Meme) {
  qc.setQueriesData<InfiniteData<Page<Meme>>>({ queryKey: ["feed"] }, (data) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(fn) })) }
      : data,
  );
  qc.setQueriesData<InfiniteData<Page<Meme>>>({ queryKey: ["user-memes"] }, (data) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(fn) })) }
      : data,
  );
  qc.setQueriesData<Meme>({ queryKey: ["meme"] }, (m) => (m ? fn(m) : m));
}

export function MemeCard({ meme }: { meme: Meme }) {
  const qc = useQueryClient();

  const toggleLike = useMutation({
    mutationFn: () => (meme.liked_by_me ? unlikeMeme(meme.id) : likeMeme(meme.id)),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["feed"] });
      patchMemeEverywhere(qc, (m) =>
        m.id === meme.id
          ? {
              ...m,
              liked_by_me: !m.liked_by_me,
              like_count: m.like_count + (m.liked_by_me ? -1 : 1),
            }
          : m,
      );
      return { rollback: () => patchMemeEverywhere(qc, (m) => (m.id === meme.id ? meme : m)) };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (state) =>
      patchMemeEverywhere(qc, (m) => (m.id === meme.id ? { ...m, ...state } : m)),
  });

  return (
    <article className="rounded-lg border bg-white shadow-sm">
      <header className="flex items-center gap-3 p-3">
        <img
          src={meme.author.profile_picture_url}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
        />
        <div>
          <Link to={`/users/${meme.author.id}`} className="text-sm font-semibold">
            {meme.author.display_name || meme.author.username}
          </Link>
          <p className="text-xs text-gray-500">{meme.author.lives_in}</p>
        </div>
      </header>

      {meme.title && <p className="px-3 pb-2 text-sm font-medium">{meme.title}</p>}

      <Link to={`/memes/${meme.id}`} className="block bg-black">
        {meme.media.media_type === "video" ? (
          <video src={meme.media.url} controls className="mx-auto max-h-[70vh]" />
        ) : (
          <img
            src={meme.media.url}
            alt={meme.title ?? "meme"}
            className="mx-auto max-h-[70vh]"
          />
        )}
      </Link>

      <footer className="flex items-center gap-4 p-3 text-sm">
        <button
          onClick={() => toggleLike.mutate()}
          className={`flex items-center gap-1 font-medium ${
            meme.liked_by_me ? "text-rose-600" : "text-gray-600"
          }`}
          aria-pressed={meme.liked_by_me}
        >
          {meme.liked_by_me ? "♥" : "♡"} {meme.like_count}
        </button>
        <Link to={`/memes/${meme.id}`} className="text-gray-600">
          💬 {meme.comment_count}
        </Link>
      </footer>
    </article>
  );
}
