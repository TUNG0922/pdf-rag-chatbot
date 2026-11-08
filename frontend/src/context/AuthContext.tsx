import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import api, { getToken, setToken, clearToken } from "../services/api";

export interface AuthUser {
  username: string;
  role: "admin" | "user";
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: "admin" | "user";
  expires_in: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<"admin" | "user">;
  register: (
    username: string,
    password: string,
    role: "user" | "admin"
  ) => Promise<"admin" | "user">;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Refresh at half the token lifetime, clamped to a sane range so we neither
// hammer the server nor cut it too close to expiry.
function refreshDelayMs(expiresInSeconds: number): number {
  const half = (expiresInSeconds * 1000) / 2;
  const MIN = 60 * 1000; // at least 1 minute
  const MAX = 30 * 60 * 1000; // at most 30 minutes
  return Math.min(MAX, Math.max(MIN, half));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  // Silently obtain a fresh token and re-arm the timer. On failure (e.g. the
  // session truly expired), stop — the next protected call will route to login.
  const scheduleRefresh = useCallback(
    (expiresInSeconds: number) => {
      clearRefreshTimer();
      refreshTimer.current = setTimeout(async () => {
        try {
          const res = await api.post<TokenResponse>("/auth/refresh");
          setToken(res.data.access_token);
          scheduleRefresh(res.data.expires_in);
        } catch {
          // Could not refresh; let it lapse. Protected requests will 401 and
          // redirect to login via the axios/stream handlers.
          clearRefreshTimer();
        }
      }, refreshDelayMs(expiresInSeconds));
    },
    [clearRefreshTimer]
  );

  // On mount, if a token exists, restore the session and start the refresh
  // cycle (an immediate refresh also extends a token that was near expiry).
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .post<TokenResponse>("/auth/refresh")
      .then((res) => {
        setToken(res.data.access_token);
        setUser({ username: res.data.username, role: res.data.role });
        scheduleRefresh(res.data.expires_in);
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => clearRefreshTimer();
  }, [scheduleRefresh, clearRefreshTimer]);

  const login = useCallback(
    async (username: string, password: string) => {
      // OAuth2PasswordRequestForm expects form-encoded data.
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);

      const res = await api.post<TokenResponse>("/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setToken(res.data.access_token);
      setUser({ username: res.data.username, role: res.data.role });
      scheduleRefresh(res.data.expires_in);
      return res.data.role;
    },
    [scheduleRefresh]
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      role: "user" | "admin"
    ) => {
      // Create the account only. We intentionally do NOT store the token or
      // set the user here, so the person is sent to the login page to sign in
      // explicitly after registering.
      const res = await api.post<TokenResponse>("/auth/register", {
        username,
        password,
        role,
      });
      return res.data.role;
    },
    []
  );

  const logout = useCallback(() => {
    clearRefreshTimer();
    clearToken();
    setUser(null);
  }, [clearRefreshTimer]);

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: user !== null,
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
