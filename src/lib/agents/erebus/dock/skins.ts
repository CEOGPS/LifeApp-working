// Talking-head skins. The old blinking portrait is not used.
import type React from "react";
import type { ErebusFaceEyes, ErebusFaceFeatureBox } from "../ui/ErebusFace";

export type SkinLayer = "rain" | "scanlines" | "vignette" | "flicker";

export interface DockSkin {
  id: string;
  label: string;
  src: string;
  auraRgb: string;
  featureTone: "dark" | "glow" | "none";
  imgStyle?: React.CSSProperties;
  layers: SkinLayer[];
  rainRgb?: string;
  background: string;
  eyes?: ErebusFaceEyes;
  mouth?: ErebusFaceFeatureBox;
  lidBackground?: string;
  mouthBackground?: string;
  rainOpacity?: number;
  rainDensity?: number;
  holo?: boolean;
  aspect?: number;
}

export const EREBUS_PORTRAIT = "/agents/avatars/nova.mp4";
export const DEFAULT_SKIN_ID = "nova";

const clip = (id: string, label: string, auraRgb: string): DockSkin => ({
  id,
  label,
  src: `/agents/avatars/${id}.mp4`,
  auraRgb,
  featureTone: "none",
  layers: [],
  background: "#000000",
  aspect: 3 / 4,
});

export const DOCK_SKINS: DockSkin[] = [
  clip("nova", "Nova", "180,150,110"),
  clip("ember", "Ember", "220,70,50"),
  clip("nyx", "Nyx", "210,180,90"),
];

export function getSkin(id: string | undefined): DockSkin {
  return DOCK_SKINS.find((s) => s.id === id) || DOCK_SKINS[0];
}
