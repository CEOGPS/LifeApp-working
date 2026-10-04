import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { emptyBoard, sanitizeBoard, type Board } from "./board";

export const loadBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Board> => {
    const sql = await getSql();
    const rows = await sql<{ payload: string }>`
      select payload from life_board where user_id = ${context.userId}
    `;
    if (!rows[0]) return emptyBoard();
    try {
      return sanitizeBoard(JSON.parse(rows[0].payload));
    } catch {
      return emptyBoard();
    }
  });

export const saveBoard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Board) => {
    const board = sanitizeBoard(input);
    const payload = JSON.stringify(board);
    if (payload.length > 1_200_000) throw new Error("Board is too large");
    return payload;
  })
  .handler(async ({ context, data: payload }) => {
    const sql = await getSql();
    await sql`
      insert into life_board (user_id, payload)
      values (${context.userId}, ${payload})
      on conflict (user_id) do update
      set payload = excluded.payload, updated_at = now()
    `;
    return { ok: true };
  });

export type WebHit = { title: string; url: string };
export type VideoHit = { id: string; title: string; author: string };

export const searchWeb = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((query: string) => query.trim().slice(0, 120))
  .handler(async ({ data: query }): Promise<WebHit[]> => {
    if (!query) return [];
    const hits: WebHit[] = [];
    try {
      const wiki = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json`,
      );
      const data = (await wiki.json()) as [string, string[], string[], string[]];
      data[1]?.forEach((title, i) => {
        const url = data[3]?.[i];
        if (title && url) hits.push({ title, url });
      });
    } catch {
      /* ignore */
    }
    try {
      const ddg = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      );
      const data = (await ddg.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        Heading?: string;
        RelatedTopics?: { Text?: string; FirstURL?: string }[];
      };
      if (data.Heading && data.AbstractURL) hits.unshift({ title: data.Heading, url: data.AbstractURL });
      for (const topic of data.RelatedTopics ?? []) {
        if (topic.Text && topic.FirstURL) hits.push({ title: topic.Text.slice(0, 140), url: topic.FirstURL });
      }
    } catch {
      /* ignore */
    }
    const seen = new Set<string>();
    return hits.filter((hit) => {
      if (seen.has(hit.url)) return false;
      seen.add(hit.url);
      return true;
    }).slice(0, 8);
  });

export const searchVideos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((query: string) => query.trim().slice(0, 120))
  .handler(async ({ data: query }): Promise<VideoHit[]> => {
    if (!query) return [];
    const hosts = ["https://pipedapi.kavin.rocks", "https://pipedapi.adminforge.de"];
    for (const host of hosts) {
      try {
        const res = await fetch(`${host}/search?q=${encodeURIComponent(query)}&filter=videos`, {
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { items?: { url?: string; title?: string; uploaderName?: string }[] };
        const items = (data.items ?? [])
          .map((item) => {
            const id = item.url?.split("v=")[1]?.slice(0, 20) ?? "";
            if (!id || !item.title) return null;
            return { id, title: item.title.slice(0, 140), author: (item.uploaderName ?? "").slice(0, 80) };
          })
          .filter((item): item is VideoHit => item !== null)
          .slice(0, 6);
        if (items.length) return items;
      } catch {
        /* try next host */
      }
    }
    return [];
  });
