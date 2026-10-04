// src/panels/VaultPanel.tsx
// LifeOS1 — Privacy Vault Panel (Batch 5)
// Path B: real CRUD against Worker /api/vault/*.
// Crypto is server-side; panel holds decrypted values only in memory while unlocked.
// No secret values are ever persisted to localStorage, sessionStorage, or IndexedDB.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Lock, Unlock, Key, ShieldCheck, FileText, Image as ImageIcon, Search,
  Upload, Plus, Trash2, Eye, EyeOff, Copy, Download, Star, Pencil, X,
  Loader2, AlertCircle, CheckCircle, Info, RefreshCw, ChevronDown,
  ChevronUp, CreditCard, IdCard, Code, Server, Cpu, Save,
} from "lucide-react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { lifeosApi } from "@/lib/lifeosApi";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type VaultKind = "password" | "note" | "card" | "identity" | "file" | "ssh" | "api" | "crypto";

interface VaultItemMeta {
  id: string;
  kind: VaultKind;
  name: string;
  data_preview: Record<string, unknown>;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface VaultItemFull extends VaultItemMeta {
  data: Record<string, unknown>;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const KINDS: { id: VaultKind; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "password", label: "Passwords",    icon: <Key size={12} />,         color: "#4ab3f4" },
  { id: "note",     label: "Secure Notes", icon: <FileText size={12} />,    color: "#ffb347" },
  { id: "card",     label: "Cards",        icon: <CreditCard size={12} />,  color: "#00c896" },
  { id: "identity", label: "Identities",   icon: <IdCard size={12} />,      color: "#8b7fff" },
  { id: "file",     label: "Files",        icon: <ImageIcon size={12} />,   color: "#5ab0e0" },
  { id: "ssh",      label: "SSH Keys",     icon: <Server size={12} />,      color: "#7a9ac4" },
  { id: "api",      label: "API Keys",     icon: <Code size={12} />,        color: "#7ccf9a" },
  { id: "crypto",   label: "Crypto",       icon: <Cpu size={12} />,         color: "#e0b477" },
];

const LS = {
  tab:             "lifeos_vault_tab",
  search:          "lifeos_vault_search",
  sort:            "lifeos_vault_sort",
  clipAutoClear:   "lifeos_vault_clip_autoclear",
  revealDefault:   "lifeos_vault_reveal_default",
  blurLock:        "lifeos_vault_blur_lock",
  idleLockMin:     "lifeos_vault_idle_lock_min",
  metaCache:       "lifeos_vault_meta_cache",
};

const TOAST_MS = 4200;
const CLIP_CLEAR_MS = 30_000;
const IDLE_CHECK_MS = 30_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function maskValue(_v: string): string {
  return "••••••••••••";
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // fallback for older browsers / non-secure contexts
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      resolve();
    } catch (e) { reject(e); }
  });
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function VaultPanel() {
  /* ---------- persisted UI prefs ---------- */
  const [tab, setTab] = useState<"all" | VaultKind | "settings">(() => lsGet(LS.tab, "all"));
  const [searchRaw, setSearchRaw] = useState<string>(() => lsGet(LS.search, ""));
  const [search, setSearch] = useState(searchRaw);
  const [sort, setSort] = useState<"updated" | "name" | "kind">(() => lsGet(LS.sort, "updated"));

  const [clipAutoClear, setClipAutoClear]   = useState<boolean>(() => lsGet(LS.clipAutoClear, true));
  const [revealDefault, setRevealDefault]   = useState<boolean>(() => lsGet(LS.revealDefault, false));
  const [blurLock, setBlurLock]             = useState<boolean>(() => lsGet(LS.blurLock, false));
  const [idleLockMin, setIdleLockMin]       = useState<number>(() => lsGet(LS.idleLockMin, 15));

  useEffect(() => lsSet(LS.tab, tab), [tab]);
  useEffect(() => lsSet(LS.search, searchRaw), [searchRaw]);
  useEffect(() => lsSet(LS.sort, sort), [sort]);
  useEffect(() => lsSet(LS.clipAutoClear, clipAutoClear), [clipAutoClear]);
  useEffect(() => lsSet(LS.revealDefault, revealDefault), [revealDefault]);
  useEffect(() => lsSet(LS.blurLock, blurLock), [blurLock]);
  useEffect(() => lsSet(LS.idleLockMin, idleLockMin), [idleLockMin]);

  // 200ms debounce on search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  /* ---------- vault lock state ---------- */
  const [locked, setLocked] = useState(true);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [vaultToken, setVaultToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);

  // Decrypted values held in memory only while unlocked.
  // key = item id; value = { [field]: string }
  const [decrypted, setDecrypted] = useState<Record<string, Record<string, unknown>>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // Wipe secrets from memory when locking
  const hardLock = useCallback(() => {
    setLocked(true);
    setVaultToken(null);
    setTokenExpiresAt(null);
    setDecrypted({});
    setRevealed({});
    setEditingId(null);
    setEditDraft(null);
    setAddDraft(null);
  }, []);

  /* ---------- items (metadata only) ---------- */
  const [items, setItems] = useState<VaultItemMeta[]>(() => {
    // Show cached metadata while loading; never cached secrets.
    const cached = lsGet<VaultItemMeta[]>(LS.metaCache, []);
    return Array.isArray(cached) ? cached : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- reveal one ---------- */
  const [revealingId, setRevealingId] = useState<string | null>(null);

  /* ---------- modals / inline forms ---------- */
  const [addDraft, setAddDraft] = useState<{ kind: VaultKind; name: string; fields: Record<string, string>; favorite: boolean } | null>(null);
  const [editDraft, setEditDraft] = useState<{ id: string; kind: VaultKind; name: string; fields: Record<string, string>; favorite: boolean } | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  /* ---------- edit state for inline item name rename ---------- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  /* ---------- toasts ---------- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  /* ---------- clipboard auto-clear ---------- */
  const clipTimerRef = useRef<number | null>(null);
  const copyAndMaybeClear = useCallback(async (text: string, label: string) => {
    try {
      await copyText(text);
      if (clipAutoClear) {
        if (clipTimerRef.current) window.clearTimeout(clipTimerRef.current);
        clipTimerRef.current = window.setTimeout(async () => {
          try { await copyText(""); } catch { /* ignore */ }
        }, CLIP_CLEAR_MS);
        pushToast("success", `${label} copied — clipboard clears in 30s`);
      } else {
        pushToast("success", `${label} copied`);
      }
    } catch {
      pushToast("error", "Clipboard blocked by browser");
    }
  }, [clipAutoClear, pushToast]);

  /* ---------- fetch items ---------- */
  const abortRef = useRef<AbortController | null>(null);
  const loadItems = useCallback(async () => {
    if (!vaultToken) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await lifeosApi<{ items: VaultItemMeta[] }>("/api/vault/items", {
        signal: ac.signal,
        headers: { Authorization: `Bearer ${vaultToken}` },
      });
      if (ac.signal.aborted) return;
      const list = res.items || [];
      setItems(list);
      // Cache only metadata, never secrets.
      lsSet(LS.metaCache, list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (e?.status === 401) { hardLock(); pushToast("info", "Vault session expired — unlock again"); return; }
      setError(e?.message || "Failed to load vault items");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [vaultToken, hardLock, pushToast]);

  useEffect(() => { if (vaultToken) loadItems(); }, [vaultToken, loadItems]);

  /* ---------- first-time vs existing ---------- */
  const detectFirstTime = useCallback(async () => {
    try {
      const res = await lifeosApi<{ initialized: boolean }>("/api/vault/status");
      setIsFirstTime(!res.initialized);
    } catch {
      // If the route isn't available yet, be honest: assume initialized (require password).
      setIsFirstTime(false);
    }
  }, []);
  useEffect(() => { detectFirstTime(); }, [detectFirstTime]);

  /* ---------- unlock ---------- */
  const doUnlock = useCallback(async () => {
    if (masterPassword.length < 8) { pushToast("error", "Master password must be at least 8 characters"); return; }
    if (isFirstTime && masterPassword !== confirmPassword) { pushToast("error", "Passwords do not match"); return; }
    setUnlocking(true);
    try {
      const res = await lifeosApi<{ token: string; expires_at: number }>(
        isFirstTime ? "/api/vault/init" : "/api/vault/unlock",
        { method: "POST", body: JSON.stringify({ master_password: masterPassword }) },
      );
      if (!res.token) throw new Error("No vault token returned");
      setVaultToken(res.token);
      setTokenExpiresAt(res.expires_at || null);
      setLocked(false);
      setMasterPassword("");
      setConfirmPassword("");
      pushToast("success", isFirstTime ? "Vault created" : "Vault unlocked");
    } catch (e: any) {
      const msg = e?.status === 401 ? "Wrong master password" : (e?.message || "Unlock failed");
      pushToast("error", msg);
    } finally {
      setUnlocking(false);
    }
  }, [masterPassword, confirmPassword, isFirstTime, pushToast]);

  const doLock = useCallback(async () => {
    try { await lifeosApi("/api/vault/lock", { method: "POST", headers: { Authorization: `Bearer ${vaultToken}` } }); }
    catch { /* ignore — lock is best-effort server-side; local wipe is the real lock */ }
    hardLock();
    pushToast("info", "Vault locked");
  }, [vaultToken, hardLock, pushToast]);

  /* ---------- blur / idle auto-lock ---------- */
  useEffect(() => {
    if (locked || !blurLock) return;
    const onBlur = () => { void doLock(); };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [locked, blurLock, doLock]);

  const lastActiveRef = useRef(Date.now());
  useEffect(() => {
    if (locked || !idleLockMin) return;
    const reset = () => { lastActiveRef.current = Date.now(); };
    ["mousemove", "keydown", "click", "touchstart"].forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    const tick = window.setInterval(() => {
      if (Date.now() - lastActiveRef.current >= idleLockMin * 60_000) void doLock();
    }, IDLE_CHECK_MS);
    return () => {
      ["mousemove", "keydown", "click", "touchstart"].forEach((ev) => window.removeEventListener(ev, reset));
      window.clearInterval(tick);
    };
  }, [locked, idleLockMin, doLock]);

  /* ---------- Esc closes modals ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmPurge) setConfirmPurge(false);
      else if (confirmDeleteId) setConfirmDeleteId(null);
      else if (editDraft) setEditDraft(null);
      else if (addDraft) setAddDraft(null);
      else if (editingId) { setEditingId(null); setEditingName(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmPurge, confirmDeleteId, editDraft, addDraft, editingId]);

  /* ---------- derived list ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items.filter((it) => {
      const matchesTab = tab === "all" || tab === "settings" || it.kind === tab;
      if (!matchesTab) return false;
      if (!q) return true;
      const hay = [it.name, ...Object.values(it.data_preview || {}).map((v) => String(v))].join(" ").toLowerCase();
      return hay.includes(q);
    });
    out = out.slice();
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "kind") out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    else out.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    return out;
  }, [items, tab, search, sort]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items.length };
    for (const k of KINDS) m[k.id] = items.filter((i) => i.kind === k.id).length;
    return m;
  }, [items]);

  /* ---------- reveal ---------- */
  const revealItem = useCallback(async (id: string) => {
    if (decrypted[id]) return; // already in memory
    setRevealingId(id);
    try {
      const res = await lifeosApi<{ data: Record<string, unknown> }>(
        `/api/vault/items/${id}/reveal`,
        { headers: { Authorization: `Bearer ${vaultToken}` } },
      );
      setDecrypted((d) => ({ ...d, [id]: res.data || {} }));
      if (revealDefault) setRevealed((r) => ({ ...r, [id]: true }));
    } catch (e: any) {
      if (e?.status === 401) { hardLock(); pushToast("info", "Vault session expired"); return; }
      pushToast("error", e?.message || "Failed to reveal item");
    } finally {
      setRevealingId(null);
    }
  }, [decrypted, vaultToken, revealDefault, hardLock, pushToast]);

  const toggleReveal = useCallback(async (id: string) => {
    if (!decrypted[id]) await revealItem(id);
    setRevealed((r) => ({ ...r, [id]: !r[id] }));
  }, [decrypted, revealItem]);

  /* ---------- add / edit ---------- */
  const blankFieldsFor = (kind: VaultKind): Record<string, string> => {
    switch (kind) {
      case "password": return { username: "", password: "", url: "", notes: "" };
      case "note":     return { content: "" };
      case "card":     return { number: "", expiry: "", cvv: "", holder: "", brand: "" };
      case "identity": return { full_name: "", dob: "", id_number: "", country: "", notes: "" };
      case "file":     return { filename: "", mime: "", size: "", url: "", notes: "" };
      case "ssh":      return { private_key: "", public_key: "", host: "", user: "" };
      case "api":      return { service: "", key: "", url: "", notes: "" };
      case "crypto":   return { chain: "", address: "", seed: "", notes: "" };
    }
  };

  const openAdd = useCallback((kind: VaultKind) => {
    setAddDraft({ kind, name: "", fields: blankFieldsFor(kind), favorite: false });
  }, []);

  const openEdit = useCallback(async (it: VaultItemMeta) => {
    // Need decrypted fields to edit properly
    if (!decrypted[it.id]) await revealItem(it.id);
    const data = decrypted[it.id] || await (async () => {
      // If reveal just finished, state may not have flushed; refetch once
      try {
        const res = await lifeosApi<{ data: Record<string, unknown> }>(
          `/api/vault/items/${it.id}/reveal`,
          { headers: { Authorization: `Bearer ${vaultToken}` } },
        );
        setDecrypted((d) => ({ ...d, [it.id]: res.data || {} }));
        return res.data || {};
      } catch { return {}; }
    })();
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) flat[k] = v == null ? "" : String(v);
    setEditDraft({ id: it.id, kind: it.kind, name: it.name, fields: flat, favorite: it.favorite });
  }, [decrypted, revealItem, vaultToken]);

  const buildPreview = (kind: VaultKind, fields: Record<string, string>): Record<string, unknown> => {
    // Only non-secret fields go into the preview, so the list can render
    // without decrypting every item.
    switch (kind) {
      case "password": return { username: fields.username || "", url: fields.url || "" };
      case "note":     return {};
      case "card":     return { brand: fields.brand || "", last4: (fields.number || "").replace(/\D/g, "").slice(-4) };
      case "identity": return { full_name: fields.full_name || "", country: fields.country || "" };
      case "file":     return { filename: fields.filename || "", mime: fields.mime || "" };
      case "ssh":      return { host: fields.host || "", user: fields.user || "" };
      case "api":      return { service: fields.service || "", url: fields.url || "" };
      case "crypto":   return { chain: fields.chain || "", address: fields.address || "" };
    }
  };

  const saveNew = useCallback(async () => {
    if (!addDraft) return;
    if (!addDraft.name.trim()) { pushToast("error", "Name is required"); return; }
    setSavingItem(true);
    try {
      const body = {
        kind: addDraft.kind,
        name: addDraft.name.trim(),
        data: addDraft.fields,
        data_preview: buildPreview(addDraft.kind, addDraft.fields),
        favorite: addDraft.favorite,
      };
      await lifeosApi("/api/vault/items", {
        method: "POST",
        headers: { Authorization: `Bearer ${vaultToken}` },
        body: JSON.stringify(body),
      });
      pushToast("success", "Item saved");
      setAddDraft(null);
      await loadItems();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to save item");
    } finally {
      setSavingItem(false);
    }
  }, [addDraft, vaultToken, loadItems, pushToast]);

  const saveEdit = useCallback(async () => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) { pushToast("error", "Name is required"); return; }
    setSavingItem(true);
    try {
      const body = {
        name: editDraft.name.trim(),
        data: editDraft.fields,
        data_preview: buildPreview(editDraft.kind, editDraft.fields),
        favorite: editDraft.favorite,
      };
      await lifeosApi(`/api/vault/items/${editDraft.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${vaultToken}` },
        body: JSON.stringify(body),
      });
      // Update decrypted cache so the card reflects the new values without a re-reveal
      setDecrypted((d) => ({ ...d, [editDraft.id]: { ...editDraft.fields } }));
      pushToast("success", "Item updated");
      setEditDraft(null);
      await loadItems();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to update item");
    } finally {
      setSavingItem(false);
    }
  }, [editDraft, vaultToken, loadItems, pushToast]);

  const renameItem = useCallback(async (id: string, name: string) => {
    const clean = name.trim();
    if (!clean) { setEditingId(null); return; }
    try {
      await lifeosApi(`/api/vault/items/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${vaultToken}` },
        body: JSON.stringify({ name: clean }),
      });
      setEditingId(null);
      setEditingName("");
      await loadItems();
    } catch (e: any) {
      pushToast("error", e?.message || "Rename failed");
    }
  }, [vaultToken, loadItems, pushToast]);

  const toggleFavorite = useCallback(async (it: VaultItemMeta) => {
    try {
      await lifeosApi(`/api/vault/items/${it.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${vaultToken}` },
        body: JSON.stringify({ favorite: !it.favorite }),
      });
      await loadItems();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to toggle favorite");
    }
  }, [vaultToken, loadItems, pushToast]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await lifeosApi(`/api/vault/items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${vaultToken}` },
      });
      setDecrypted((d) => { const c = { ...d }; delete c[id]; return c; });
      setRevealed((r) => { const c = { ...r }; delete c[id]; return c; });
      setConfirmDeleteId(null);
      pushToast("success", "Item deleted");
      await loadItems();
    } catch (e: any) {
      pushToast("error", e?.message || "Delete failed");
    }
  }, [vaultToken, loadItems, pushToast]);

  /* ---------- change password / purge / export ---------- */
  const [pwModal, setPwModal] = useState<{ old: string; next: string; next2: string } | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const changePassword = useCallback(async () => {
    if (!pwModal) return;
    if (pwModal.next.length < 8) { pushToast("error", "New password must be at least 8 characters"); return; }
    if (pwModal.next !== pwModal.next2) { pushToast("error", "New passwords do not match"); return; }
    setChangingPw(true);
    try {
      await lifeosApi("/api/vault/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password: pwModal.old, new_password: pwModal.next }),
      });
      pushToast("success", "Master password changed — session invalidated, please unlock again");
      setPwModal(null);
      hardLock();
    } catch (e: any) {
      pushToast("error", e?.status === 401 ? "Old password is wrong" : (e?.message || "Change failed"));
    } finally {
      setChangingPw(false);
    }
  }, [pwModal, hardLock, pushToast]);

  const purgeAll = useCallback(async () => {
    try {
      await lifeosApi("/api/vault/purge", {
        method: "POST",
        headers: { Authorization: `Bearer ${vaultToken}` },
        body: JSON.stringify({ confirm: "PURGE" }),
      });
      setConfirmPurge(false);
      setDecrypted({});
      setRevealed({});
      pushToast("success", "All vault items purged");
      await loadItems();
    } catch (e: any) {
      pushToast("error", e?.message || "Purge failed");
    }
  }, [vaultToken, loadItems, pushToast]);

  const exportVault = useCallback(async () => {
    try {
      const res = await lifeosApi<{ blob: string }>("/api/vault/export", {
        method: "POST",
        headers: { Authorization: `Bearer ${vaultToken}` },
      });
      const blob = new Blob([res.blob], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeos-vault-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      pushToast("success", "Encrypted backup downloaded");
    } catch (e: any) {
      pushToast("error", e?.message || "Export failed");
    }
  }, [vaultToken, pushToast]);

  const exportCsv = useCallback(() => {
    // CSV of metadata only — NEVER secrets.
    const rows = filtered.map((it) => ({
      id: it.id,
      kind: it.kind,
      name: it.name,
      favorite: it.favorite ? "yes" : "no",
      updated_at: it.updated_at,
      preview: JSON.stringify(it.data_preview || {}),
    }));
    if (!rows.length) { pushToast("info", "Nothing to export"); return; }
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => {
      const v = String(r[c as keyof typeof r] ?? "");
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-vault-metadata-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    pushToast("success", `Exported ${rows.length} item metadata rows (no secrets)`);
  }, [filtered, pushToast]);

  /* ---------- render ---------- */

  /* ================= LOCKED STATE ================= */
  if (locked) {
    return (
      <PanelLayout
        title="Privacy Vault"
        subtitle="Password safe, API keys, private documents and photos — eyes only"
        icon={<ShieldCheck size={18} />}
      >
        <div className="flex items-center justify-center py-12">
          <div className="glass rounded-xl border border-white/8 p-8 text-center max-w-md w-full">
            <div className="w-16 h-16 rounded-full glass-crimson flex items-center justify-center mx-auto mb-4 glow-crimson">
              <Lock size={28} className="text-primary/80" />
            </div>
            <div className="text-base font-display text-white/85 tracking-wider mb-1">
              {isFirstTime ? "Create Your Vault" : "Vault Locked"}
            </div>
            <div className="text-xs mb-5" style={{ color: "oklch(0.75 0.15 175 / 70%)" }}>
              {isFirstTime
                ? "Choose a master password. It cannot be recovered — write it down somewhere safe."
                : "Enter your master password to unlock."}
            </div>

            <input
              autoFocus
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (isFirstTime && !confirmPassword) return;
                void doUnlock();
              }}
              placeholder="Master password"
              className="w-full h-10 px-3 text-sm rounded-lg bg-white/4 border border-white/8 text-white/85 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
            />

            {isFirstTime && (
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void doUnlock(); }}
                placeholder="Confirm master password"
                className="w-full h-10 px-3 text-sm rounded-lg bg-white/4 border border-white/8 text-white/85 placeholder:text-white/30 focus:outline-none focus:border-primary/40 mt-2"
              />
            )}

            <button
              onClick={doUnlock}
              disabled={unlocking || masterPassword.length < 8}
              className="w-full mt-4 py-2.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {unlocking ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
              {unlocking ? "VERIFYING…" : isFirstTime ? "CREATE VAULT" : "UNLOCK VAULT"}
            </button>

            <div className="mt-6 pt-5 border-t border-white/5 text-left">
              <div className="text-[9px] font-display tracking-widest text-white/30 mb-2">
                ENCRYPTION
              </div>
              <ul className="text-[10px] text-white/45 space-y-1 leading-relaxed">
                <li>• AES-256-GCM per item</li>
                <li>• PBKDF2-SHA256 master key (250k iterations)</li>
                <li>• Secrets never written to localStorage</li>
                <li>• Session token expires on lock / idle / blur</li>
              </ul>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }

  /* ================= UNLOCKED STATE ================= */
  return (
    <PanelLayout
      title="Privacy Vault"
      subtitle="Password safe, API keys, private documents and photos — eyes only"
      icon={<Unlock size={18} />}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={doLock}
            className="p-1.5 rounded-lg glass border border-white/8 text-white/60 hover:text-red-400"
            title="Lock vault"
          >
            <Lock size={12} />
          </button>
          <button
            onClick={() => openAdd((tab === "all" || tab === "settings") ? "password" : tab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm"
          >
            <Plus size={12} /> ADD
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* ---------- ERROR ---------- */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={loadItems} className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display">
              RETRY
            </button>
          </div>
        )}

        {/* ---------- TABS ---------- */}
        <div className="glass rounded-xl border border-white/8 p-1 flex gap-1 overflow-x-auto">
          <button
            onClick={() => setTab("all")}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-display transition-colors
              ${tab === "all" ? "glass-crimson text-primary" : "text-white/50 hover:text-white/80"}`}
          >
            ALL <span className="ml-1 text-white/40">{counts.all}</span>
          </button>
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setTab(k.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-display transition-colors
                ${tab === k.id ? "glass-crimson text-primary" : "text-white/50 hover:text-white/80"}`}
            >
              <span style={{ color: tab === k.id ? undefined : k.color }}>{k.icon}</span>
              {k.label.toUpperCase()}
              <span className="text-white/40">{counts[k.id] || 0}</span>
            </button>
          ))}
          <button
            onClick={() => setTab("settings")}
            className={`shrink-0 ml-auto px-3 py-1.5 rounded-lg text-[10px] font-display transition-colors
              ${tab === "settings" ? "glass-crimson text-primary" : "text-white/50 hover:text-white/80"}`}
          >
            SETTINGS
          </button>
        </div>

        {/* ---------- TOOLBAR ---------- */}
        {tab !== "settings" && (
          <div className="glass rounded-xl border border-white/8 p-2 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-45">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder="Search vault…"
                className="w-full h-8 pl-7 pr-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 placeholder:text-white/25 focus:outline-none"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
            >
              <option value="updated" style={{ background: "#0a0a0a" }}>Recently updated</option>
              <option value="name" style={{ background: "#0a0a0a" }}>Name (A–Z)</option>
              <option value="kind" style={{ background: "#0a0a0a" }}>Kind</option>
            </select>
            <button
              onClick={exportCsv}
              title="Export metadata CSV (no secrets)"
              className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary"
            >
              <Download size={11} />
            </button>
            <button
              onClick={loadItems}
              title="Reload"
              className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        )}

        {/* ---------- SETTINGS TAB ---------- */}
        {tab === "settings" && (
          <div className="flex flex-col gap-3">
            <div className="glass rounded-xl border border-white/8 p-3">
              <div className="text-[10px] font-display tracking-widest mb-2" style={{ color: "hsl(var(--teal))" }}>
                VAULT SETTINGS
              </div>

              <label className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <div className="text-[11px] text-white/75">Lock on window blur</div>
                  <div className="text-[9px] text-white/40">Lock the moment you switch tabs/apps</div>
                </div>
                <input type="checkbox" checked={blurLock} onChange={(e) => setBlurLock(e.target.checked)} className="accent-primary" />
              </label>

              <label className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <div className="text-[11px] text-white/75">Idle auto-lock</div>
                  <div className="text-[9px] text-white/40">Lock after this many minutes of no input</div>
                </div>
                <select
                  value={idleLockMin}
                  onChange={(e) => setIdleLockMin(Number(e.target.value))}
                  className="h-7 px-2 text-[11px] rounded bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                >
                  <option value={0} style={{ background: "#0a0a0a" }}>Never</option>
                  <option value={5} style={{ background: "#0a0a0a" }}>5 min</option>
                  <option value={15} style={{ background: "#0a0a0a" }}>15 min</option>
                  <option value={30} style={{ background: "#0a0a0a" }}>30 min</option>
                  <option value={60} style={{ background: "#0a0a0a" }}>1 hour</option>
                </select>
              </label>

              <label className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <div className="text-[11px] text-white/75">Reveal secrets by default</div>
                  <div className="text-[9px] text-white/40">Show values without an extra click</div>
                </div>
                <input type="checkbox" checked={revealDefault} onChange={(e) => setRevealDefault(e.target.checked)} className="accent-primary" />
              </label>

              <label className="flex items-center justify-between py-2">
                <div>
                  <div className="text-[11px] text-white/75">Clipboard auto-clear</div>
                  <div className="text-[9px] text-white/40">Wipe clipboard 30s after copying a secret</div>
                </div>
                <input type="checkbox" checked={clipAutoClear} onChange={(e) => setClipAutoClear(e.target.checked)} className="accent-primary" />
              </label>
            </div>

            <div className="glass rounded-xl border border-white/8 p-3">
              <div className="text-[10px] font-display tracking-widest mb-2" style={{ color: "hsl(var(--teal))" }}>
                MASTER PASSWORD & BACKUP
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPwModal({ old: "", next: "", next2: "" })}
                  className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/70 hover:text-primary text-[11px] font-display"
                >
                  CHANGE MASTER PASSWORD
                </button>
                <button
                  onClick={exportVault}
                  className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/70 hover:text-primary text-[11px] font-display flex items-center gap-1"
                >
                  <Download size={11} /> EXPORT ENCRYPTED BACKUP
                </button>
                <button
                  disabled
                  title="Not implemented — the panel does not currently import backups"
                  className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/25 text-[11px] font-display flex items-center gap-1 cursor-not-allowed"
                >
                  <Upload size={11} /> IMPORT (UNAVAILABLE)
                </button>
              </div>
              <div className="text-[9px] text-white/30 mt-2 leading-relaxed">
                Import-from-Bitwarden / 1Password / generic backup are not implemented.
                Use the CSV metadata export for inventory, or wire the Worker's
                <code className="mx-1 px-1 rounded bg-white/5">/api/vault/import</code>
                route when it's ready. This button is intentionally disabled rather
                than pretending to work.
              </div>
            </div>

            <div className="glass rounded-xl border border-red-500/25 p-3">
              <div className="text-[10px] font-display tracking-widest mb-2 text-red-400">
                DANGER ZONE
              </div>
              <button
                onClick={() => setConfirmPurge(true)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-display flex items-center gap-1"
                style={{
                  background: "oklch(0.5 0.22 25 / 30%)",
                  border: "1px solid oklch(0.6 0.25 25 / 45%)",
                  color: "oklch(0.85 0.15 25)",
                }}
              >
                <Trash2 size={11} /> PURGE ALL VAULT ITEMS
              </button>
              <div className="text-[9px] text-white/40 mt-2">
                Deletes every item. Master password and vault setup are preserved so you can start over.
              </div>
            </div>
          </div>
        )}

        {/* ---------- LIST ---------- */}
        {tab !== "settings" && (
          <>
            {loading && items.length === 0 && (
              <div className="glass rounded-xl border border-white/8 p-10 text-center text-white/40 text-xs flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading vault…
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="glass rounded-xl border border-white/8 p-10 text-center">
                <ShieldCheck size={32} className="mx-auto text-white/15 mb-3" />
                <div className="text-sm text-white/50 mb-1">
                  {items.length === 0 ? "Vault is empty" : "No items match"}
                </div>
                <div className="text-xs text-white/30 mb-4">
                  {items.length === 0
                    ? "Add your first password, note, or secure item."
                    : "Try clearing the search or switching tabs."}
                </div>
                {items.length === 0 && (
                  <button
                    onClick={() => openAdd((tab === "all") ? "password" : tab as VaultKind)}
                    className="px-4 py-2 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm"
                  >
                    + ADD FIRST ITEM
                  </button>
                )}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((it) => {
                  const k = KINDS.find((x) => x.id === it.kind);
                  const isRevealed = !!revealed[it.id];
                  const data = decrypted[it.id];
                  const isRevealing = revealingId === it.id;
                  const isEditingName = editingId === it.id;
                  return (
                    <div
                      key={it.id}
                      className="glass rounded-xl border border-white/8 p-3 flex flex-col gap-2 transition-colors"
                      style={{ borderLeftWidth: 2, borderLeftColor: k?.color || "#4ab3f4" }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                             style={{ background: (k?.color || "#4ab3f4") + "22", color: k?.color || "#4ab3f4" }}>
                          {k?.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isEditingName ? (
                            <input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); void renameItem(it.id, editingName); }
                                if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
                              }}
                              onBlur={() => void renameItem(it.id, editingName)}
                              className="w-full h-6 px-1 text-[12px] rounded bg-white/5 border border-primary/30 text-white/90 focus:outline-none"
                            />
                          ) : (
                            <div
                              onDoubleClick={() => { setEditingId(it.id); setEditingName(it.name); }}
                              className="text-[12px] text-white/85 font-display truncate"
                              title="Double-click to rename"
                            >
                              {it.name}
                            </div>
                          )}
                          <div className="text-[9px] text-white/30 font-display tracking-widest mt-0.5">
                            {(k?.label || it.kind).toUpperCase()}
                            {it.updated_at && <span className="ml-2 text-white/20">· {fmtDate(it.updated_at)}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleFavorite(it)}
                          className="shrink-0 text-white/25 hover:text-amber-300 p-0.5"
                          title={it.favorite ? "Remove favorite" : "Favorite"}
                        >
                          <Star size={12} className={it.favorite ? "text-amber-300 fill-amber-300" : ""} />
                        </button>
                      </div>

                      {/* Preview (non-secret metadata) */}
                      {Object.keys(it.data_preview || {}).length > 0 && (
                        <div className="text-[10px] text-white/40 flex flex-wrap gap-x-3 gap-y-0.5">
                          {Object.entries(it.data_preview).map(([key, val]) => (
                            <span key={key}><span className="text-white/30">{key}:</span> {String(val)}</span>
                          ))}
                        </div>
                      )}

                      {/* Reveal area */}
                      <div className="mt-1 rounded-lg bg-white/3 border border-white/6 p-2 min-h-[40px]">
                        {isRevealing ? (
                          <div className="text-[10px] text-white/40 flex items-center gap-2">
                            <Loader2 size={11} className="animate-spin" /> Decrypting…
                          </div>
                        ) : data ? (
                          <div className="flex flex-col gap-1">
                            {Object.entries(data).map(([field, value]) => {
                              const isSecret = /password|key|seed|cvv|content|private|number/i.test(field);
                              const display = isSecret && !isRevealed
                                ? maskValue(String(value ?? ""))
                                : String(value ?? "");
                              return (
                                <div key={field} className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-white/30 w-16 shrink-0 truncate">{field}</span>
                                  <span className="text-[10px] text-white/70 font-mono flex-1 truncate">{display}</span>
                                  {isSecret && (
                                    <button
                                      onClick={() => toggleReveal(it.id)}
                                      className="text-white/30 hover:text-primary p-0.5"
                                      title={isRevealed ? "Hide" : "Show"}
                                    >
                                      {isRevealed ? <EyeOff size={10} /> : <Eye size={10} />}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => copyAndMaybeClear(String(value ?? ""), field)}
                                    className="text-white/30 hover:text-primary p-0.5"
                                    title={`Copy ${field}`}
                                  >
                                    <Copy size={10} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <button
                            onClick={() => revealItem(it.id)}
                            className="text-[10px] text-white/50 hover:text-primary font-display flex items-center gap-1.5"
                          >
                            <Eye size={11} /> REVEAL
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => openEdit(it)}
                          className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                        >
                          <Pencil size={10} /> EDIT
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(it.id)}
                          className="ml-auto px-2 py-1 rounded glass border border-white/10 text-white/50 hover:text-red-400 text-[10px] font-display flex items-center gap-1"
                        >
                          <Trash2 size={10} /> DELETE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="h-8" />
      </div>

      {/* ================= ADD MODAL ================= */}
      {addDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setAddDraft(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">ADD VAULT ITEM</div>
              <button onClick={() => setAddDraft(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Kind
                <select
                  value={addDraft.kind}
                  onChange={(e) => setAddDraft({ ...addDraft, kind: e.target.value as VaultKind, fields: blankFieldsFor(e.target.value as VaultKind) })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                >
                  {KINDS.map((k) => <option key={k.id} value={k.id} style={{ background: "#0a0a0a" }}>{k.label}</option>)}
                </select>
              </label>

              <label className="block text-[10px] text-white/50">
                Name *
                <input
                  autoFocus
                  value={addDraft.name}
                  onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveNew(); } }}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none focus:border-primary/40"
                />
              </label>

              {Object.keys(addDraft.fields).map((field) => (
                <label key={field} className="block text-[10px] text-white/50">
                  {field}
                  {/content|notes/i.test(field) ? (
                    <textarea
                      rows={3}
                      value={addDraft.fields[field]}
                      onChange={(e) => setAddDraft({ ...addDraft, fields: { ...addDraft.fields, [field]: e.target.value } })}
                      className="mt-1 w-full px-2 py-1 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none resize-none font-mono"
                    />
                  ) : (
                    <input
                      type={/password|key|seed|cvv|private|number/i.test(field) ? "password" : "text"}
                      value={addDraft.fields[field]}
                      onChange={(e) => setAddDraft({ ...addDraft, fields: { ...addDraft.fields, [field]: e.target.value } })}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveNew(); } }}
                      className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none font-mono"
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setAddDraft(null)}
                className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
              >
                CANCEL
              </button>
              <button
                onClick={saveNew}
                disabled={savingItem || !addDraft.name.trim()}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display hover:glow-crimson-sm disabled:opacity-40 flex items-center gap-1"
              >
                {savingItem ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT MODAL ================= */}
      {editDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setEditDraft(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">EDIT VAULT ITEM</div>
              <button onClick={() => setEditDraft(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Name *
                <input
                  autoFocus
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none focus:border-primary/40"
                />
              </label>

              {Object.keys(editDraft.fields).map((field) => (
                <label key={field} className="block text-[10px] text-white/50">
                  {field}
                  {/content|notes/i.test(field) ? (
                    <textarea
                      rows={3}
                      value={editDraft.fields[field]}
                      onChange={(e) => setEditDraft({ ...editDraft, fields: { ...editDraft.fields, [field]: e.target.value } })}
                      className="mt-1 w-full px-2 py-1 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none resize-none font-mono"
                    />
                  ) : (
                    <input
                      type={/password|key|seed|cvv|private|number/i.test(field) ? "password" : "text"}
                      value={editDraft.fields[field]}
                      onChange={(e) => setEditDraft({ ...editDraft, fields: { ...editDraft.fields, [field]: e.target.value } })}
                      className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none font-mono"
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditDraft(null)}
                className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
              >
                CANCEL
              </button>
              <button
                onClick={saveEdit}
                disabled={savingItem}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display hover:glow-crimson-sm disabled:opacity-40 flex items-center gap-1"
              >
                {savingItem ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CHANGE PASSWORD MODAL ================= */}
      {pwModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setPwModal(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">CHANGE MASTER PASSWORD</div>
              <button onClick={() => setPwModal(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>
            <div className="text-[10px] text-white/50 mb-3">
              All items will be re-encrypted under the new key. If you lose this password, your data is unrecoverable.
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Current password
                <input type="password" value={pwModal.old}
                  onChange={(e) => setPwModal({ ...pwModal, old: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none" />
              </label>
              <label className="block text-[10px] text-white/50">
                New password (min 8)
                <input type="password" value={pwModal.next}
                  onChange={(e) => setPwModal({ ...pwModal, next: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none" />
              </label>
              <label className="block text-[10px] text-white/50">
                Confirm new password
                <input type="password" value={pwModal.next2}
                  onChange={(e) => setPwModal({ ...pwModal, next2: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPwModal(null)} className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display">
                CANCEL
              </button>
              <button
                onClick={changePassword}
                disabled={changingPw}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display hover:glow-crimson-sm disabled:opacity-40 flex items-center gap-1"
              >
                {changingPw ? <Loader2 size={11} className="animate-spin" /> : <Key size={11} />}
                CHANGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRM ================= */}
      {confirmDeleteId && (() => {
        const it = items.find((x) => x.id === confirmDeleteId);
        if (!it) return null;
        return (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4"
               style={{ background: "oklch(0 0 0 / 75%)" }}
               onClick={() => setConfirmDeleteId(null)}>
            <div className="glass rounded-xl border border-red-500/30 w-full max-w-sm p-4"
                 onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-red-400" />
                <div className="text-xs font-display text-white/80 tracking-wider">DELETE ITEM</div>
              </div>
              <div className="text-[11px] text-white/60 mb-3">
                Permanently delete <span className="text-white/85">"{it.name}"</span>? This cannot be undone.
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display">
                  CANCEL
                </button>
                <button onClick={() => deleteItem(it.id)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-display"
                        style={{ background: "oklch(0.5 0.22 25 / 40%)", color: "oklch(0.85 0.15 25)", border: "1px solid oklch(0.6 0.25 25 / 50%)" }}>
                  DELETE
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= PURGE CONFIRM ================= */}
      {confirmPurge && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4"
             style={{ background: "oklch(0 0 0 / 75%)" }}
             onClick={() => setConfirmPurge(false)}>
          <div className="glass rounded-xl border border-red-500/30 w-full max-w-sm p-4"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-red-400" />
              <div className="text-xs font-display text-white/80 tracking-wider">PURGE ALL ITEMS</div>
            </div>
            <div className="text-[11px] text-white/60 mb-3">
              Delete all {items.length} vault items? The vault setup and master password remain, but every stored secret is destroyed. This cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPurge(false)}
                      className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display">
                CANCEL
              </button>
              <button onClick={purgeAll}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-display"
                      style={{ background: "oklch(0.5 0.22 25 / 40%)", color: "oklch(0.85 0.15 25)", border: "1px solid oklch(0.6 0.25 25 / 50%)" }}>
                PURGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOASTS ================= */}
      <div className="fixed bottom-4 right-4 z-80 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id}
               className="pointer-events-auto glass rounded-lg border px-3 py-2 text-[11px] flex items-center gap-2 max-w-sm"
               style={{
                 borderColor:
                   t.kind === "error" ? "oklch(0.6 0.25 25 / 50%)"
                   : t.kind === "success" ? "oklch(0.7 0.18 150 / 50%)"
                   : "oklch(0.7 0.15 220 / 50%)",
               }}>
            {t.kind === "error" && <AlertCircle size={12} className="text-red-400 shrink-0" />}
            {t.kind === "success" && <CheckCircle size={12} className="text-green-400 shrink-0" />}
            {t.kind === "info" && <Info size={12} className="text-sky-400 shrink-0" />}
            <span className="text-white/80">{t.text}</span>
          </div>
        ))}
      </div>
    </PanelLayout>
  );
}