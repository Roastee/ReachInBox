import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, isApiConfigured } from "../lib/api";
import type { User } from "../types";

const PREVIEW_KEY = "reachinbox.preview";

const previewUser: User = {
  id: "preview-user",
  name: "Preview User",
  email: "preview@reachinbox.local",
  initials: "PU",
};

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isPreview: boolean;
  loginAsPreview: () => void;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const demoEnabled = import.meta.env.VITE_DEMO_MODE === "true";
  const [user, setUser] = useState<User | null>(() => (demoEnabled && window.localStorage.getItem(PREVIEW_KEY) === "true" ? previewUser : null));
  const [isPreview, setIsPreview] = useState(demoEnabled && window.localStorage.getItem(PREVIEW_KEY) === "true");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const optedIntoPreview = demoEnabled && window.localStorage.getItem(PREVIEW_KEY) === "true";

    async function restoreSession() {
      if (optedIntoPreview || !isApiConfigured) {
        if (active) setIsLoading(false);
        return;
      }

      try {
        const remoteUser = await api.getCurrentUser();
        if (active) {
          setUser(remoteUser);
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, [demoEnabled]);

  const loginAsPreview = useCallback(() => {
    setUser(previewUser);
    setIsPreview(true);
    window.localStorage.setItem(PREVIEW_KEY, "true");
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!isApiConfigured) throw new Error("Connect the ReachInbox API before signing in.");
    const authenticatedUser = await api.login(email, password);
    setUser(authenticatedUser);
    setIsPreview(false);
    window.localStorage.removeItem(PREVIEW_KEY);
    return authenticatedUser;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    if (!isApiConfigured) throw new Error("Connect the ReachInbox API before creating an account.");
    const authenticatedUser = await api.register(name, email, password);
    setUser(authenticatedUser);
    setIsPreview(false);
    window.localStorage.removeItem(PREVIEW_KEY);
    return authenticatedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (!isPreview && isApiConfigured) await api.logout();
    } finally {
      setUser(null);
      setIsPreview(false);
      window.localStorage.removeItem(PREVIEW_KEY);
    }
  }, [isPreview]);

  const value = useMemo(
    () => ({ user, isLoading, isPreview, loginAsPreview, login, register, logout }),
    [user, isLoading, isPreview, loginAsPreview, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
