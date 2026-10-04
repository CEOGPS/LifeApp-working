/**
 * Runtime key overrides for ErebusMedia (Integrations vault / Creator Studio).
 * Keeps secrets out of a second code path — ErebusMedia KEY getters read these first.
 */
export type ErebusMediaKeyBag =
  | "stability"
  | "elevenlabs"
  | "replicate"
  | "luma"
  | "did"
  | "hf"
  | "runway"
  | "uploadUrl";

const overrides: Partial<Record<ErebusMediaKeyBag, string>> = {};

export function setErebusMediaKeys(
  partial: Partial<Record<ErebusMediaKeyBag, string | undefined | null>>,
): void {
  for (const [k, v] of Object.entries(partial) as [ErebusMediaKeyBag, string | undefined | null][]) {
    const t = (v || "").trim();
    if (t) overrides[k] = t;
    else delete overrides[k];
  }
}

export function getErebusMediaKeyOverride(name: ErebusMediaKeyBag): string {
  return overrides[name] || "";
}

export function clearErebusMediaKeys(): void {
  for (const k of Object.keys(overrides) as ErebusMediaKeyBag[]) delete overrides[k];
}
