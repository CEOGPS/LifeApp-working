import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { callTool } from "@/lib/app-data/client.server";
import { ConnectorType, GoogleCalendarTools } from "@/lib/app-data/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function device(value: string) {
  const id = String(value || "").trim();
  if (!UUID.test(id)) throw new Error("bad device");
  return id;
}

export const pullBoard = createServerFn({ method: "POST" })
  .validator((id: string) => device(id))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ payload: string; updated_at: string }>`
      select payload, updated_at from life_board where user_id = ${data}
    `;
    if (!rows[0]) return null;
    return { payload: rows[0].payload, at: new Date(rows[0].updated_at).getTime() };
  });

export const pushBoard = createServerFn({ method: "POST" })
  .validator((input: { device: string; payload: string }) => {
    const id = device(input?.device);
    const payload = String(input?.payload || "");
    if (payload.length > 900_000) throw new Error("Board is too large");
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    delete parsed.keys;
    delete parsed.vault;
    return { id, payload: JSON.stringify(parsed) };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into life_board (user_id, payload, updated_at)
      values (${data.id}, ${data.payload}, now())
      on conflict (user_id) do update
      set payload = excluded.payload, updated_at = now()
    `;
    return { ok: true as const, at: Date.now() };
  });

export const askNyx = createServerFn({ method: "POST" })
  .validator((input: { question: string; facts: string }) => {
    const question = String(input?.question || "").trim().slice(0, 400);
    const facts = String(input?.facts || "").slice(0, 1800);
    if (!question) throw new Error("question required");
    return { question, facts };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, text: "" };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 180,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are Nyx, the LifeOS assistant. Use only the facts given. If a fact is missing, say it is not on the board. Never invent names, balances, times, or lead statuses.",
          },
          { role: "user", content: `Facts:\n${data.facts}\n\nQuestion: ${data.question}` },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, text: "" };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { ok: true as const, text: (body.choices?.[0]?.message?.content || "").slice(0, 600) };
  });

export type DayEvent = { title: string; when: string };

export const pullCalendar = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async (): Promise<{ ok: boolean; events: DayEvent[]; note: string }> => {
    const start = new Date();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const result = await callTool(
      GoogleCalendarTools.search,
      { timeMin: start.toISOString(), timeMax: end.toISOString(), maxResults: 6 },
      { connectorType: ConnectorType.GoogleCalendar },
    );
    if (!result.ok) {
      return { ok: false, events: [], note: result.pending ? "Calendar is waiting on the Google connection." : result.errorMessage || "Calendar is not connected." };
    }
    const raw = result.data as { items?: { summary?: string; start?: { dateTime?: string; date?: string } }[] } | { summary?: string; start?: { dateTime?: string; date?: string } }[];
    const items = Array.isArray(raw) ? raw : raw?.items ?? [];
    const events = items.slice(0, 6).map((item) => ({
      title: String(item.summary || "Untitled").slice(0, 80),
      when: String(item.start?.dateTime || item.start?.date || "").slice(0, 32),
    }));
    return { ok: true, events, note: events.length ? "From Google Calendar." : "Google Calendar returned no events today." };
  });
