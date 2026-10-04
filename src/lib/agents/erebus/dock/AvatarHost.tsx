// src/lib/agents/erebus/dock/AvatarHost.tsx
// The ONE live Erebus avatar (face + voice + mic) for the whole app.
// Mounted once in ErebusDock (itself mounted once in AppLayout), so it
// survives route changes. Its DOM node is moved (appendChild) between slots:
//   pip   -> Document Picture-in-Picture window (Chrome/Edge, "Detach")
//   stage -> center AI stage (AppLayout)          when placement = "stage"
//   dock  -> the dock window                      when the dock is open
//   float -> floating in-page window              when placement = "float"
// Moving the node (instead of re-rendering) keeps the face, audio graph and
// voice queue alive. Voice: useErebusVoice (Kokoro -> speechSynthesis).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Mic, Volume2, VolumeX, Palette, PictureInPicture2, Undo2, Loader2 } from "lucide-react";
import { ErebusFace, type ErebusFaceHandle } from "../ui/ErebusFace";
import { useErebusVoice } from "../hooks/useErebusVoice";
import { useDockStore, type TargetName } from "./dockStore";
import { DOCK_SKINS, getSkin } from "./skins";
import CodeRain from "./CodeRain";
import { useSpeechInput } from "./useSpeechInput";

const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

export const pipSupported = () => typeof window !== "undefined" && "documentPictureInPicture" in window;

function copyStylesInto(doc: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
  doc.documentElement.className = document.documentElement.className;
  doc.body.className = document.body.className;
  doc.body.style.margin = "0";
  doc.body.style.background = "#050507";
}

/** Face + skin layers + idle "live" motion. */
function LiveAvatar({ faceRef, size }: { faceRef: React.RefObject<ErebusFaceHandle | null>; size: number }) {
  const activity = useDockStore((s) => s.activity);
  const skin = getSkin("nova");
  const [look, setLook] = useState({ x: 0, r: 0, y: 0 });

  // Idle life: small random glances / head tilts every few seconds.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      // PATCH (home-page2): natural head motion = small glance (x/y) + tilt, eased.
      setLook({ x: (Math.random() - 0.5) * 6, r: (Math.random() - 0.5) * 3.2, y: (Math.random() - 0.5) * 2 });
      t = setTimeout(next, 2500 + Math.random() * 3500);
    };
    t = setTimeout(next, 2000);
    return () => clearTimeout(t);
  }, []);

  const ring =
    activity === "listening"
      ? "0 0 0 2px rgba(56,220,255,0.8), 0 0 24px rgba(56,220,255,0.5)"
      : activity === "thinking"
        ? `0 0 0 1px rgba(${skin.auraRgb},0.7), 0 0 18px rgba(${skin.auraRgb},0.45)`
        : "none";

  const video = skin.src.toLowerCase().endsWith(".mp4");

  return (
    <motion.div
      animate={video ? { x: 0, y: 0, rotate: 0, scale: 1 } : {
        x: look.x,
        rotate: look.r,
        y: look.y,
        scale: activity === "speaking" ? 1.03 : 1,
      }}
      transition={{
        x: { duration: 1.6, ease: "easeInOut" },
        rotate: { duration: 1.8, ease: "easeInOut" },
        y: { duration: 1.6, ease: "easeInOut" },
        scale: { duration: 0.4 },
      }}
      style={{
        borderRadius: 14,
        boxShadow: ring,
        // hologram silhouette glow (also brightens with the voice via the face's --glow)
        filter: skin.holo ? `drop-shadow(0 0 10px rgba(${skin.auraRgb},0.45)) drop-shadow(0 0 28px rgba(${skin.auraRgb},0.22))` : undefined,
        ["--holo-rgb" as string]: skin.auraRgb,
      }}
      data-testid="erebus-live-avatar"
      data-skin={skin.id}
    >
      <ErebusFace
        ref={faceRef}
        src={skin.src}
        width={size}
        aspect={skin.aspect}
        auraRgb={skin.auraRgb}
        featureTone={skin.featureTone}
        imgStyle={skin.imgStyle}
        eyes={skin.eyes}
        mouth={skin.mouth}
        lidBackground={skin.lidBackground}
        mouthBackground={skin.mouthBackground}
        style={{ background: skin.background }}
      >
        {skin.holo && (
          // cool cyan tint + soft top light, so the portrait reads as projected light
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(180deg, rgba(${skin.auraRgb},0.10), rgba(${skin.auraRgb},0.02) 45%, rgba(${skin.auraRgb},0.16))`,
              mixBlendMode: "screen",
            }}
          />
        )}
        {skin.layers.includes("rain") && <CodeRain rgb={skin.rainRgb} density={skin.rainDensity ?? 1} baseOpacity={skin.rainOpacity ?? 0.55} />}
        {skin.layers.includes("scanlines") && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `repeating-linear-gradient(0deg, rgba(${skin.auraRgb},0.10) 0 1px, transparent 1px 3px)`,
              mixBlendMode: "screen",
            }}
          />
        )}
        {skin.layers.includes("vignette") && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(0,0,0,0.75) 100%)",
            }}
          />
        )}
        {skin.layers.includes("flicker") && <div aria-hidden className="erebus-holo-flicker" />}
      </ErebusFace>
      {thinkingDots(activity)}
    </motion.div>
  );
}

function thinkingDots(activity: string) {
  if (activity !== "thinking") return null;
  return (
    <div className="flex justify-center gap-1 mt-1" aria-label="Erebus is thinking">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

const FLICKER_CSS = `
.erebus-holo-flicker{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,transparent 0%,rgba(var(--holo-rgb,120,255,180),.10) 50%,transparent 100%);background-size:100% 18%;animation:erebusHoloSweep 4s linear infinite, erebusHoloFlicker 6s steps(1) infinite;mix-blend-mode:screen}
@keyframes erebusHoloSweep{0%{background-position:0 -20%}100%{background-position:0 120%}}
@keyframes erebusHoloFlicker{0%,100%{opacity:1}47%{opacity:1}48%{opacity:.55}49%{opacity:1}83%{opacity:.8}84%{opacity:1}}
`;

export default function AvatarHost() {
  const settings = useDockStore((s) => s.settings);
  const update = useDockStore((s) => s.update);
  const dockOpen = useDockStore((s) => s.dockOpen);
  const targets = useDockStore((s) => s.targets);
  const pipWindow = useDockStore((s) => s.pipWindow);
  const activity = useDockStore((s) => s.activity);
  const faceRef = useRef<ErebusFaceHandle | null>(null);
  const [size, setSize] = useState(160);
  const [where, setWhere] = useState<TargetName | null>(null);

  // Persistent node the portal renders into; moved between slots.
  const hostEl = useMemo(() => {
    const el = document.createElement("div");
    el.className = "erebus-avatar-host flex flex-col items-center gap-2";
    return el;
  }, []);

  const voice = useErebusVoice({
    faceRef,
    voice: settings.voice,
    speed: settings.speed,
    volume: settings.volume,
    onSpeakStart: () => useDockStore.getState().setActivity("speaking"),
    onSpeakEnd: () => {
      const st = useDockStore.getState();
      if (st.activity === "speaking") st.setActivity("idle");
    },
    onError: (e) => console.warn("[erebus-voice]", e),
  });

  // Keep the hook's mute in sync with the persisted setting.
  useEffect(() => {
    voice.setMuted(settings.muted);
    if (settings.muted) voice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.muted]);

  const speech = useSpeechInput((text) => {
    void useDockStore.getState().sendChat(text);
  });
  useEffect(() => {
    const st = useDockStore.getState();
    if (speech.listening) st.setActivity("listening");
    else if (st.activity === "listening") st.setActivity("idle");
  }, [speech.listening]);

  // Detach into a Document Picture-in-Picture window (fallback: floating window).
  const detach = async () => {
    const st = useDockStore.getState();
    if (st.pipWindow) {
      st.pipWindow.close();
      return;
    }
    if (!pipSupported()) {
      update({ placement: "float" });
      return;
    }
    try {
      const pip: Window = await (window as any).documentPictureInPicture.requestWindow({ width: 300, height: 420 });
      copyStylesInto(pip.document);
      pip.document.title = "Erebus";
      const mount = pip.document.createElement("div");
      mount.style.cssText = "min-height:100vh;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box";
      pip.document.body.appendChild(mount);
      st.setTarget("pip", mount);
      st.setPipWindow(pip);
      pip.addEventListener("pagehide", () => {
        const s2 = useDockStore.getState();
        s2.setTarget("pip", null);
        s2.setPipWindow(null);
      });
    } catch (e) {
      console.warn("[erebus] PiP failed, using floating window:", e);
      update({ placement: "float" });
    }
  };

  useEffect(() => {
    useDockStore.getState().registerBridges({
      sayFn: (t: string) => voice.say(t),
      stopFn: () => voice.stop(),
      detachFn: detach,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.say, voice.stop]);

  // Pick the slot and move the live node there.
  useLayoutEffect(() => {
    let target: TargetName | null = null;
    if (pipWindow && targets.pip) target = "pip";
    // PATCH (home-page2): the home page's centre window hosts Erebus unless she is floating,
    // or the dock is open with placement "dock" ("Bring here").
    else if (settings.placement === "float" && targets.float) target = "float";
    else if (dockOpen && settings.placement === "dock" && targets.dock) target = "dock";
    else if (settings.placement === "stage" && targets.stage) target = "stage";
    else if (settings.placement === "float" && targets.float) target = "float";
    else if (dockOpen && targets.dock) target = "dock";
    const el = target ? targets[target] : null;
    if (el && hostEl.parentElement !== el) el.appendChild(hostEl);
    if (!el && hostEl.parentElement) hostEl.parentElement.removeChild(hostEl);
    setWhere(target);
    useDockStore.getState().setActiveTarget(target);
    if (target === "pip" && pipWindow) {
      const fit = () => setSize(Math.max(120, Math.min(pipWindow.innerWidth - 40, (pipWindow.innerHeight - 90) * (683 / 1024))));
      fit();
      pipWindow.addEventListener("resize", fit);
      return () => pipWindow.removeEventListener("resize", fit);
    }
    if (el) setSize(Number(el.dataset.avatarSize) || 160);
  }, [pipWindow, targets, settings.placement, dockOpen, hostEl]);

  const cycleSkin = () => {
    const i = DOCK_SKINS.findIndex((s) => s.id === settings.skin);
    update({ skin: DOCK_SKINS[(i + 1) % DOCK_SKINS.length].id, skinChosen: true });
  };

  const btn = "p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40";

  return createPortal(
    <>
      <style>{FLICKER_CSS}</style>
      <LiveAvatar faceRef={faceRef} size={size} />
      <div className="flex items-center gap-1" data-testid="erebus-avatar-controls">
        <button
          type="button"
          className={btn}
          onClick={() => update({ muted: !settings.muted })}
          title={settings.muted ? "Unmute Erebus" : "Mute Erebus"}
          aria-label={settings.muted ? "Unmute" : "Mute"}
        >
          {settings.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <button
          type="button"
          className={cn(btn, speech.listening && "bg-cyan-500/25 text-cyan-200")}
          disabled={!settings.voiceInput || !speech.supported}
          onPointerDown={(e) => {
            e.preventDefault();
            speech.start();
          }}
          onPointerUp={() => speech.stop()}
          onPointerLeave={() => speech.listening && speech.stop()}
          title={
            !speech.supported ? "Speech input needs Chrome/Edge" : !settings.voiceInput ? "Voice input is off (settings)" : "Hold to talk"
          }
          aria-label="Push to talk"
        >
          <Mic size={15} />
        </button>
        <button type="button" className={btn} onClick={cycleSkin} title={`Skin: ${getSkin(settings.skin).label} (click to switch)`} aria-label="Switch skin">
          <Palette size={15} />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => void detach()}
          title={pipWindow ? "Return Erebus to the page" : pipSupported() ? "Detach (always-on-top window)" : "Detach (floating window)"}
          aria-label={pipWindow ? "Return" : "Detach"}
        >
          {pipWindow ? <Undo2 size={15} /> : <PictureInPicture2 size={15} />}
        </button>
        {activity === "thinking" && <Loader2 size={13} className="animate-spin text-white/40" />}
      </div>
      {(speech.interim || speech.error) && (
        <div className="max-w-[240px] text-center text-[10px] text-white/60">{speech.error || speech.interim}</div>
      )}
      {where === "pip" && <div className="text-[9px] tracking-widest uppercase text-white/30">Erebus · detached</div>}
    </>,
    hostEl,
  );
}
