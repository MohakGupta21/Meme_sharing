import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { tokenStore } from "../api/tokenStore";
import * as authApi from "../api/auth";
import type { UserMe } from "../types";

interface AuthState {
  user: UserMe | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  loginWithTokens: (access: string, refresh: string, user?: UserMe) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      setUser(await authApi.getMe());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // We have a refresh token but no access token after a reload — a call to a
      // protected endpoint triggers the axios refresh interceptor.
      if (tokenStore.getRefresh()) {
        await loadUser();
      }
      setLoading(false);
    })();
  }, [loadUser]);

  // Keep context in sync with the token store: if the axios interceptor clears
  // tokens after a failed refresh, drop the user so the app redirects to /login.
  useEffect(() => {
    return tokenStore.subscribe(() => {
      if (!tokenStore.getRefresh() && !tokenStore.getAccess()) {
        setUser(null);
      }
    });
  }, []);

  const login = useCallback(
    async (emailOrUsername: string, password: string) => {
      const pair = await authApi.login(emailOrUsername, password);
      tokenStore.set(pair.access_token, pair.refresh_token);
      await loadUser();
    },
    [loadUser],
  );

  const loginWithTokens = useCallback(
    async (access: string, refresh: string, u?: UserMe) => {
      tokenStore.set(access, refresh);
      if (u) setUser(u);
      else await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        /* ignore */
      }
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      loginWithTokens,
      logout,
      refreshUser: loadUser,
    }),
    [user, loading, login, loginWithTokens, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
