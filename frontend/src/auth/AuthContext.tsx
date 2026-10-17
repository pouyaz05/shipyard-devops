import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, clearToken, getToken, saveToken } from "../api/client";
import type { RegisterInput, TokenResponse, User } from "../api/types";
import { fetchMe, updateMyName } from "../api/user";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  updateName: (fullName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getToken);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => getToken() !== null);

  // On app load: if a token exists, validate it (and read the role) with /users/me.
  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.post<TokenResponse>("/auth/login", { email, password });
    saveToken(access_token);
    try {
      const me = await fetchMe();
      setToken(access_token);
      setUser(me);
    } catch (err) {
      clearToken();
      throw err;
    }
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await api.post<unknown>("/auth/register", input);
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const updateName = useCallback(async (fullName: string) => {
    const saved = await updateMyName(fullName);
    setUser((prev) => (prev ? { ...prev, full_name: saved } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout, updateName }),
    [user, token, isLoading, login, register, logout, updateName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
