// src/components/ui/Toaster.tsx
// Toast notification component

import { useToast } from "@/hooks/useToast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 pointer-events-none" style={{ maxWidth: "28rem" }}>
      {toasts.map(({ id, title, description, action, variant }) => (
        <div key={id} className="pointer-events-auto animate-in slide-in-from-bottom-full opacity-0" style={{ opacity: 1 }}>
          <div className={`relative flex items-start gap-3 rounded-lg border p-4 bg-white/5 backdrop-blur-sm border-white/10 ${variant === "destructive" ? "border-red-500/30" : variant === "success" ? "border-green-500/30" : "border-primary/30"}`}>
            <div className="flex-1">
              {title && <h4 className="font-medium text-white">{title}</h4>}
              {description && <p className="text-sm text-white/70 mt-1">{description}</p>}
            </div>
            {action && <div>{action}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ToasterProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}