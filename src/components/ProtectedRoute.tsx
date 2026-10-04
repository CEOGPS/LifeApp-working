// src/components/ProtectedRoute.tsx
// LifeOS1 — client-side route guard.
// Consumes the canonical auth source: @/lib/SupabaseAuthContext.

import { type ReactNode } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/SupabaseAuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   Default fallback — full-screen spinner shown while auth is being checked
   ═══════════════════════════════════════════════════════════════════════════ */

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Verifying credentials...</p>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ProtectedRouteProps {
  /** Shown while the auth check is in flight. */
  fallback?: ReactNode;
  /** Rendered when the user is not authenticated. Defaults to a redirect to /login. */
  unauthenticatedElement?: ReactNode;
  /** Optional custom renderer for authError. If provided, takes precedence. */
  renderAuthError?: (error: string) => ReactNode;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

const ProtectedRoute = ({
  fallback = <DefaultFallback />,
  unauthenticatedElement = <Navigate to="/login" replace />,
  renderAuthError,
}: ProtectedRouteProps) => {
  const {
    isAuthenticated,
    isLoadingAuth,
    authChecked,
    authError,
  } = useAuth();

  // Still checking — show the fallback.
  if (isLoadingAuth || !authChecked) {
    return <>{fallback}</>;
  }

  // The auth provider returned an error.
  if (authError) {
    // Caller-provided error renderer takes precedence.
    if (renderAuthError) {
      return <>{renderAuthError(authError)}</>;
    }

    // Built-in default for the "user not registered" case.
    if (authError === "user_not_registered") {
      return (
        <div className="flex h-screen items-center justify-center text-white bg-slate-950">
          User not registered. Please contact support.
        </div>
      );
    }

    // Any other error: fall through to the caller's unauthenticated element.
    return <>{unauthenticatedElement}</>;
  }

  // Not signed in.
  if (!isAuthenticated) {
    return <>{unauthenticatedElement}</>;
  }

  // Signed in — render children routes.
  return <Outlet />;
};

export default ProtectedRoute;