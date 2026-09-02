import { useState } from "react";
import { useInfiniteFeed } from "../hooks/useInfiniteFeed";
import { MemeCard } from "../components/MemeCard";
import { UploadForm } from "../components/UploadForm";

export function Feed() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteFeed();
  const [showUpload, setShowUpload] = useState(false);

  const memes = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Feed</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          + New meme
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}
      {!isLoading && memes.length === 0 && (
        <p className="text-gray-500">
          Nothing here yet. Post a meme or add some friends!
        </p>
      )}

      {memes.map((m) => (
        <MemeCard key={m.id} meme={m} />
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full rounded-md border py-2 text-sm text-gray-600"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}

      {showUpload && <UploadForm onDone={() => setShowUpload(false)} />}
    </div>
  );
}
