import { useEffect, useRef, useState } from "react";
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
  // Bumped on every double-tap so the heart-burst element remounts and replays.
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (navTimer.current) clearTimeout(navTimer.current);
  }, []);

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

  // Single tap opens the meme; a second tap within 280ms likes it instead (Instagram-style).
  const onMediaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      if (navTimer.current) clearTimeout(navTimer.current);
      setBurst((b) => b + 1);
      if (!meme.liked_by_me && !toggleLike.isPending) toggleLike.mutate();
      return;
    }
    lastTap.current = now;
    navTimer.current = setTimeout(() => navigate(`/memes/${meme.id}`), 280);
  };

  const onShare = async () => {
    const url = `${window.location.origin}/memes/${meme.id}`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: meme.title ?? "Meme", url });
      } catch {
        /* share sheet dismissed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <article className="card card-flush card-interactive animate-fade-in overflow-hidden">
      <header className="flex items-center gap-3 px-3.5 py-3">
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
            className="block truncate text-sm font-bold text-slate-900 hover:underline"
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
            className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
        )}
      </header>

      {meme.title && (
        <p className="px-3.5 pb-2.5 text-[15px] font-semibold text-slate-800">{meme.title}</p>
      )}

      {meme.media.media_type === "video" ? (
        // Videos keep their native controls, so taps go to the player rather than navigating.
        <div className="bg-slate-950/95">
          <video
            src={meme.media.url}
            controls
            playsInline
            preload="metadata"
            className="mx-auto max-h-[72vh] w-full"
          />
        </div>
      ) : (
        <Link
          to={`/memes/${meme.id}`}
          onClick={onMediaClick}
          className="relative block select-none bg-slate-950/95"
          aria-label={meme.title ? `Open “${meme.title}”` : "Open meme"}
        >
          <img
            src={meme.media.url}
            alt={meme.title ?? "meme"}
            loading="lazy"
            draggable={false}
            className="mx-auto max-h-[72vh] w-full object-contain"
          />
          {burst > 0 && (
            <span
              key={burst}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <HeartIcon
                filled
                className="animate-heart-burst text-[6.5rem] text-white drop-shadow-[0_6px_24px_rgba(225,29,72,0.55)]"
              />
            </span>
          )}
        </Link>
      )}

      <footer className="flex items-center gap-1 px-2 py-2 text-sm sm:p-2.5">
        <button
          onClick={() => toggleLike.mutate()}
          className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition active:scale-95 ${
            meme.liked_by_me
              ? "bg-rose-50 text-rose-600"
              : "text-slate-500 hover:bg-slate-100 hover:text-rose-600"
          }`}
          aria-pressed={meme.liked_by_me}
          aria-label={`${meme.liked_by_me ? "Unlike" : "Like"} (${meme.like_count})`}
        >
          <HeartIcon
            key={String(meme.liked_by_me)}
            filled={meme.liked_by_me}
            className={`text-xl sm:text-lg ${meme.liked_by_me ? "animate-pop" : ""}`}
          />
          <span>{meme.like_count}</span>
        </button>

        <Link
          to={`/memes/${meme.id}`}
          aria-label={`Comments (${meme.comment_count})`}
          className="flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-brand-600 active:scale-95"
        >
          <CommentIcon className="text-xl sm:text-lg" />
          <span>{meme.comment_count}</span>
        </Link>

        <button
          onClick={onShare}
          aria-label="Share"
          className="ml-auto flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-brand-600 active:scale-95"
        >
          <ShareIcon className="text-xl sm:text-lg" />
          <span className={copied ? "" : "hidden sm:inline"}>{copied ? "Copied!" : "Share"}</span>
        </button>
      </footer>
    </article>
  );
}
