import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  reportQuota: number;
  reportUsed: number;
  preferredLlm: string | null;
  loginMethod: string | null;
  lastSignedIn: Date | null;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: user, isLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000, // 5分钟
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setIsLoggingOut(false);
      window.location.href = "/login";
    },
    onError: () => {
      setIsLoggingOut(false);
    },
  });

  const logout = () => {
    setIsLoggingOut(true);
    logoutMutation.mutate();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user as User | null,
        isLoading: isLoading || isLoggingOut,
        isAuthenticated: !!user,
        logout,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// 获取登录URL（用于OAuth登录）
export function getLoginUrl(redirectTo?: string): string {
  const appId = import.meta.env.VITE_APP_ID;
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const currentUrl = redirectTo || window.location.href;
  const state = btoa(currentUrl);
  return `${portalUrl}?client_id=${appId}&state=${state}`;
}
