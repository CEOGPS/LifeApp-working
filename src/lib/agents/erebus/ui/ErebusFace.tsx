// --- ErebusFace --------------------------------------------------------------
// src/lib/agents/erebus/ui/ErebusFace.tsx
//
// Audio-reactive portrait for Erebus. Renders a still portrait with two
// blinking eyelids, a mouth that opens with the voice, a slow breathing
// animation and an aura that glows with loudness.
//
// Imperative handle (via forwardRef + useImperativeHandle):
// PATCH (erebus-dock-redesign): speak(url, volume?) routes audio through a
// GainNode (0..1); new optional props `children` (overlay layers drawn above the
// portrait, e.g. the hologram code rain), `imgStyle`, `auraRgb` and `featureTone`
// let dock skins restyle the face without touching the audio logic.
//
//   speak(url)   play an audio URL and drive the mouth from its spectrum;
//                resolves on `ended` or `error` (or when stop() is called)
//   stop()       cancel playback and reset the face
//   isSpeaking() true while an utterance is playing
//
// The wrapper owns two CSS custom properties:
//   --open  mouth scale, 0..1
//   --glow  aura intensity, 0..1
// They are written straight to the DOM from a requestAnimationFrame loop, so
// there are no React re-renders per frame.
//
// If there is no AudioContext, or the Web Audio graph can't be built, the
// mouth falls back to a sine envelope driven by performance.now().
//
// No dependencies beyond React.
// -----------------------------------------------------------------------------

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface ErebusFaceHandle {
  speak(url: string, volume?: number): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
}

/** Position/size of a facial feature. Numbers are px; strings are any CSS length (e.g. "27%"). */
export interface ErebusFaceFeatureBox {
  top: number | string;
  left: number | string;
  width: number | string;
  height: number | string;
}

export interface ErebusFaceEyes {
  left: ErebusFaceFeatureBox;
  right: ErebusFaceFeatureBox;
}

export interface ErebusFaceProps {
  /** Portrait image. */
  src?: string;
  /** Rendered width in px. Height follows the portrait aspect ratio. */
  width?: number;
  /** Eyelid positions (percentages are relative to the portrait box). */
  eyes?: ErebusFaceEyes;
  /** Mouth position (percentages are relative to the portrait box). */
  mouth?: ErebusFaceFeatureBox;
  /** Portrait aspect ratio as width / height. Defaults to 683 / 1024. */
  aspect?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Overlay layers rendered above the portrait (skins). */
  children?: React.ReactNode;
  /** Extra styles merged into the portrait <img> (skins: filters, blend). */
  imgStyle?: React.CSSProperties;
  /** Aura/glow colour as "r,g,b". Default Erebus violet. */
  auraRgb?: string;
  /** "dark" = normal eyelids/mouth; "glow" = luminous mouth for hologram skins; "none" hides features. */
  featureTone?: "dark" | "glow" | "none";
  /** PATCH (home-page2): eyelid / mouth fills (skins whose portrait needs other tones). */
  lidBackground?: string;
  mouthBackground?: string;
}

// Defaults tuned for public/agents/Erebus.png (683x1024 portrait; any size with
// the same 2:3 aspect works since everything is in %). Adjust via the
// `eyes` / `mouth` props if the artwork frames the face differently.
// PATCH (erebus-blockers): measured on the portrait (px on 683x1024):
//   eye centres x~290 / x~435, y~335 (boxes ~72x35 px)
//   mouth centre x~362, y~478, ~90 px wide (box ~90x37 px)
const DEFAULT_EYES: ErebusFaceEyes = {
  left: { top: "31%", left: "37.2%", width: "10.5%", height: "3.4%" },
  right: { top: "31%", left: "58.4%", width: "10.5%", height: "3.4%" },
};

const DEFAULT_MOUTH: ErebusFaceFeatureBox = {
  top: "44.9%",
  left: "46.4%",
  width: "13.2%",
  height: "3.6%",
};

const DEFAULT_ASPECT = 683 / 1024;

// Spectrum -> mouth mapping (bins [4, 60) of a 256-point FFT ~ voice band).
const BIN_START = 4;
const BIN_END = 60;
const BIN_COUNT = 56;
const GAIN = 3.2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const KEYFRAMES = `
@keyframes erebusFaceBlink {
  0%, 92%, 100% { transform: scaleY(0); }
  95%           { transform: scaleY(1); }
}
@keyframes erebusFaceBreathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-1.5px) scale(1.012); }
}
`;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

export const ErebusFace = forwardRef<ErebusFaceHandle, ErebusFaceProps>(
  function ErebusFace(
    {
      src = "/agents/Erebus.png",
      width = 140,
      eyes = DEFAULT_EYES,
      mouth = DEFAULT_MOUTH,
      aspect = DEFAULT_ASPECT,
      alt = "Erebus",
      className,
      style,
      children,
      imgStyle,
      auraRgb = "155,114,207",
      featureTone = "dark",
      lidBackground,
      mouthBackground,
    },
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number | null>(null);
    const speakingRef = useRef(false);
    const finishRef = useRef<(() => void) | null>(null);
    const [imgError, setImgError] = useState(false);

    const setVars = useCallback((open: number, glow: number) => {
      const el = wrapperRef.current;
      if (!el) return;
      el.style.setProperty("--open", open.toFixed(3));
      el.style.setProperty("--glow", glow.toFixed(3));
    }, []);

    // Tear down everything that belongs to the current utterance.
    const cleanup = useCallback(() => {
      if (rafRef.current !== null) {
        // PATCH: the node may live in the PiP window; cancel on its window too.
        try {
          (wrapperRef.current?.ownerDocument?.defaultView || window).cancelAnimationFrame(rafRef.current);
        } catch {
          /* ignore */
        }
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
        audio.onended = null;
        audio.onerror = null;
        audioRef.current = null;
      }
      try {
        sourceRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyserRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
      analyserRef.current = null;
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {
          /* ignore */
        });
      }
      speakingRef.current = false;
      setVars(0, 0);
    }, [setVars]);

    const stop = useCallback(() => {
      const finish = finishRef.current;
      finishRef.current = null;
      cleanup();
      // Resolve any pending speak() so callers (e.g. a voice queue) move on.
      finish?.();
    }, [cleanup]);

    const speak = useCallback(
      (url: string, volume = 1): Promise<void> => {
        const vol = clamp01(Number.isFinite(volume) ? volume : 1);
        // Only one utterance at a time; interrupt whatever is playing.
        stop();

        return new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            if (finishRef.current === finish) {
              finishRef.current = null;
              cleanup();
            }
            resolve();
          };
          finishRef.current = finish;
          speakingRef.current = true;

          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = finish;
          audio.onerror = finish;

          // Try to build source -> analyser -> destination.
          let analyser: AnalyserNode | null = null;
          const Ctor = getAudioContextCtor();
          if (Ctor) {
            try {
              const ctx = new Ctor();
              ctxRef.current = ctx;
              analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.55;
              const source = ctx.createMediaElementSource(audio);
              const gain = ctx.createGain();
              gain.gain.value = vol;
              source.connect(analyser);
              analyser.connect(gain);
              gain.connect(ctx.destination);
              sourceRef.current = source;
              analyserRef.current = analyser;
              if (ctx.state === "suspended") {
                ctx.resume().catch(() => {
                  /* ignore */
                });
              }
            } catch {
              // Graph failed: tear down the partial graph and use the sine
              // fallback. The <audio> element still plays on its own because
              // it was never (successfully) routed through the context.
              try {
                analyserRef.current?.disconnect();
              } catch {
                /* ignore */
              }
              analyserRef.current = null;
              sourceRef.current = null;
              const ctx = ctxRef.current;
              ctxRef.current = null;
              ctx?.close().catch(() => {
                /* ignore */
              });
              analyser = null;
            }
          }

          if (!analyser) audio.volume = vol;

          const bins = analyser
            ? new Uint8Array(analyser.frequencyBinCount)
            : null;

          const tick = () => {
            if (settled) return;
            let level: number;
            if (analyser && bins) {
              analyser.getByteFrequencyData(bins);
              let sum = 0;
              const end = Math.min(BIN_END, bins.length);
              for (let i = BIN_START; i < end; i++) sum += bins[i];
              level = clamp01((sum / (BIN_COUNT * 255)) * GAIN);
            } else {
              // Sine envelope fallback: syllable-rate flap with a slow swell.
              const t = performance.now() / 1000;
              const flap = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 4.2);
              const swell = 0.6 + 0.4 * Math.sin(t * Math.PI * 2 * 0.9);
              level = clamp01(flap * swell);
            }
            setVars(level, level);
            rafRef.current = (wrapperRef.current?.ownerDocument?.defaultView || window).requestAnimationFrame(tick);
          };
          rafRef.current = (wrapperRef.current?.ownerDocument?.defaultView || window).requestAnimationFrame(tick);

          const played = audio.play();
          if (played && typeof played.catch === "function") {
            // Autoplay block or decode failure: treat as `error`.
            played.catch(finish);
          }
        });
      },
      [cleanup, setVars, stop],
    );

    useImperativeHandle(
      ref,
      () => ({
        speak,
        stop,
        isSpeaking: () => speakingRef.current,
      }),
      [speak, stop],
    );

    // Cleanup on unmount.
    useEffect(() => {
      return () => {
        stop();
      };
    }, [stop]);

    const height = Math.round(width / aspect);

    const featureStyle = (box: ErebusFaceFeatureBox): React.CSSProperties => ({
      position: "absolute",
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
    });

    const wrapperStyle = {
      "--open": 0,
      "--glow": 0,
      position: "relative",
      width,
      height,
      flexShrink: 0,
      overflow: "hidden",
      borderRadius: 12,
      background: "#000000",
      animation: src.toLowerCase().endsWith(".mp4") ? "none" : "erebusFaceBreathe 4.8s ease-in-out infinite",
      transformOrigin: "50% 80%",
      boxShadow:
        `0 0 calc(6px + var(--glow) * 26px) rgba(${auraRgb},calc(0.18 + var(--glow) * 0.6))`,
      transition: "box-shadow 80ms linear",
      ...style,
    } as React.CSSProperties;

    return (
      <div
        ref={wrapperRef}
        className={className}
        style={wrapperStyle}
        data-erebus-face=""
      >
        <style>{KEYFRAMES}</style>

        {imgError ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c4a2f5",
              fontSize: width * 0.4,
              fontWeight: 700,
            }}
          >
            E
          </div>
        ) : src.toLowerCase().endsWith(".mp4") ? (
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
              background: "#000",
              ...imgStyle,
            }}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            draggable={false}
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              userSelect: "none",
              ...imgStyle,
            }}
          />
        )}

        {/* Aura: brightens with the voice */}
        {!src.toLowerCase().endsWith(".mp4") && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              `radial-gradient(circle at 50% 35%, rgba(${auraRgb},0.55), transparent 65%)`,
            opacity: "calc(var(--glow) * 0.55)" as unknown as number,
            mixBlendMode: "screen",
          }}
        />
        )}

        {children}

        {!imgError && featureTone !== "none" && (
          <>
            {/* Eyelids */}
            {[eyes.left, eyes.right].map((box, i) => (
              <div
                key={i}
                aria-hidden
                style={{
                  ...featureStyle(box),
                  borderRadius: "50% 50% 45% 45%",
                  background:
                    lidBackground ??
                    (featureTone === "glow"
                      ? `linear-gradient(180deg, rgba(4,20,10,0.92), rgba(${auraRgb},0.35))`
                      : "linear-gradient(180deg, rgba(20,14,24,0.96), rgba(40,28,40,0.9))"),
                  transformOrigin: "50% 0%",
                  transform: "scaleY(0)",
                  animation: "erebusFaceBlink 5.5s ease-in-out infinite",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Mouth */}
            <div
              aria-hidden
              style={{
                ...featureStyle(mouth),
                borderRadius: "50%",
                background:
                  mouthBackground ??
                  (featureTone === "glow"
                    ? `radial-gradient(ellipse at 50% 45%, rgba(${auraRgb},0.95) 25%, rgba(${auraRgb},0.35) 70%, transparent 100%)`
                    : "radial-gradient(ellipse at 50% 45%, rgba(8,4,10,0.95) 35%, rgba(60,20,40,0.75) 70%, transparent 100%)"),
                transformOrigin: "50% 40%",
                transform: "scaleY(var(--open))",
                opacity: "calc(0.15 + var(--open))" as unknown as number,
                pointerEvents: "none",
              }}
            />
          </>
        )}
      </div>
    );
  },
);

ErebusFace.displayName = "ErebusFace";

export default ErebusFace;
