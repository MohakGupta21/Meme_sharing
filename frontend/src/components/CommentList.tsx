import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addComment, deleteComment, listComments } from "../api/engagement";
import { patchMemeEverywhere } from "./MemeCard";
import { useAuth } from "../auth/useAuth";
import { apiErrorMessage } from "../api/axiosClient";
import type { Comment } from "../types";

export function CommentList({ memeId, memeAuthorId }: { memeId: number; memeAuthorId: number }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commentsQ = useQuery({
    queryKey: ["comments", memeId],
    queryFn: () => listComments(memeId),
  });

  const add = useMutation({
    mutationFn: (body: string) => addComment(memeId, body),
    onSuccess: () => {
      setDraft("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["comments", memeId] });
      patchMemeEverywhere(qc, (m) =>
        m.id === memeId ? { ...m, comment_count: m.comment_count + 1 } : m,
      );
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not post comment")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteComment(id),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["comments", memeId] });
      patchMemeEverywhere(qc, (m) =>
        m.id === memeId ? { ...m, comment_count: Math.max(0, m.comment_count - 1) } : m,
      );
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not delete comment")),
  });

  const comments: Comment[] = commentsQ.data?.items ?? [];

  return (
    <section className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) add.mutate(draft.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          className="input flex-1"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={add.isPending || !draft.trim()}
          className="btn btn-primary"
        >
          Post
        </button>
      </form>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {commentsQ.isLoading && <p className="text-sm text-slate-400">Loading comments…</p>}
      {!commentsQ.isLoading && comments.length === 0 && (
        <p className="text-sm text-slate-400">No comments yet — be the first.</p>
      )}

      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5 text-sm">
            <img
              src={c.author.profile_picture_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-slate-100"
            />
            <div className="flex-1 rounded-2xl rounded-tl-md bg-slate-50 px-3 py-2">
              <span className="font-semibold text-slate-900">{c.author.username}</span>{" "}
              <span className="text-slate-700">{c.body}</span>
            </div>
            {user && (user.id === c.author.id || user.id === memeAuthorId) && (
              <button
                onClick={() => remove.mutate(c.id)}
                className="mt-1.5 text-xs text-slate-400 hover:text-rose-600"
              >
                delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
