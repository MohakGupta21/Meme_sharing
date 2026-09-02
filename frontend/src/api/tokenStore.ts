/**
 * Access token lives in memory only; refresh token is persisted so a page
 * reload can recover the session. All localStorage access is guarded — it throws
 * in private-mode / storage-disabled browsers.
 */
const REFRESH_KEY = "memeshare.refresh";

let accessToken: string | null = null;
const listeners = new Set<() => void>();

function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(value: string | null): void {
  try {
    if (value) localStorage.setItem(REFRESH_KEY, value);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable — session is memory-only this run */
  }
}

export const tokenStore = {
  getAccess: () => accessToken,
  getRefresh: readRefresh,
  set(access: string | null, refresh?: string | null) {
    accessToken = access;
    if (refresh !== undefined) writeRefresh(refresh);
    listeners.forEach((l) => l());
  },
  clear() {
    accessToken = null;
    writeRefresh(null);
    listeners.forEach((l) => l());
  },
  /** Notified on every set()/clear(). Returns an unsubscribe fn. */
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
