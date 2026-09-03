import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { MemeCard } from "./MemeCard";
import type { Meme } from "../types";

const baseMeme: Meme = {
  id: 1,
  title: "test meme",
  description: null,
  like_count: 3,
  comment_count: 1,
  created_at: new Date().toISOString(),
  liked_by_me: false,
  author: {
    id: 9,
    username: "alice",
    display_name: "Alice",
    profile_picture_url: "http://x/a.png",
    lives_in: "Berlin",
    caption: "hi",
    bio: null,
    created_at: new Date().toISOString(),
  },
  media: {
    url: "http://x/m.png",
    media_type: "image",
    mime_type: "image/png",
    width: 8,
    height: 8,
    duration_ms: null,
  },
};

function wrap(meme: Meme) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <MemeCard meme={meme} />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MemeCard", () => {
  it("renders an <img> for image memes with the like count", () => {
    wrap(baseMeme);
    expect(screen.getByRole("img", { name: /test meme/i })).toHaveAttribute(
      "src",
      "http://x/m.png",
    );
    expect(screen.getByRole("button", { name: /3/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders a <video> for video memes", () => {
    const { container } = wrap({
      ...baseMeme,
      media: { ...baseMeme.media, media_type: "video", mime_type: "video/mp4" },
    });
    expect(container.querySelector("video")).toBeInTheDocument();
  });
});
