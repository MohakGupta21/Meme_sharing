import { useParams } from "react-router-dom";
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

  if (isLoading) return <p className="p-8 text-center text-gray-500">Loading…</p>;
  if (isError || !meme) return <p className="p-8 text-center text-gray-500">Meme not found.</p>;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <MemeCard meme={meme} />
      {meme.description && <p className="text-sm text-gray-700">{meme.description}</p>}
      <CommentList memeId={meme.id} memeAuthorId={meme.author.id} />
    </div>
  );
}
