// src/components/UserNotRegisteredError.tsx
// LifeOS1 — shown when a signed-in user is not on the app's allowlist.

import type { ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UserNotRegisteredErrorProps {
  /** Title shown at the top. Defaults to "Access Restricted". */
  title?: string;
  /** Body copy under the title. */
  message?: ReactNode;
  /** Optional array of suggestions rendered as a bulleted list. */
  suggestions?: string[];
  /** Optional custom illustration; falls back to the built-in warning icon. */
  icon?: ReactNode;
  /** Optional footer slot for a CTA (e.g. a "Sign out" button). */
  footer?: ReactNode;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Default icon
   ═══════════════════════════════════════════════════════════════════════════ */

const DefaultWarningIcon = () => (
  <svg
    className="w-8 h-8 text-orange-600"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Default suggestions
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_SUGGESTIONS = [
  "Verify you are logged in with the correct account",
  "Contact the app administrator for access",
  "Try logging out and back in again",
];

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

const UserNotRegisteredError = ({
  title = "Access Restricted",
  message = "You are not registered to use this application. Please contact the app administrator to request access.",
  suggestions = DEFAULT_SUGGESTIONS,
  icon,
  footer,
}: UserNotRegisteredErrorProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            {icon ?? <DefaultWarningIcon />}
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            {title}
          </h1>

          <p className="text-slate-600 mb-8">{message}</p>

          {suggestions.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600 text-left">
              <p>If you believe this is an error, you can:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;