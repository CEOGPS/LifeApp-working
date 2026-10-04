// React is provided by the application's runtime when dependencies are installed.
// @ts-ignore React is supplied by the application's runtime.
import {
  createContext,
  createElement,
  useContext,
  useState,
  useEffect,
  // @ts-ignore React is supplied by the application's runtime.
} from "react";
// @ts-ignore React types are supplied by the application's runtime.
import type { ReactNode } from "react";

interface User {
  id: string;
  email: string;
  displayName?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stub: replace with real Firebase auth listener
    setLoading(false);
  }, []);

  const signIn = async () => {}; // placeholder
  const signOut = async () => {};

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, signIn, signOut } },
    children,
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};