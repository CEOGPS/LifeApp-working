import { useState } from "react";
import { C } from "@/lib/palette";
import { callLLM } from "../llm";
import { getState, store } from "../store";
import { Button, Card, Field, SectionTitle, TextArea, TextInput, Pill, Empty } from "../ui/primitives";

type ContentKind = "blog" | "social" | "gbp" | "email" | "repurpose";

const KINDS: { kind: ContentKind; label: string; icon: string; color: string }[] = [
  { kind: "blog",      label: "Blog Brief",       icon: "📝", color: C.blue },
  { kind: "social",    label: "Social Posts",     icon: "📱", color: C.purple },
  { kind: "gbp",       label: "GBP Posts",        icon: "📍", color: C.teal },
  { kind: "email",     label: "Email Draft",      icon: "✉️", color: C.orange },
  { kind: "repurpose", label: "Repurpose",        icon: "♻️", color: C.blue },
];

interface ContentDraft {
  id: string;
  kind: ContentKind;
  topic: string;
  audience: string;
  tone: string;
  output: string;
  createdAt: number;
}

const DRAFTS_KEY = "content_drafts_v1";

function loadDrafts(): ContentDraft[] {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "[]") as ContentDraft[]; } catch { return []; }
}
function saveDrafts(d: ContentDraft[]) { localStorage.setItem(DRAFTS_KEY, JSON.stringify(d)); }

export function ContentTab() {
  const target = getState().seoTarget;
  const [kind, setKind] = useState<ContentKind>("blog");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("practical, friendly, expert");
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [drafts, setDrafts] = useState<ContentDraft[]>(loadDrafts);

  function persist(next: ContentDraft[]) { setDrafts(next); saveDrafts(next); }

  async function generate() {
    if (!topic.trim()) return;
    setRunning(true);
    setOutput("");
    const ctx = target.company ? `The business is "${target.company}"${target.industry ? ` (${target.industry})` : ""}${target.location ? ` in ${target.location}` : ""}.` : "";
    const prompt = PROMPTS[kind]({ topic, audience, tone, source, ctx });
    try {
      const out = await callLLM(prompt, { system: "You are a senior content strategist. Output clean markdown. Be specific, not generic." });
      setOutput(out);
      const draft: ContentDraft = { id: crypto.randomUUID(), kind, topic, audience, tone, output: out, createdAt: Date.now() };
      persist([draft, ...drafts].slice(0, 50));
      store.log({ icon: KINDS.find((k) => k.kind === kind)!.icon, label: `Content: ${KINDS.find((k) => k.kind === kind)!.label} — "${topic}"`, color: C.blue });
    } catch (e) {
      setOutput(`⚠ ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  function pushToCampaign(draft: ContentDraft) {
    const campaigns = getState().campaigns;
    const existing = campaigns.find((c) => c.status === "Draft");
    if (existing) {
      store.updateCampaign(existing.id, { body: draft.output });
      store.log({ icon: "✉️", label: `Draft pushed to campaign "${existing.name}"`, color: C.orange });
    } else {
      store.addCampaign({
        id: crypto.randomUUID(),
        name: `Content — ${draft.topic.slice(0, 40)}`,
        subject: draft.topic,
        body: draft.output,
        status: "Draft",
        createdAt: Date.now(),
        audience: { kinds: ["Business", "Personal"], tags: [], minScore: 40, maxScore: 100, emailOnly: true },
        stats: { recipients: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 },
      });
      store.log({ icon: "✉️", label: `New draft campaign created from content`, color: C.orange });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <SectionTitle hint={target.company ? `Context: ${target.company}` : "Set SEO target for better context (SEO tab)"}>
          ✍️ Content Generator
        </SectionTitle>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {KINDS.map((k) => (
            <button key={k.kind} onClick={() => setKind(k.kind)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: kind === k.kind ? `${k.color}22` : "rgba(255,255,255,0.04)",
                border: `0.5px solid ${kind === k.kind ? k.color : "rgba(255,255,255,0.1)"}`,
                color: kind === k.kind ? k.color : "#6aaedd",
              }}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Field label="Topic / Working title">
            <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 'How to spot a slab leak before it floods your home'" />
          </Field>
          <Field label="Audience">
            <TextInput value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Atlanta homeowners, 30-60" />
          </Field>
          <Field label="Tone">
            <TextInput value={tone} onChange={(e) => setTone(e.target.value)} />
          </Field>
          <Field label="Source (optional)" hint="Paste notes, transcript, or URL for repurposing">
            <TextInput value={source} onChange={(e) => setSource(e.target.value)} placeholder="Transcript, notes, or original URL" />
          </Field>
        </div>
        <Button onClick={generate} color={C.blue} loading={running} disabled={!topic.trim()} fullWidth>
          ⚡ Generate
        </Button>
      </Card>

      {output && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>Output</div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button color={C.teal} variant="ghost" onClick={() => navigator.clipboard?.writeText(output)}>📋 Copy</Button>
              <Button color={C.orange} variant="ghost" onClick={() => {
                const draft: ContentDraft = { id: crypto.randomUUID(), kind, topic, audience, tone, output, createdAt: Date.now() };
                pushToCampaign(draft);
              }}>✉️ → Campaign</Button>
              <Button color={C.red} variant="ghost" onClick={() => setOutput("")}>Clear</Button>
            </div>
          </div>
          <TextArea value={output} onChange={(e) => setOutput(e.target.value)} style={{ minHeight: 320 }} />
        </Card>
      )}

      <Card>
        <SectionTitle hint="Saved drafts you can reopen, copy, or push to a campaign.">🗂 Recent Drafts ({drafts.length})</SectionTitle>
        {drafts.length === 0 ? (
          <Empty icon="📄" title="No drafts yet" hint="Generated content will be saved here automatically." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {drafts.map((d) => (
              <div key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 16 }}>{KINDS.find((k) => k.kind === d.kind)?.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#f0ede8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.topic || "(untitled)"}</div>
                  <div style={{ fontSize: 10, color: "#6aaedd", marginTop: 2 }}>
                    {KINDS.find((k) => k.kind === d.kind)?.label} · {new Date(d.createdAt).toLocaleString()}
                  </div>
                </div>
                <Button color={C.blue} variant="ghost" onClick={() => { setOutput(d.output); setTopic(d.topic); setKind(d.kind); }}>Open</Button>
                <Button color={C.orange} variant="ghost" onClick={() => pushToCampaign(d)}>→ Campaign</Button>
                <Button color={C.red} variant="ghost" onClick={() => persist(drafts.filter((x) => x.id !== d.id))}>Delete</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const PROMPTS: Record<ContentKind, (a: { topic: string; audience: string; tone: string; source: string; ctx: string }) => string> = {
  blog: (a) => `${a.ctx}
Write a complete blog brief and outline for the topic: "${a.topic}".
Audience: ${a.audience || "general"}.
Tone: ${a.tone}.

Include:
- SEO title (≤60 chars) and meta description (≤155)
- Target primary keyword + 5 secondary keywords
- H1, H2, H3 outline
- Intro hook + key points per section
- FAQ block (4 questions with answers)
- Internal + external linking suggestions
- Suggested CTA
Write in clean markdown.`,
  social: (a) => `${a.ctx}
Write 5 social posts about: "${a.topic}".
Audience: ${a.audience || "general"}. Tone: ${a.tone}.
For each: platform (LinkedIn / Instagram / Facebook), hook, body, hashtags, and CTA. Keep each post ≤120 words.`,
  gbp: (a) => `${a.ctx}
Write 4 Google Business Profile posts about: "${a.topic}".
Each post: 80–120 words, plain text, one clear CTA, 1–2 emojis max, no hashtags. Vary angles: tip, offer, behind-the-scenes, FAQ.`,
  email: (a) => `${a.ctx}
Write a marketing email about: "${a.topic}".
Audience: ${a.audience || "customers"}. Tone: ${a.tone}.
Include: subject line (3 options), preview text, body (≤200 words), and CTA. Return as markdown with clear labels.`,
  repurpose: (a) => `${a.ctx}
Repurpose the following source into 5 derivative assets:
1. LinkedIn post
2. Twitter/X thread (5 tweets)
3. Instagram caption
4. Email newsletter section
5. Short-form video script (~30s)

Topic: "${a.topic}"
Source:
"""
${a.source || "(no source provided — infer from topic)"}
"""`,
};