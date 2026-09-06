import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../api/users";
import { SearchIcon, UsersIcon } from "../components/icons";

export function Search() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [term, setTerm] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);

  // keep in sync when the URL ?q= changes (e.g. from the right-rail search box)
  useEffect(() => {
    const q = params.get("q") ?? "";
    setTerm(q);
    setSubmitted(q);
  }, [params]);

  const { data, isFetching } = useQuery({
    queryKey: ["user-search", submitted],
    queryFn: () => searchUsers(submitted),
    enabled: submitted.length > 0,
  });

  const results = data?.items ?? [];

  return (
    <div className="mx-auto max-w-[600px] px-3 py-5 sm:px-5">
      <h1 className="mb-4 text-xl font-extrabold tracking-tight text-slate-900">Discover people</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = term.trim();
          setSubmitted(q);
          setParams(q ? { q } : {});
        }}
        className="relative mb-5"
      >
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by username or name"
          className="input py-3 pl-11 pr-[104px]"
          autoFocus
        />
        <button className="btn btn-primary absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2">
          Search
        </button>
      </form>

      {isFetching && <p className="px-1 text-sm text-slate-400">Searching…</p>}

      {!submitted && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <UsersIcon className="text-2xl" />
          </span>
          <p className="text-sm font-semibold text-slate-700">Find your friends</p>
          <p className="max-w-xs text-sm text-slate-400">
            Search for people by name or @username, then send a friend request from their profile.
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {results.map((u) => (
          <li key={u.id} className="card card-interactive flex items-center gap-3 p-3">
            <img
              src={u.profile_picture_url}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-slate-100"
            />
            <div className="min-w-0 flex-1">
              <Link to={`/users/${u.id}`} className="block truncate text-sm font-bold text-slate-900 hover:underline">
                {u.display_name || u.username}
              </Link>
              <p className="truncate text-xs text-slate-400">@{u.username} · {u.lives_in}</p>
            </div>
            <Link to={`/users/${u.id}`} className="btn btn-soft px-3 py-1.5 text-xs">
              View
            </Link>
          </li>
        ))}
        {data && results.length === 0 && (
          <p className="card p-8 text-center text-sm text-slate-400">
            No users found for “{submitted}”.
          </p>
        )}
      </ul>
    </div>
  );
}
