import type { CSSProperties, ReactNode } from "react";
import { C } from "@/lib/palette";

export const cardStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "0.5px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 14px",
  borderRadius: 8,
  border: "0.5px solid rgba(255,255,255,0.1)",
  background: "#0d0e17",
  fontSize: 13,
  color: "#f0ede8",
  outline: "none",
  boxSizing: "border-box",
};

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...cardStyle, padding: 20, ...style }}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{children}</div>
      {hint && <div style={{ fontSize: 11, color: "#6aaedd", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Button({
  children, onClick, color = C.blue, variant = "solid", disabled, loading, fullWidth, title,
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: string;
  variant?: "solid" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  title?: string;
}) {
  const base: CSSProperties = {
    padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.55 : 1,
    width: fullWidth ? "100%" : undefined,
    border: `0.5px solid ${color}55`,
    transition: "all .15s",
  };
  const style: CSSProperties = variant === "solid"
    ? { ...base, background: color, color: "#0d0e17" }
    : { ...base, background: `${color}18`, color };
  return (
    <button title={title} onClick={onClick} disabled={disabled || loading} style={style}>
      {loading ? "◈ working…" : children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#6aaedd", fontWeight: 600, marginBottom: 4, letterSpacing: ".05em" }}>
        {label.toUpperCase()}
      </div>
      {children}
      {hint && <div style={{ fontSize: 10, color: "#444", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, minHeight: 90, resize: "vertical", ...props.style }} />;
}

export function Pill({ children, color = C.blue }: { children: ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 20,
      background: `${color}22`, color, fontWeight: 700,
      border: `0.5px solid ${color}44`,
    }}>
      {children}
    </span>
  );
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#888" }}>{title}</div>
      {hint && <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.7 }}>{hint}</div>}
    </div>
  );
}