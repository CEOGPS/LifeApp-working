import type { NudgeKind, Person } from "../MarketingPanel.types";

export function upcomingBirthdayInDays(birthday: string | undefined, today = new Date()): number | null {
  if (!birthday) return null;
  const [, m, d] = birthday.split("-").map(Number);
  if (!m || !d) return null;
  const bday = new Date(today.getFullYear(), m - 1, d);
  if (bday < today) bday.setFullYear(today.getFullYear() + 1);
  return Math.ceil((bday.getTime() - today.getTime()) / 86400000);
}

export function buildNudgePrompt(person: Person, kind: NudgeKind): string {
  const days = upcomingBirthdayInDays(person.birthday);
  const bdayLine = days !== null && days <= 30 ? `⚠️ Birthday in ${days} days.` : "";
  const base = `Chris Green is a plumbing contractor in Atlanta. Write in his voice — warm, concise, non-salesy.`;
  switch (kind) {
    case "message":
      return `${base}
Write a short outreach message (under 50 words) to ${person.name} (${person.type} — ${person.subtype}${person.company ? `, ${person.company}` : ""}).
${bdayLine}
Notes: ${person.notes ?? "none"}
Last contact: ${person.lastContact ?? "unknown"}
If business contact, weave in one subtle value mention.`;
    case "birthday":
      return `${base}
Write a birthday note (under 40 words) to ${person.name}.
${person.favorites?.food ? `Their favorite food: ${person.favorites.food}.` : ""}
${person.notes ? `Notes: ${person.notes}` : ""}`;
    case "reconnect":
      return `${base}
Write a reconnection message (under 60 words) to ${person.name} (last contact: ${person.lastContact ?? "long ago"}).
Acknowledge the gap naturally; do not apologize excessively.`;
    case "referral":
      return `${base}
Write a referral request (under 60 words) to ${person.name} (${person.subtype}${person.company ? ` at ${person.company}` : ""}).
Ask naturally; offer reciprocity.`;
    case "voicenote":
      return `${base}
Write a voice note SCRIPT (spoken words only, ~30–45 seconds) to ${person.name}.
Lead with something personal; end with a light business touch if appropriate.`;
  }
}