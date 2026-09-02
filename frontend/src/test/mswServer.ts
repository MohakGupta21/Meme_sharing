import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const API = "http://localhost:8000/api/v1";

export const handlers = [
  http.get(`${API}/memes/feed`, () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get(`${API}/users/me`, () => HttpResponse.json({ detail: "unauthorized" }, { status: 401 })),
];

export const server = setupServer(...handlers);
