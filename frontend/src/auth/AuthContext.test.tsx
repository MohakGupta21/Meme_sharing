import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";
import { tokenStore } from "../api/tokenStore";
import { server } from "../test/mswServer";

const API = "http://localhost:8000/api/v1";

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `user:${user.username}` : "anon"}</div>;
}

describe("AuthContext ↔ tokenStore sync", () => {
  it("drops the user when the token store is cleared (e.g. failed refresh)", async () => {
    const me = {
      id: 1,
      username: "alice",
      display_name: null,
      profile_picture_url: "x",
      lives_in: "B",
      caption: "c",
      bio: null,
      created_at: new Date().toISOString(),
      email: "a@a.com",
      meme_count: 0,
      friend_count: 0,
    };
    server.use(http.get(`${API}/users/me`, () => HttpResponse.json(me)));
    tokenStore.set("access-token", "refresh-token");

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("user:alice")).toBeInTheDocument());

    tokenStore.clear();

    await waitFor(() => expect(screen.getByText("anon")).toBeInTheDocument());
  });
});
