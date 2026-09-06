import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { likeMeme, unlikeMeme } from "../api/engagement";
import { deleteMeme } from "../api/memes";
import { useAuth } from "../auth/useAuth";
import { timeAgo } from "../lib/format";
import { CommentIcon, HeartIcon, ShareIcon } from "./icons";
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

/** Drop a meme from every cache it might appear in. */
export function removeMemeEverywhere(qc: QueryClient, memeId: number) {
  const dropFromPages = (data?: InfiniteData<Page<Meme>>) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.filter((m) => m.id !== memeId),
          })),
        }
      : data;
  qc.setQueriesData<InfiniteData<Page<Meme>>>({ queryKey: ["feed"] }, dropFromPages);
  qc.setQueriesData<InfiniteData<Page<Meme>>>({ queryKey: ["user-memes"] }, dropFromPages);
  qc.removeQueries({ queryKey: ["meme", memeId] });
}

export function MemeCard({ meme }: { meme: Meme }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMine = user?.id === meme.author.id;
  const [copied, setCopied] = useState(false);

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

  const remove = useMutation({
    mutationFn: () => deleteMeme(meme.id),
    onSuccess: () => {
      if (location.pathname === `/memes/${meme.id}`) navigate("/feed", { replace: true });
      removeMemeEverywhere(qc, meme.id);
    },
  });

  const onDelete = () => {
    if (window.confirm("Delete this post? This can't be undone.")) remove.mutate();
  };

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/memes/${meme.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <article className="card card-interactive animate-fade-in overflow-hidden">
      <header className="flex items-center gap-3 p-3.5">
        <Link to={`/users/${meme.author.id}`} className="shrink-0">
          <img
            src={meme.author.profile_picture_url}
            alt=""
            className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100"
          />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link
            to={`/users/${meme.author.id}`}
            className="text-sm font-bold text-slate-900 hover:underline"
          >
            {meme.author.display_name || meme.author.username}
          </Link>
          <p className="truncate text-xs text-slate-400">
            @{meme.author.username} · {meme.author.lives_in} ·{" "}
            <time dateTime={meme.created_at}>{timeAgo(meme.created_at)}</time>
          </p>
        </div>
        {isMine && (
          <button
            onClick={onDelete}
            disabled={remove.isPending}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
        )}
      </header>

      {meme.title && (
        <p className="px-3.5 pb-2.5 text-[15px] font-semibold text-slate-800">{meme.title}</p>
      )}

      <Link
        to={`/memes/${meme.id}`}
        className="block bg-slate-950/95"
        aria-label={meme.title ? `Open “${meme.title}”` : "Open meme"}
      >
        {meme.media.media_type === "video" ? (
          <video src={meme.media.url} controls className="mx-auto max-h-[72vh]" />
        ) : (
          <img
            src={meme.media.url}
            alt={meme.title ?? "meme"}
            loading="lazy"
            className="mx-auto max-h-[72vh]"
          />
        )}
      </Link>

      <footer className="flex items-center gap-1 p-2.5 text-sm">
        <button
          onClick={() => toggleLike.mutate()}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition ${
            meme.liked_by_me
              ? "bg-rose-50 text-rose-600"
              : "text-slate-500 hover:bg-slate-100 hover:text-rose-600"
          }`}
          aria-pressed={meme.liked_by_me}
        >
          <HeartIcon filled={meme.liked_by_me} className="text-lg" />
          <span>{meme.like_count}</span>
        </button>

        <Link
          to={`/memes/${meme.id}`}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
        >
          <CommentIcon className="text-lg" />
          <span>{meme.comment_count}</span>
        </Link>

        <button
          onClick={onShare}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
        >
          <ShareIcon className="text-lg" />
          <span>{copied ? "Copied!" : "Share"}</span>
        </button>
      </footer>
    </article>
  );
}
