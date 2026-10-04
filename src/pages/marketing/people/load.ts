import type { Person } from "../MarketingPanel.types";

interface ContactRaw { id: string; firstName?: string; lastName?: string; name?: string; group?: string; email?: string; phone?: string; lastContact?: string; tags?: string[]; notes?: string; note?: string; birthday?: string; company?: string; photo?: string; }
interface CrmRaw { id: string; name?: string; tag?: string; stage?: string; email?: string; phone?: string; lastContact?: string; notes?: string; birthday?: string; company?: string; value?: string; }
interface FamilyRaw { id: string; name?: string; relation?: string; email?: string; phone?: string; reminders?: unknown[]; tags?: string[]; notes?: string; birthday?: string; kpi?: { connect?: number; support?: number; milestone?: string }; favorites?: { food?: string }; photo?: string; }

function read<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; }
}

export function loadPeople(): Person[] {
  const contacts = read<ContactRaw>("lifeos_contacts");
  const crm = read<CrmRaw>("lifeos_crm");
  const family = read<FamilyRaw>("family_members_v2");

  const out: Person[] = [];

  for (const m of family) {
    out.push({
      id: `fam_${m.id}`,
      name: m.name ?? "Unknown",
      type: "Family",
      subtype: m.relation ?? "Family",
      email: m.email, phone: m.phone,
      lastContact: m.reminders?.length ? "Recent" : undefined,
      tags: m.tags ?? [],
      notes: m.notes,
      birthday: m.birthday,
      kpi: m.kpi,
      favorites: m.favorites,
      photo: m.photo,
    });
  }

  for (const c of contacts) {
    const name = `${c.firstName ?? ""} ${c.lastName ?? c.name ?? ""}`.trim();
    if (!name || name === "Chris Green") continue;
    out.push({
      id: `con_${c.id}`,
      name,
      type: c.group === "Family" ? "Family" : c.group === "Work" ? "Business" : "Personal",
      subtype: c.group ?? "Contact",
      email: c.email, phone: c.phone,
      lastContact: c.lastContact,
      tags: c.tags ?? [],
      notes: c.notes ?? c.note,
      birthday: c.birthday,
      company: c.company,
      photo: c.photo,
    });
  }

  for (const c of crm) {
    out.push({
      id: `crm_${c.id}`,
      name: c.name ?? "Unknown",
      type: "Business",
      subtype: c.tag ?? c.stage ?? "Lead",
      email: c.email, phone: c.phone,
      lastContact: c.lastContact,
      tags: [c.tag, c.stage].filter(Boolean) as string[],
      notes: c.notes,
      birthday: c.birthday,
      company: c.company,
      stage: c.stage,
      value: c.value,
    });
  }

  // Deduplicate by normalized name+email
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = `${p.name.toLowerCase()}|${(p.email ?? "").toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}