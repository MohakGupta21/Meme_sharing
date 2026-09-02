import { useInfiniteQuery } from "@tanstack/react-query";
import { getFeed, getUserMemes } from "../api/memes";
import type { Meme, Page } from "../types";

export function useInfiniteFeed() {
  return useInfiniteQuery<Page<Meme>>({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => getFeed(pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useUserMemes(userId: number) {
  return useInfiniteQuery<Page<Meme>>({
    queryKey: ["user-memes", userId],
    queryFn: ({ pageParam }) => getUserMemes(userId, pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}
