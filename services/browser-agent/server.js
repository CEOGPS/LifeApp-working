// ============================================================
// Erebus Browser Agent — v2.0 (Fixed)
// Puppeteer-powered browser automation with WebSocket takeover
// Runs at http://localhost:8100
// ============================================================

import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { WebSocketServer } from "ws";
import http from "http";
import "dotenv/config";

const app = express();
const PORT = parseInt(process.env.BROWSER_AGENT_PORT || "8100");
const server = http.createServer(app);

// ── WebSocket for browser takeover ─────────────────────────
const wss = new WebSocketServer({ server });
const wsSessions = new Map();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("sessionId");
  
  if (sessionId) {
    wsSessions.set(sessionId, ws);
    console.log(`[WS] Session ${sessionId} connected`);
    
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        const page = await getPage(sessionId);
        
        switch (data.type) {
          case "click":
            await page.click(data.selector);
            ws.send(JSON.stringify({ type: "result", success: true, action: "click" }));
            break;
            
          case "type":
            await page.type(data.selector, data.text);
            ws.send(JSON.stringify({ type: "result", success: true, action: "type" }));
            break;
            
          case "scroll":
            await page.evaluate(`window.scrollTo(0, ${data.y})`);
            ws.send(JSON.stringify({ type: "result", success: true, action: "scroll" }));
            break;
            
          case "evaluate":
            const result = await page.evaluate(data.script);
            ws.send(JSON.stringify({ type: "result", result, action: "evaluate" }));
            break;
            
          case "get_html":
            const html = await page.content();
            ws.send(JSON.stringify({ type: "result", html, action: "get_html" }));
            break;
            
          default:
            ws.send(JSON.stringify({ type: "error", message: `Unknown action: ${data.type}` }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
    });
    
    ws.on("close", () => {
      wsSessions.delete(sessionId);
      console.log(`[WS] Session ${sessionId} disconnected`);
    });
  }
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Browser pool ────────────────────────────────────────────
let browser = null;
const sessions = new Map();

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--window-size=1280,900",
      ],
    });
    console.log("[Browser] Launched");
  }
  return browser;
}

async function getPage(sessionId = "default") {
  const existing = sessions.get(sessionId);
  if (existing && !existing.page.isClosed()) {
    return existing.page;
  }
  
  const br = await getBrowser();
  const page = await br.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  
  sessions.set(sessionId, { page, createdAt: Date.now() });
  console.log(`[Browser] Session ${sessionId} created`);
  return page;
}

// ── HTML extraction helpers ─────────────────────────────────
function extractText(html, selector = null) {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, [aria-hidden='true']").remove();
  const root = selector ? $(selector) : $("body");
  const text = root.text().replace(/\s+/g, " ").trim();
  return text.slice(0, 8000);
}

function extractLinks(html, baseUrl = "") {
  const $ = cheerio.load(html);
  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href && !href.startsWith("#") && text.length > 1) {
      try {
        const abs = new URL(href, baseUrl).href;
        links.push({ text: text.slice(0, 80), href: abs });
      } catch {}
    }
  });
  return links.slice(0, 30);
}

// ── Health check ────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ 
    status: "online", 
    service: "erebus-browser-agent",
    sessions: sessions.size,
    wsConnections: wsSessions.size
  });
});

// ── Session management ──────────────────────────────────────
app.post("/session/create", async (req, res) => {
  const { sessionId = crypto.randomUUID() } = req.body;
  try {
    await getPage(sessionId);
    const wsUrl = `ws://localhost:${PORT}/ws?sessionId=${sessionId}`;
    res.json({ success: true, sessionId, wsUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/session/:sessionId/takeover", async (req, res) => {
  const { sessionId } = req.params;
  const ws = wsSessions.get(sessionId);
  if (ws) {
    ws.send(JSON.stringify({ type: "takeover", active: true }));
    res.json({ success: true, message: "User takeover active. Use WebSocket for control." });
  } else {
    res.status(404).json({ error: "Session not connected via WebSocket" });
  }
});

app.post("/session/:sessionId/release", async (req, res) => {
  const { sessionId } = req.params;
  const ws = wsSessions.get(sessionId);
  if (ws) {
    ws.send(JSON.stringify({ type: "takeover", active: false }));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

app.post("/session/:sessionId/close", async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (session && !session.page.isClosed()) {
    await session.page.close();
  }
  sessions.delete(sessionId);
  res.json({ success: true, closed: sessionId });
});

// ── Browse endpoints ────────────────────────────────────────
app.post("/browse/navigate", async (req, res) => {
  const { url, sessionId = "default", waitFor = "networkidle2", timeout = 20000 } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const page = await getPage(sessionId);
    await page.goto(url, { waitUntil: waitFor, timeout });
    const html = await page.content();
    const title = await page.title();
    const current = page.url();
    const text = extractText(html);
    const links = extractLinks(html, current);

    res.json({ success: true, url: current, title, text, links, sessionId });
  } catch (e) {
    res.status(500).json({ error: e.message, url });
  }
});

app.post("/browse/extract", async (req, res) => {
  const { sessionId = "default", selector = null, extractType = "text" } = req.body;

  try {
    const page = await getPage(sessionId);
    const html = await page.content();
    const url = page.url();
    const title = await page.title();

    if (extractType === "links") {
      return res.json({ success: true, url, title, links: extractLinks(html, url) });
    }
    if (extractType === "table") {
      const tables = await page.$$eval("table", tbls =>
        tbls.map(tbl => {
          const rows = Array.from(tbl.querySelectorAll("tr")).map(tr =>
            Array.from(tr.querySelectorAll("th,td")).map(c => c.innerText.trim())
          );
          return rows;
        })
      );
      return res.json({ success: true, url, title, tables });
    }
    
    const text = extractText(html, selector);
    res.json({ success: true, url, title, text, selector });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/browse/screenshot", async (req, res) => {
  const { sessionId = "default", fullPage = false, selector = null } = req.body;

  try {
    const page = await getPage(sessionId);
    let screenshotBuf;

    if (selector) {
      const el = await page.$(selector);
      screenshotBuf = el
        ? await el.screenshot({ type: "png" })
        : await page.screenshot({ type: "png", fullPage });
    } else {
      screenshotBuf = await page.screenshot({ type: "png", fullPage });
    }

    const b64 = Buffer.from(screenshotBuf).toString("base64");
    const url = page.url();
    res.json({ success: true, url, screenshot: `data:image/png;base64,${b64}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/browse/click", async (req, res) => {
  const { selector, text: btnText, sessionId = "default" } = req.body;

  try {
    const page = await getPage(sessionId);
    let clicked = false;

    if (selector) {
      try {
        await page.click(selector);
        clicked = true;
      } catch {}
    }

    if (!clicked && btnText) {
      const els = await page.$$("a, button, [role=button], input[type=submit]");
      for (const el of els) {
        const elText = await el.evaluate(e => e.innerText || e.value || e.textContent || "");
        if (elText.toLowerCase().includes(btnText.toLowerCase())) {
          await el.click();
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      return res.status(404).json({ error: "Element not found", selector, btnText });
    }

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
    const html = await page.content();
    const title = await page.title();
    const url = page.url();
    const text = extractText(html);

    res.json({ success: true, clicked: true, url, title, text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/browse/fill", async (req, res) => {
  const { fields, submit = false, submitSelector = null, sessionId = "default" } = req.body;

  if (!fields || !Array.isArray(fields)) {
    return res.status(400).json({ error: "fields array required" });
  }

  try {
    const page = await getPage(sessionId);
    const results = [];

    for (const { selector, value, type = "input" } of fields) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        if (type === "select") {
          await page.select(selector, value);
        } else {
          await page.click(selector, { clickCount: 3 });
          await page.type(selector, value, { delay: 30 });
        }
        results.push({ selector, filled: true });
      } catch (e) {
        results.push({ selector, filled: false, error: e.message });
      }
    }

    if (submit) {
      const sel = submitSelector || "button[type=submit], input[type=submit]";
      try {
        await page.click(sel);
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
      } catch (e) {
        results.push({ selector: sel, filled: false, error: `submit error: ${e.message}` });
      }
    }

    const html = await page.content();
    const url = page.url();
    const title = await page.title();
    const text = extractText(html);

    res.json({ success: true, results, url, title, text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/browse/search", async (req, res) => {
  const { query, engine = "google", sessionId = "default", limit = 10 } = req.body;
  if (!query) return res.status(400).json({ error: "query is required" });

  try {
    const page = await getPage(sessionId);
    const encodedQ = encodeURIComponent(query);

    let searchUrl;
    if (engine === "ddg") {
      searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQ}`;
    } else {
      searchUrl = `https://www.google.com/search?q=${encodedQ}&num=${limit}`;
    }

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    const html = await page.content();
    const $ = cheerio.load(html);
    const results = [];

    if (engine === "ddg") {
      $(".result").each((_, el) => {
        const title = $(el).find(".result__title").text().trim();
        const href = $(el).find(".result__url").text().trim();
        const snippet = $(el).find(".result__snippet").text().trim();
        if (title && results.length < limit) {
          results.push({ title, url: "https://" + href, snippet });
        }
      });
    } else {
      $("div.g").each((_, el) => {
        const title = $(el).find("h3").first().text().trim();
        const href = $(el).find("a").first().attr("href") || "";
        const snippet = $(el).find(".VwiC3b").first().text().trim();
        if (title && href.startsWith("http") && results.length < limit) {
          results.push({ title, url: href, snippet });
        }
      });
    }

    res.json({ success: true, query, engine, results });
  } catch (e) {
    res.status(500).json({ error: e.message, query });
  }
});

app.post("/browse/evaluate", async (req, res) => {
  const { script, sessionId = "default" } = req.body;
  if (!script) return res.status(400).json({ error: "script is required" });

  try {
    const page = await getPage(sessionId);
    const result = await page.evaluate(script);
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Brilliant Directories ───────────────────────────────────
app.post("/browse/bd/login", async (req, res) => {
  const { siteUrl, email, password, sessionId = "bd_session" } = req.body;
  if (!siteUrl || !email || !password) {
    return res.status(400).json({ error: "siteUrl, email, and password are required" });
  }

  try {
    const page = await getPage(sessionId);
    await page.goto(`${siteUrl}/login`, { waitUntil: "networkidle2", timeout: 20000 });
    await page.waitForSelector("input[type='email'], input[name='email'], #email", { timeout: 8000 });
    await page.type("input[type='email'], input[name='email'], #email", email);
    await page.type("input[type='password'], input[name='password'], #password", password);
    await page.click("button[type='submit'], input[type='submit'], .login-btn");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});

    const url = page.url();
    const text = extractText(await page.content());
    const loggedIn = !url.includes("/login");

    res.json({ success: loggedIn, url, text: text.slice(0, 2000), sessionId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/browse/bd/members", async (req, res) => {
  const { siteUrl, search = "", category = "", page: pageNum = 1, sessionId = "bd_session" } = req.body;

  try {
    const page = await getPage(sessionId);
    const params = new URLSearchParams({ search, cat: category, page: pageNum });
    await page.goto(`${siteUrl}/members?${params}`, { waitUntil: "networkidle2", timeout: 20000 });

    const members = await page.$$eval(".member-card, .member-item, .directory-listing", cards =>
      cards.map(card => ({
        name: card.querySelector(".member-name, h2, h3")?.innerText?.trim() || "",
        email: card.querySelector("[href^='mailto:']")?.href?.replace("mailto:", "") || "",
        phone: card.querySelector(".phone, [href^='tel:']")?.innerText?.trim() || "",
        category: card.querySelector(".category, .membership-type")?.innerText?.trim() || "",
        url: card.querySelector("a")?.href || "",
      }))
    );

    res.json({ success: true, siteUrl, members, total: members.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/browse/bd/scrape-directory", async (req, res) => {
  const { siteUrl, maxPages = 3, sessionId = "bd_session" } = req.body;
  const allMembers = [];

  try {
    for (let p = 1; p <= maxPages; p++) {
      const page = await getPage(sessionId);
      await page.goto(`${siteUrl}/members?page=${p}`, { waitUntil: "networkidle2", timeout: 20000 });

      const members = await page.$$eval(".member-card, .member-item, .listing", cards =>
        cards.map(card => ({
          name: card.querySelector(".member-name, h2, h3, .name")?.innerText?.trim() || "",
          email: card.querySelector("[href^='mailto:']")?.href?.replace("mailto:", "") || "",
          phone: card.querySelector(".phone, [href^='tel:']")?.innerText?.trim() || "",
          category: card.querySelector(".category, .plan-name")?.innerText?.trim() || "",
          url: card.querySelector("a[href*='/member/']")?.href || "",
          location: card.querySelector(".location, .city")?.innerText?.trim() || "",
        }))
      );

      if (members.length === 0) break;
      allMembers.push(...members);
    }

    res.json({ success: true, siteUrl, members: allMembers, total: allMembers.length });
  } catch (e) {
    res.status(500).json({ error: e.message, members: allMembers });
  }
});

// ── Video Generation Routes ────────────────────────────────
import videoGenRoutes from "./video-gen.js";
app.use("/", videoGenRoutes);

// ── Cleanup old sessions hourly ─────────────────────────────
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (session.createdAt < oneHourAgo) {
      session.page.close().catch(() => {});
      sessions.delete(id);
      console.log(`[Cleanup] Removed old session ${id}`);
    }
  }
}, 60 * 60 * 1000);

// ── Startup ─────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Erebus Browser Agent v2.0 — Online                       ║
╠══════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                 ║
║  WebSocket: ws://localhost:${PORT}/ws?sessionId=<id>          ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                   ║
║    POST /session/create          — create browser session    ║
║    POST /session/:id/takeover    — user takeover             ║
║    POST /browse/navigate         — load URL                  ║
║    POST /browse/click            — click element             ║
║    POST /browse/fill             — fill form                 ║
║    POST /browse/search           — web search                ║
║    POST /browse/screenshot       — capture screenshot        ║
║    POST /browse/bd/login         — BD login                  ║
║    POST /browse/bd/members       — get BD members            ║
║    POST /video/generate          — generate video            ║
║    GET  /video/health            — health check              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Shutdown] Closing browser...");
  if (browser) await browser.close();
  server.close(() => process.exit(0));
});