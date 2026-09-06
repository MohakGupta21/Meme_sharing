import { useInfiniteFeed } from "../hooks/useInfiniteFeed";
import { MemeCard } from "../components/MemeCard";
import { useAuth } from "../auth/useAuth";
import { useCompose } from "../lib/compose";
import { PlusIcon, SparkleIcon } from "../components/icons";

function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-2.5 w-48" />
        </div>
      </div>
      <div className="skeleton h-72 w-full rounded-none" />
      <div className="flex gap-2 p-3.5">
        <div className="skeleton h-7 w-16 rounded-full" />
        <div className="skeleton h-7 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function Feed() {
  const { user } = useAuth();
  const compose = useCompose();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteFeed();

  const memes = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-[600px] px-3 py-5 sm:px-5">
      <div className="z-20 -mx-3 mb-4 flex items-center justify-between border-b border-slate-200/60 bg-slate-50/80 px-3 py-2.5 backdrop-blur-md sm:-mx-5 sm:px-5 lg:sticky lg:top-0">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Your feed</h1>
        <button onClick={compose.open} className="btn btn-primary px-3.5 py-2">
          <PlusIcon className="text-base" />
          Post
        </button>
      </div>

      {/* composer prompt */}
      <button
        onClick={compose.open}
        className="card mb-4 flex w-full items-center gap-3 p-3.5 text-left transition hover:border-brand-200 hover:shadow-lift"
      >
        <img
          src={user?.profile_picture_url}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-slate-100"
        />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-400">
          Share a meme with your friends…
        </span>
        <span className="chip shrink-0 bg-brand-50 text-brand-600">
          <SparkleIcon className="text-sm" /> New
        </span>
      </button>

      {isLoading && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!isLoading && memes.length === 0 && (
        <div className="card animate-fade-in flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <SparkleIcon className="text-2xl" />
          </span>
          <p className="text-base font-bold text-slate-800">It&rsquo;s quiet in here</p>
          <p className="max-w-xs text-sm text-slate-500">
            Your feed is built from you and your friends. Post a meme or add some people to get
            it rolling.
          </p>
          <button onClick={compose.open} className="btn btn-primary mt-1">
            <PlusIcon className="text-base" />
            Post your first meme
          </button>
        </div>
      )}

      <div className="space-y-4">
        {memes.map((m) => (
          <MemeCard key={m.id} meme={m} />
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="btn btn-outline mt-4 w-full"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
