import { useMemo, useState } from "react";
import { C } from "@/lib/palette";
import { getProvider, renderTemplate, stripHtml, addTracking } from "../email";
import { store, getState } from "../store";
import { loadPeople } from "../people/load";
import { scorePerson } from "../people/scoring";
import { Button, Card, Field, SectionTitle, TextArea, TextInput, Pill, Empty } from "../ui/primitives";
import type { Campaign, CampaignAudience, PersonType, ScoredPerson } from "../MarketingPanel.types";

const provider = getProvider();

export function CampaignsTab() {
  const campaigns = getState().campaigns;
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(campaigns[0]?.id ?? null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Button color={C.blue} onClick={() => setComposerOpen(true)}>+ New Campaign</Button>
        <div style={{ fontSize: 11, color: provider ? "#6aaedd" : C.orange }}>
          {provider ? `Provider: ${provider.name}` : "⚠ No email provider configured — set VITE_RESEND_KEY or VITE_SENDGRID_KEY"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
        <Card style={{ padding: 12 }}>
          <SectionTitle>Campaigns ({campaigns.length})</SectionTitle>
          {campaigns.length === 0 && <Empty icon="✉️" title="No campaigns yet" hint="Create your first campaign." />}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {campaigns.map((c) => (
              <button key={c.id} onClick={() => setSelectedId(c.id)}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 8,
                  background: selectedId === c.id ? `${C.blue}18` : "rgba(255,255,255,0.03)",
                  border: `0.5px solid ${selectedId === c.id ? C.blue : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer", color: "#f0ede8",
                }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                  <Pill color={statusColor(c.status)}>{c.status}</Pill>
                  <span style={{ fontSize: 10, color: "#6aaedd" }}>{c.stats.recipients} recipients</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div>
          {selectedId ? (
            <CampaignEditor id={selectedId} />
          ) : (
            <Card><Empty icon="✉️" title="Select or create a campaign" /></Card>
          )}
        </div>
      </div>

      {composerOpen && <NewCampaignModal onClose={() => setComposerOpen(false)} onCreated={(id) => { setComposerOpen(false); setSelectedId(id); }} />}
    </div>
  );
}

function statusColor(s: Campaign["status"]) {
  return s === "Sent" ? C.teal : s === "Sending" ? C.blue : s === "Failed" ? C.red : s === "Scheduled" ? C.purple : "#666";
}

/* ── New Campaign Modal ── */

function NewCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState(getState().businessInfo.businessName || "");
  const [fromEmail, setFromEmail] = useState(getState().businessInfo.email || "");

  function create() {
    if (!name.trim()) return;
    const id = crypto.randomUUID();
    const c: Campaign = {
      id, name, subject, body,
      status: "Draft",
      createdAt: Date.now(),
      fromName, fromEmail,
      audience: { kinds: ["Business"], tags: [], minScore: 40, maxScore: 100, emailOnly: true },
      stats: { recipients: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 },
    };
    store.addCampaign(c);
    store.log({ icon: "✉️", label: `Campaign created: "${name}"`, color: C.blue });
    onCreated(id);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Card style={{ width: 520, padding: 24, border: `1px solid ${C.blue}40` }}>
        <SectionTitle>New Email Campaign</SectionTitle>
        <Field label="Campaign Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div style={{ height: 10 }} />
        <Field label="Subject"><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <div style={{ height: 10 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="From Name"><TextInput value={fromName} onChange={(e) => setFromName(e.target.value)} /></Field>
          <Field label="From Email"><TextInput type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} /></Field>
        </div>
        <div style={{ height: 10 }} />
        <Field label="Body (HTML or plain text)">
          <TextArea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 140 }} />
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Button color={C.blue} variant="ghost" onClick={onClose} fullWidth>Cancel</Button>
          <Button color={C.teal} onClick={create} disabled={!name.trim()} fullWidth>Create</Button>
        </div>
      </Card>
    </div>
  );
}

/* ── Campaign Editor ── */

function CampaignEditor({ id }: { id: string }) {
  const campaign = getState().campaigns.find((c) => c.id === id);
  const [name, setName] = useState(campaign?.name ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [audience, setAudience] = useState<CampaignAudience>(campaign?.audience ?? { kinds: ["Business"], tags: [], minScore: 40, maxScore: 100, emailOnly: true });
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const allPeople: ScoredPerson[] = useMemo(() => loadPeople().map((p) => scorePerson(p)), []);

  const audienceList = useMemo(() => {
    return allPeople.filter((p) => {
      if (audience.kinds.length && !audience.kinds.includes(p.type)) return false;
      if (audience.emailOnly && !p.email) return false;
      if (p.capitalScore < audience.minScore) return false;
      if (p.capitalScore > audience.maxScore) return false;
      if (audience.tags.length && !audience.tags.some((t) => p.tags.includes(t))) return false;
      return true;
    });
  }, [allPeople, audience]);

  function persist() {
    store.updateCampaign(id, { name, subject, body, audience });
    store.log({ icon: "✉️", label: `Campaign updated: "${name}"`, color: C.blue });
  }

  async function sendNow() {
    if (!provider) { setError("No email provider configured."); return; }
    if (!subject.trim() || !body.trim()) { setError("Subject and body are required."); return; }
    if (!audienceList.length) { setError("Audience is empty — adjust filters."); return; }
    if (!campaign?.fromName || !campaign?.fromEmail) { setError("From name/email missing."); return; }

    setSending(true);
    setError(null);
    setProgress({ sent: 0, failed: 0, total: audienceList.length });
    store.updateCampaign(id, { status: "Sending" });

    let sent = 0, failed = 0, opened = 0, clicked = 0, delivered = 0, bounced = 0;
    for (const person of audienceList) {
      if (!person.email) continue;
      const recipientId = person.id;
      const vars = { first_name: person.name.split(" ")[0], name: person.name, company: person.company ?? "", email: person.email };
      const htmlBody = renderTemplate(body, vars);
      const tracked = addTracking(htmlBody, id, recipientId);
      const result = await provider.send({
        to: person.email,
        from: { name: campaign.fromName, email: campaign.fromEmail },
        subject: renderTemplate(subject, vars),
        html: tracked,
        text: stripHtml(htmlBody),
      });
      if (result.ok) { sent++; delivered++; } else { failed++; }
      setProgress({ sent, failed, total: audienceList.length });
    }

    store.updateCampaign(id, {
      status: failed === audienceList.length ? "Failed" : "Sent",
      sentAt: Date.now(),
      stats: { recipients: audienceList.length, delivered, opened, clicked, bounced, failed },
    });
    store.log({ icon: "📤", label: `Campaign "${name}" sent: ${sent} ok, ${failed} failed`, color: failed ? C.orange : C.teal });
    setSending(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <SectionTitle>✉️ Composer</SectionTitle>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <Button color={C.blue} variant="ghost" onClick={persist}>Save</Button>
            <Button color={C.red} variant="ghost" onClick={() => { store.removeCampaign(id); }}>Delete</Button>
            <Button color={C.teal} onClick={sendNow} loading={sending} disabled={!provider}>Send Now</Button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Subject" hint="Supports {{first_name}}, {{company}}">
            <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
        </div>
        <div style={{ height: 10 }} />
        <Field label="Body" hint="Supports {{first_name}}, {{name}}, {{company}}, {{email}}">
          <TextArea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 220 }} />
        </Field>
        {error && <div style={{ marginTop: 10, fontSize: 11, color: C.red }}>⚠ {error}</div>}
        {sending && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#6aaedd" }}>
            Sending… {progress.sent} ok / {progress.failed} failed of {progress.total}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle hint={`${audienceList.length} recipients match`}>🎯 Audience</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <Field label="Types">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {(["Family", "Business", "Personal"] as PersonType[]).map((t) => {
                const on = audience.kinds.includes(t);
                return (
                  <button key={t} onClick={() => setAudience((a) => ({ ...a, kinds: on ? a.kinds.filter((x) => x !== t) : [...a.kinds, t] }))}
                    style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", background: on ? `${C.blue}22` : "rgba(255,255,255,0.04)", border: `0.5px solid ${on ? C.blue : "rgba(255,255,255,0.1)"}`, color: on ? C.blue : "#6aaedd" }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Min score"><TextInput type="number" value={audience.minScore} onChange={(e) => setAudience((a) => ({ ...a, minScore: Number(e.target.value) }))} /></Field>
          <Field label="Max score"><TextInput type="number" value={audience.maxScore} onChange={(e) => setAudience((a) => ({ ...a, maxScore: Number(e.target.value) }))} /></Field>
          <Field label="Require email">
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#c8c8d0" }}>
              <input type="checkbox" checked={audience.emailOnly} onChange={(e) => setAudience((a) => ({ ...a, emailOnly: e.target.checked }))} />
              Only contacts with email
            </label>
          </Field>
        </div>
        <div style={{ marginTop: 12, maxHeight: 220, overflowY: "auto" }}>
          {audienceList.slice(0, 30).map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: 12, color: "#f0ede8", flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: "#6aaedd" }}>{p.email}</span>
              <Pill color={p.capitalScore >= 80 ? C.red : p.capitalScore >= 45 ? C.orange : C.blue}>{p.capitalScore}</Pill>
            </div>
          ))}
          {audienceList.length > 30 && <div style={{ padding: 8, fontSize: 11, color: "#6aaedd" }}>+{audienceList.length - 30} more</div>}
          {audienceList.length === 0 && <Empty icon="🎯" title="No matching contacts" />}
        </div>
      </Card>
    </div>
  );
}