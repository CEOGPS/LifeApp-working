import { useEffect, useRef, type ReactNode } from "react";

const STORE = "lifeos.pages.v1";

function readAll(): Record<string, Record<string, string>> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function keepable(el: HTMLInputElement | HTMLTextAreaElement) {
  if (el instanceof HTMLTextAreaElement) return true;
  const type = (el.type || "text").toLowerCase();
  return ["text", "search", "email", "tel", "url", "number", "password", "datetime-local"].includes(type);
}

function fieldKey(el: HTMLInputElement | HTMLTextAreaElement, index: number) {
  return `${el.tagName}:${el.getAttribute("type") || "text"}:${el.name || el.getAttribute("placeholder") || el.getAttribute("aria-label") || index}`;
}

export function PageKeep({ page, children }: { page: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fill = () => {
      const saved = readAll()[page] || {};
      const fields = [...root.querySelectorAll("input, textarea")] as Array<HTMLInputElement | HTMLTextAreaElement>;
      fields.forEach((el, index) => {
        if (el.dataset.keep === "off" || !keepable(el) || el.dataset.kept === "1") return;
        const value = saved[fieldKey(el, index)];
        el.dataset.kept = "1";
        if (value == null || el.value === value || el.value) return;
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    fill();
    const observer = new MutationObserver(() => fill());
    observer.observe(root, { childList: true, subtree: true });
    const onInput = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !keepable(el)) return;
      el.dataset.kept = "1";
      const fields = [...root.querySelectorAll("input, textarea")];
      const index = fields.indexOf(el);
      const all = readAll();
      const bag = { ...(all[page] || {}) };
      const keys = Object.keys(bag);
      const key = fieldKey(el, index);
      if (keys.length > 80 && !(key in bag)) delete bag[keys[0]];
      bag[key] = el.value.slice(0, 4000);
      all[page] = bag;
      localStorage.setItem(STORE, JSON.stringify(all));
    };
    root.addEventListener("input", onInput);
    return () => {
      observer.disconnect();
      root.removeEventListener("input", onInput);
    };
  }, [page]);

  return <div ref={ref}>{children}</div>;
}
