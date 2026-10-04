import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type NexusLink = {
  provider: string;
  label: string;
  status: "off" | "on";
};

export type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: "draft" | "live" | "paused";
  spend: number;
  goal: string;
};

export type Track = {
  id: string;
  title: string;
  mood: string;
  stage: "sketch" | "mix" | "ready";
};

export type SearchNote = { id: string; query: string };

export type LifeState = {
  links: NexusLink[];
  campaigns: Campaign[];
  tracks: Track[];
  searches: SearchNote[];
};

const PROVIDERS = [
  "google",
  "microsoft",
  "slack",
  "notion",
  "github",
  "spotify",
  "meta",
  "x",
  "stripe",
  "calendar",
] as const;

const CHANNELS = ["Search", "Social", "Email", "Outreach"] as const;
const MOODS = ["Focus", "Night", "Drive", "Quiet"] as const;

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export const loadState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LifeState> => {
    const sql = await getSql();
    const uid = context.userId;
    const links = await sql<{ provider: string; label: string; status: string }>`
      select provider, label, status from nexus_links where user_id = ${uid}
    `;
    const campaigns = await sql<{
      id: string;
      name: string;
      channel: string;
      status: string;
      spend: number;
      goal: string;
    }>`
      select id, name, channel, status, spend, goal
      from lucid_campaigns where user_id = ${uid}
      order by updated_at desc
    `;
    const tracks = await sql<{ id: string; title: string; mood: string; stage: string }>`
      select id, title, mood, stage from veriton_tracks
      where user_id = ${uid} order by updated_at desc
    `;
    const searches = await sql<{ id: string; query: string }>`
      select id, query from omni_searches
      where user_id = ${uid} order by created_at desc limit 8
    `;
    return {
      links: links.map((row) => ({
        provider: row.provider,
        label: row.label,
        status: row.status === "on" ? "on" : "off",
      })),
      campaigns: campaigns.map((row) => ({
        ...row,
        status: row.status === "live" || row.status === "paused" ? row.status : "draft",
        spend: Number(row.spend) || 0,
      })),
      tracks: tracks.map((row) => ({
        ...row,
        stage: row.stage === "mix" || row.stage === "ready" ? row.stage : "sketch",
      })),
      searches,
    };
  });

export const saveLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { provider: string; label: string; status: "off" | "on" }) => {
    if (!PROVIDERS.includes(input.provider as (typeof PROVIDERS)[number])) {
      throw new Error("Unknown provider");
    }
    return {
      provider: input.provider,
      label: clip(input.label, 80),
      status: input.status === "on" ? "on" : "off",
    } as const;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into nexus_links (id, user_id, provider, label, status)
      values (${id}, ${context.userId}, ${data.provider}, ${data.label}, ${data.status})
      on conflict (user_id, provider) do update
      set label = excluded.label, status = excluded.status, updated_at = now()
    `;
    return { ok: true };
  });

export const addCampaign = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; channel: string; spend: number; goal: string }) => {
    const name = clip(input.name, 80);
    if (!name) throw new Error("Name required");
    const channel = CHANNELS.includes(input.channel as (typeof CHANNELS)[number])
      ? input.channel
      : "Search";
    const spend = Math.max(0, Math.min(1_000_000, Math.round(Number(input.spend) || 0)));
    return { name, channel, spend, goal: clip(input.goal, 120) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into lucid_campaigns (id, user_id, name, channel, status, spend, goal)
      values (${id}, ${context.userId}, ${data.name}, ${data.channel}, 'draft', ${data.spend}, ${data.goal})
    `;
    return { id };
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: Campaign["status"] }) => ({
    id: clip(input.id, 80),
    status: input.status === "live" || input.status === "paused" ? input.status : "draft",
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update lucid_campaigns set status = ${data.status}, updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const removeCampaign = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from lucid_campaigns where id = ${id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const addTrack = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; mood: string }) => {
    const title = clip(input.title, 80);
    if (!title) throw new Error("Title required");
    const mood = MOODS.includes(input.mood as (typeof MOODS)[number]) ? input.mood : "Focus";
    return { title, mood };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into veriton_tracks (id, user_id, title, mood, stage)
      values (${id}, ${context.userId}, ${data.title}, ${data.mood}, 'sketch')
    `;
    return { id };
  });

export const setTrackStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; stage: Track["stage"] }) => ({
    id: clip(input.id, 80),
    stage: input.stage === "mix" || input.stage === "ready" ? input.stage : "sketch",
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update veriton_tracks set stage = ${data.stage}, updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const removeTrack = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from veriton_tracks where id = ${id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const rememberSearch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((query: string) => {
    const q = clip(query, 120);
    if (!q) throw new Error("Empty search");
    return q;
  })
  .handler(async ({ context, data: query }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`
      insert into omni_searches (id, user_id, query) values (${id}, ${context.userId}, ${query})
    `;
    await sql`
      delete from omni_searches
      where user_id = ${context.userId}
        and id not in (
          select id from omni_searches where user_id = ${context.userId}
          order by created_at desc limit 8
        )
    `;
    return { ok: true };
  });
