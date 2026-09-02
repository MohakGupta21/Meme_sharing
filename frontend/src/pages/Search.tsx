import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../api/users";

export function Search() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["user-search", submitted],
    queryFn: () => searchUsers(submitted),
    enabled: submitted.length > 0,
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-3 text-xl font-bold">Find people</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term.trim());
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by username or name"
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {isFetching && <p className="text-sm text-gray-500">Searching…</p>}
      <ul className="space-y-2">
        {data?.items.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-md border bg-white p-3">
            <img
              src={u.profile_picture_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="flex-1">
              <Link to={`/users/${u.id}`} className="text-sm font-medium">
                {u.display_name || u.username}
              </Link>
              <p className="text-xs text-gray-500">@{u.username} · {u.lives_in}</p>
            </div>
          </li>
        ))}
        {data && data.items.length === 0 && (
          <p className="text-sm text-gray-500">No users found.</p>
        )}
      </ul>
    </div>
  );
}
