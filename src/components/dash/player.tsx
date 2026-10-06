import { useEffect, useState } from "react";

export type Cut = { id: string; title: string; artist: string; album: string; url: string; page: string; art: string };

type Snap = {
  track: Cut | null;
  queue: Cut[];
  index: number;
  paused: boolean;
  volume: number;
  muted: boolean;
  progress: number;
  duration: number;
  repeat: "off" | "all" | "one";
  shuffle: boolean;
};

const audio = typeof window !== "undefined" ? new Audio() : null;
if (audio) audio.preload = "auto";

let snap: Snap = {
  track: null,
  queue: [],
  index: 0,
  paused: true,
  volume: 0.8,
  muted: false,
  progress: 0,
  duration: 0,
  repeat: "off",
  shuffle: false,
};

const ears = new Set<() => void>();
function poke() {
  ears.forEach((fn) => fn());
}

function load(track: Cut | null, autoplay: boolean) {
  snap = { ...snap, track, paused: !autoplay || !track, progress: 0, duration: 0 };
  if (!audio) {
    poke();
    return;
  }
  audio.volume = snap.muted ? 0 : snap.volume;
  if (!track?.url) {
    audio.pause();
    audio.removeAttribute("src");
    poke();
    return;
  }
  if (audio.src !== track.url) {
    audio.src = track.url;
  }
  if (autoplay) void audio.play().catch(() => { snap = { ...snap, paused: true }; poke(); });
  else audio.pause();
  poke();
}

export function step(dir: number) {
  const queue = snap.queue;
  if (snap.repeat === "one" && dir > 0 && audio && snap.track?.url) {
    audio.currentTime = 0;
    snap = { ...snap, paused: false, progress: 0 };
    void audio.play().catch(() => { snap = { ...snap, paused: true }; poke(); });
    poke();
    return;
  }
  if (!queue.length) {
    stopCut();
    return;
  }
  let index = snap.index;
  if (snap.shuffle) index = Math.floor(Math.random() * queue.length);
  else {
    index += dir;
    if (index >= queue.length) index = snap.repeat === "all" ? 0 : snap.index;
    if (index < 0) index = queue.length - 1;
  }
  snap = { ...snap, index };
  load(queue[index] || null, true);
}

if (audio) {
  audio.addEventListener("timeupdate", () => {
    snap = { ...snap, progress: audio.currentTime };
    poke();
  });
  audio.addEventListener("loadedmetadata", () => {
    snap = { ...snap, duration: Number.isFinite(audio.duration) ? audio.duration : 0 };
    poke();
  });
  audio.addEventListener("ended", () => step(1));
}

export function usePlayer() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const hear = () => setTick((value) => value + 1);
    ears.add(hear);
    return () => { ears.delete(hear); };
  }, []);
  return snap;
}

export function playCut(track: Cut, queue: Cut[] = [track]) {
  const index = Math.max(0, queue.findIndex((row) => row.id === track.id));
  snap = { ...snap, queue: queue.length ? queue : [track], index };
  load(track, true);
}

export function togglePause() {
  if (!snap.track) return;
  if (!audio || !snap.track.url) {
    snap = { ...snap, paused: !snap.paused };
    poke();
    return;
  }
  if (snap.paused) {
    snap = { ...snap, paused: false };
    void audio.play().catch(() => { snap = { ...snap, paused: true }; poke(); });
  } else {
    audio.pause();
    snap = { ...snap, paused: true };
  }
  poke();
}

export function stopCut() {
  audio?.pause();
  if (audio) {
    audio.currentTime = 0;
    audio.removeAttribute("src");
  }
  snap = { ...snap, track: null, paused: true, progress: 0, duration: 0 };
  poke();
}

export function seekTo(time: number) {
  if (audio && snap.track?.url) audio.currentTime = time;
  snap = { ...snap, progress: time };
  poke();
}

export function setPlayerVolume(volume: number) {
  snap = { ...snap, volume, muted: false };
  if (audio) audio.volume = volume;
  poke();
}

export function setPlayerMuted(muted: boolean) {
  snap = { ...snap, muted };
  if (audio) audio.volume = muted ? 0 : snap.volume;
  poke();
}

export function setPlayerRepeat(repeat: Snap["repeat"]) {
  snap = { ...snap, repeat };
  poke();
}

export function setPlayerShuffle(shuffle: boolean) {
  snap = { ...snap, shuffle };
  poke();
}
