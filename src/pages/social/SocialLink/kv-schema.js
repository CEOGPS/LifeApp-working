js// src/utils/kv-schema.js
const KV_SCHEMA_VERSION = 2;

export async function kvPut(key, data, env) {
  const payload = { v: KV_SCHEMA_VERSION, ts: Date.now(), data };
  await env.KV.put(key, JSON.stringify(payload));
}

export async function kvGet(key, env, defaultVal = null) {
  const raw = await env.KV.get(key);
  if (!raw) return defaultVal;
  try {
    const parsed = JSON.parse(raw);
    return parsed.data ?? parsed; // backwards compat
  } catch { return defaultVal; }
}