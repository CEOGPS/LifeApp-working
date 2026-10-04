#!/usr/bin/env node
/**
 * Live OAuth worker probe — run: node scripts/oauth-live-debug.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.VITE_OAUTH_WORKER_URL || process.env.VITE_WORKER_URL || 'https://lifeos1.ceogps.workers.dev').replace(/\/$/, '');

async function get(path) {
  const url = `${base}${path}`;
  try {
    const r = await fetch(url, { headers: { Origin: 'http://localhost:5173' }, redirect: 'manual' });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { url, status: r.status, json, snippet: text.slice(0, 200) };
  } catch (e) {
    return { url, error: e.message };
  }
}

console.log('OAuth live debug — base:', base, '\n');

for (const path of ['/api/oauth/status', '/api/oauth/status/all']) {
  const r = await get(path);
  console.log(path, r.error || r.status, r.json ? JSON.stringify(r.json).slice(0, 300) : r.snippet);
}

const start = await get('/api/oauth/start?provider=google&user_id=debug-probe');
console.log('/api/oauth/start', start.error || start.status, start.status === 302 ? '(redirect to Google — OK)' : start.snippet);