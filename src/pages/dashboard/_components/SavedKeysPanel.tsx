// src/pages/dashboard/_components/SavedKeysPanel.tsx
// PATCH (home-page2): status + unlock for Chris's saved API keys (public.keys).
// The keys are client-side encrypted; entering the master password here (same one
// as the Integrations page) unlocks them in memory for this browser session so the
// home modules can use them. Read-only: never writes, rewrites or deletes key rows.
import { useEffect, useState } from "react";
import { KeyRound, Lock, Unlock, Loader2 } from "lucide-react";
import {
  KEYS_UNLOCKED_EVENT,
  currentSessionUid,
  isKeyEncryptionUnlocked,
  unlockKeyEncryption,
} from "@/platform/integrations/integrationsSupabase";
import { OWNER_CHANGED_EVENT } from "@/lib/owner";
import { savedKeyServices } from "../_lib/savedKeys";
import { LLM_KEY_SERVICES } from "../_lib/homeAi";

const HOME_KEY_USES: Array<[string, string]> = [
  ["youtube", "YouTube search"],
  ...LLM_KEY_SERVICES.map((s) => [s, "AI tips / hacks / insights"] as [string, string]),
];

export default function SavedKeysPanel() {
  const [services, setServices] = useState<string[] | null>(null);
  const [unlocked, setUnlocked] = useState(isKeyEncryptionUnlocked());
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = (force = false) => savedKeyServices(force).then((s) => alive && setServices(s));
    load();
    const onUnlock = () => setUnlocked(true);
    const onOwner = () => load(true);
    window.addEventListener(KEYS_UNLOCKED_EVENT, onUnlock);
    window.addEventListener(OWNER_CHANGED_EVENT, onOwner);
    return () => {
      alive = false;
      window.removeEventListener(KEYS_UNLOCKED_EVENT, onUnlock);
      window.removeEventListener(OWNER_CHANGED_EVENT, onOwner);
    };
  }, []);

  const used = HOME_KEY_USES.filter(([s]) => services?.includes(s));

  const submit = async () => {
    if (!pw) return;
    setBusy(true);
    setErr(null);
    try {
      const uid = await currentSessionUid();
      if (!uid) throw new Error("No session yet");
      await unlockKeyEncryption(uid, pw);
      setPw("");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-[10px] text-white/50" data-testid="home-saved-keys">
      <div className="flex items-center gap-2">
        <KeyRound size={11} className="text-cyan-300/70" />
        <span className="font-display tracking-widest uppercase text-white/60">Saved keys</span>
        <span className="ml-auto flex items-center gap-1">
          {services === null ? (
            "checking…"
          ) : services.length === 0 ? (
            "none visible to this session"
          ) : unlocked ? (
            <>
              <Unlock size={10} className="text-emerald-400/80" /> {services.length} unlocked
            </>
          ) : (
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-cyan-200/80 hover:text-cyan-100 underline-offset-2 hover:underline">
              <Lock size={10} /> {services.length} locked · unlock
            </button>
          )}
        </span>
      </div>
      {used.length > 0 && (
        <div className="mt-1 text-white/30 leading-snug">
          Home uses: {used.map(([s, what]) => `${s} (${what})`).join(", ")}
        </div>
      )}
      {services !== null && services.length === 0 && (
        <div className="mt-1 text-white/30 leading-snug">Link this browser to your owner account (Integrations) to use your saved keys.</div>
      )}
      {open && !unlocked && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Master password"
            autoComplete="current-password"
            className="flex-1 h-7 px-2 rounded-md bg-white/5 border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-300/50"
            aria-label="Master password for saved keys"
          />
          <button type="submit" disabled={busy || !pw} className="h-7 px-2.5 rounded-md bg-cyan-400/15 text-cyan-100 border border-cyan-300/25 disabled:opacity-40">
            {busy ? <Loader2 size={11} className="animate-spin" /> : "Unlock"}
          </button>
        </form>
      )}
      {err && <div className="mt-1 text-red-300/80" role="alert">{err}</div>}
    </div>
  );
}
