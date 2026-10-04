// src/lib/SupabaseAuthContext.tsx
// Authentication context using Supabase

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "./supabaseClient";

interface User {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface AuthError {
  message: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authChecked: boolean;
  authError: string | null;
  signInWithOAuth: (provider: "google" | "github" | "azure" | "slack" | "twitter" | "facebook" | "apple") => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Silent anonymous sign-in: if there is no session on app start, create an
// anonymous Supabase session so the user never sees a sign-in prompt.
// Module-level promise guards against duplicate calls (e.g. React StrictMode
// running effects twice). Real sign-in paths below are unchanged.
let anonSignInPromise: Promise<void> | null = null;
function ensureAnonymousSession(supabase: Awaited<ReturnType<typeof getSupabaseClient>>): Promise<void> {
  if (!anonSignInPromise) {
    anonSignInPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) console.warn("[Auth] Anonymous sign-in failed:", error.message);
    })().catch((e) => {
      console.warn("[Auth] Anonymous sign-in error:", e);
    });
  }
  return anonSignInPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const supabase = await getSupabaseClient();
        
        // Get initial session
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await ensureAnonymousSession(supabase);
          ({ data: { session } } = await supabase.auth.getSession());
        }
        if (mounted && session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            user_metadata: session.user.user_metadata,
            app_metadata: session.user.app_metadata,
          });
        }
      } catch (e) {
        console.error("[Auth] Init error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;
    (async () => {
      const supabase = await getSupabaseClient();
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            user_metadata: session.user.user_metadata,
            app_metadata: session.user.app_metadata,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      subscription = sub;
    })();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signInWithOAuth = useCallback(async (provider: "google" | "github" | "azure" | "slack" | "twitter" | "facebook" | "apple") => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithOAuth("google");
  }, [signInWithOAuth]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      isLoadingAuth: loading,
      authChecked: !loading,
      authError,
      signInWithOAuth,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      logout,
      resetPassword,
    }}>
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