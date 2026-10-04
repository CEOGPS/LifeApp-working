import type { BusinessInfo, NapFieldDiff, Severity } from "./MarketingPanel.types";

const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

const STREET_ABBR: Record<string, string> = {
  street: "st", avenue: "ave", boulevard: "blvd", drive: "dr", road: "rd",
  lane: "ln", court: "ct", place: "pl", terrace: "ter", parkway: "pkwy",
  north: "n", south: "s", east: "e", west: "w", northeast: "ne", northwest: "nw",
  southeast: "se", southwest: "sw",
};

export function normalizeAddress(a: string): string {
  return a
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .map((tok) => STREET_ABBR[tok] ?? tok)
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function normalizeName(n: string): string {
  return strip(n).replace(/inc$|llc$|co$|corp$|ltd$/, "");
}

export function canonicalFor(info: BusinessInfo) {
  return {
    name: normalizeName(info.businessName),
    phone: normalizePhone(info.phone),
    address: normalizeAddress(`${info.address} ${info.city} ${info.state} ${info.zip}`),
    website: strip(info.website.replace(/^https?:\/\//, "").replace(/\/$/, "")),
    hours: info.hours.trim().toLowerCase(),
  };
}

/**
 * Compare a listing snapshot against canonical info; produce a diff list.
 * This is deterministic — no LLM needed for NAP fields.
 */
export function diffSnapshots(
  info: BusinessInfo,
  snapshots: { listingName: string; name?: string; phone?: string; address?: string; website?: string; hours?: string }[]
): NapFieldDiff[] {
  const canon = canonicalFor(info);
  const out: NapFieldDiff[] = [];
  for (const s of snapshots) {
    const checks: Array<[keyof typeof canon, string | undefined, string]> = [
      ["name", s.name, info.businessName],
      ["phone", s.phone, info.phone],
      ["address", s.address, `${info.address}, ${info.city}, ${info.state} ${info.zip}`],
      ["website", s.website, info.website],
      ["hours", s.hours, info.hours],
    ];
    for (const [key, seen, canonicalLabel] of checks) {
      if (!seen) {
        out.push({ field: key, listing: s.listingName, canonical: canonicalLabel, seen: "—", severity: "High" });
        continue;
      }
      const canonVal = canon[key as keyof typeof canon];
      const seenNorm =
        key === "name" ? normalizeName(seen) :
        key === "phone" ? normalizePhone(seen) :
        key === "address" ? normalizeAddress(seen) :
        key === "website" ? strip(seen.replace(/^https?:\/\//, "").replace(/\/$/, "")) :
        seen.trim().toLowerCase();
      if (canonVal && seenNorm !== canonVal) {
        const severity: Severity = key === "phone" || key === "address" ? "Critical" : "High";
        out.push({ field: key, listing: s.listingName, canonical: canonicalLabel, seen, severity });
      }
    }
  }
  return out;
}

export function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function scoreFromDiffs(diffs: NapFieldDiff[]): number {
  const weight: Record<Severity, number> = { Critical: 18, High: 10, Medium: 5, Low: 2 };
  const penalty = diffs.reduce((sum, d) => sum + weight[d.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}