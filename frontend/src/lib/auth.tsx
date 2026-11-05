import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, restoreSession, setAccessToken, send } from "./api";
import type { User } from "./types";
interface Auth {
  user: User | null;
  loading: boolean;
  authenticate: (mode: "login" | "register", data: unknown) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}
const AuthContext = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    restoreSession()
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));
    const expire = () => setUser(null);
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function authenticate(mode: "login" | "register", data: unknown) {
    const response = await send<{ user: User; access_token: string }>(
      `/auth/${mode}`,
      "POST",
      data,
    );
    setAccessToken(response.access_token);
    setUser(response.user);
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }
  useEffect(() => {
    const preference = user?.theme || "dark";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.classList.toggle(
        "light",
        preference === "light" || (preference === "system" && !media.matches),
      );
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [user?.theme]);
  return (
    <AuthContext.Provider
      value={{ user, loading, authenticate, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
