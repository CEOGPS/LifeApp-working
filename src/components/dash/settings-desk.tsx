import { useEffect, useState } from "react";
import { adoptDevice, deviceId, sanitizeMemory, type Memory } from "./memory";
import { appSettings, onAppSettings, saveAppSettings, type AppSettings } from "./app-settings";
import { onSoundChange, setMuted, setVolume, soundPrefs } from "./sound";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Tab = "appearance" | "notifications" | "data";

function download(name: string, payload: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsDesk({ data, update }: { data: Memory; update: Update }) {
  const [tab, setTab] = useState<Tab>("appearance");
  const [sound, setSound] = useState(soundPrefs());
  const [prefs, setPrefs] = useState<AppSettings>(appSettings());
  const [code, setCode] = useState("");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;

  useEffect(() => {
    setCode(deviceId());
    setSound(soundPrefs());
    setPrefs(appSettings());
    return onSoundChange(() => setSound(soundPrefs()));
  }, []);
  useEffect(() => onAppSettings(() => setPrefs(appSettings())), []);

  function patch(next: Partial<AppSettings>) {
    saveAppSettings({ ...appSettings(), ...next });
  }

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[14rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Settings</p>
        {(["appearance", "notifications", "data"] as Tab[]).map((item) => (
          <button key={item} type="button" className={`menu capitalize ${tab === item ? "is-on" : ""}`} onClick={() => setTab(item)}>{item}</button>
        ))}
      </aside>
      <section className="module-card p-4">
        {tab === "appearance" ? (
          <div>
            <h1 className="text-2xl">Appearance</h1>
            <p className="mt-1 text-sm text-white/50">Sound and motion for this browser. The colors stay with the dashboard.</p>
            <div className="mt-4 flex items-center gap-4">
              <button type="button" className={`quiet ${sound.muted ? "" : "is-on"}`} onClick={() => setMuted(!sound.muted)}>{sound.muted ? "Sound off" : "Sound on"}</button>
              <input className="h-1 w-40 accent-violet-300" type="range" min={0} max={1} step={0.05} value={sound.volume} aria-label="Volume" onChange={(event) => setVolume(Number(event.target.value))} />
            </div>
            <div className="mt-4">
              <button type="button" className={`quiet ${prefs.motion ? "is-on" : ""}`} onClick={() => patch({ motion: !prefs.motion })}>{prefs.motion ? "Motion on" : "Motion off"}</button>
              <p className="mt-1 text-[11px] text-white/35">Motion off stops the tapes and other loops on this browser.</p>
            </div>
          </div>
        ) : null}
        {tab === "notifications" ? (
          <div>
            <h1 className="text-2xl">Notifications</h1>
            <p className="mt-1 text-sm text-white/50">Browser permission is {permission}.</p>
            <button type="button" className="quiet is-on mt-3" onClick={() => { if (typeof Notification !== "undefined") void Notification.requestPermission().then(() => setNote("Permission updated.")); }}>{permission === "granted" ? "Permission granted" : "Allow notifications"}</button>
            <div className="mt-4 flex gap-4">
              <button type="button" className={`quiet ${prefs.notifyCalendar ? "is-on" : ""}`} onClick={() => patch({ notifyCalendar: !prefs.notifyCalendar })}>Calendar {prefs.notifyCalendar ? "on" : "off"}</button>
              <button type="button" className={`quiet ${prefs.notifyLeads ? "is-on" : ""}`} onClick={() => patch({ notifyLeads: !prefs.notifyLeads })}>Leads {prefs.notifyLeads ? "on" : "off"}</button>
            </div>
            <p className="mt-2 text-[11px] text-white/35">Calendar fires when you add an event. Leads fire when you save a lead. Both need permission granted.</p>
            {note ? <p className="mt-2 text-sm text-white/50">{note}</p> : null}
          </div>
        ) : null}
        {tab === "data" ? (
          <div>
            <h1 className="text-2xl">Data</h1>
            <p className="mt-1 text-sm text-white/50">This code syncs the board. Keys and the vault stay off the normal export.</p>
            <p className="mt-3 break-all font-mono text-xs text-blue-2">{code}</p>
            <button type="button" className="quiet mt-2" onClick={() => void navigator.clipboard.writeText(code).then(() => setNote("Code copied."))}>Copy code</button>
            <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (adoptDevice(paste.trim())) { setPaste(""); setNote("Loading that browser's board."); } else setNote("That code is not a device id."); }}>
              <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Paste a code from another browser" value={paste} onChange={(event) => setPaste(event.target.value)} />
              <button type="submit" className="quiet is-on">Load</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-4">
              <button type="button" className="quiet is-on" onClick={() => download("lifeos.json", { ...data, keys: [], vault: [] })}>Export board</button>
              <button type="button" className="quiet" onClick={() => download("lifeos-full.json", data)}>Export with keys</button>
              <label className="quiet cursor-pointer">Import
                <input type="file" accept="application/json" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file.text().then((text) => { update(() => sanitizeMemory(JSON.parse(text))); setNote("Imported."); }).catch(() => setNote("That file is not a LifeOS export."));
                }} />
              </label>
            </div>
            {note ? <p className="mt-3 text-sm text-white/50">{note}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
