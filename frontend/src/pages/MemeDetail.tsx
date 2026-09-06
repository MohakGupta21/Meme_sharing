import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMeme } from "../api/memes";
import { MemeCard } from "../components/MemeCard";
import { CommentList } from "../components/CommentList";

export function MemeDetail() {
  const { id } = useParams();
  const memeId = Number(id);
  const { data: meme, isLoading, isError } = useQuery({
    queryKey: ["meme", memeId],
    queryFn: () => getMeme(memeId),
  });

  return (
    <div className="mx-auto max-w-[600px] px-3 py-5 sm:px-5">
      <Link
        to="/feed"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        ← Back to feed
      </Link>

      {isLoading && <div className="card h-96 animate-pulse" />}
      {(isError || (!isLoading && !meme)) && (
        <p className="card p-8 text-center text-sm text-slate-400">Meme not found.</p>
      )}

      {meme && (
        <div className="space-y-4">
          <MemeCard meme={meme} />
          {meme.description && (
            <p className="card p-4 text-sm leading-relaxed text-slate-700">{meme.description}</p>
          )}
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Comments</h2>
            <CommentList memeId={meme.id} memeAuthorId={meme.author.id} />
          </div>
        </div>
      )}
    </div>
  );
}
