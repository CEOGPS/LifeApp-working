import { useEffect, useState } from "react";

const USER_EMAIL_KEY = "userEmail";

export function getCurrentUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_EMAIL_KEY);
}

export function persistUserEmail(email: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_EMAIL_KEY, email);
  }
}

export function clearUserEmail(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(USER_EMAIL_KEY);
  }
}

export function useUserEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(getCurrentUserEmail());
  }, []);

  return email;
}