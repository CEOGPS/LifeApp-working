// PATCH (api-key-wiring): real Stripe summary via STRIPE_SECRET_KEY (or Chris's saved "stripe" key). Read-only, owner only.
import { Router } from "itty-router";
import { guardService, json, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();

function major(amount: number, currency: string): number {
  const zeroDecimal = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"];
  return zeroDecimal.includes(currency) ? amount : Math.round(amount) / 100;
}

// GET /api/stripe/summary - balance, customers, active subscriptions, recent charges
router.get("/summary", async (request: Request, env: any) => {
  const g = await guardService(request, env, "stripe", "Stripe");
  if (!g.ok) return g.response;
  const get = (path: string) => upstream(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${g.key}` } });
  const [bal, cust, subs, charges] = await Promise.all([
    get("balance"),
    get("customers?limit=100"),
    get("subscriptions?status=active&limit=100"),
    get("charges?limit=100"),
  ]);
  if (!bal.ok) return json(request, env, { error: upstreamError("Stripe", bal) }, 502);
  const sum = (arr: any[]) => {
    const out: Record<string, number> = {};
    for (const b of arr || []) out[b.currency] = (out[b.currency] || 0) + major(Number(b.amount || 0), b.currency);
    return out;
  };
  const since = Math.floor(Date.now() / 1000) - 30 * 86400;
  const revenue30: Record<string, number> = {};
  const chargeList: any[] = charges.ok ? charges.data?.data || [] : [];
  for (const c of chargeList) {
    if (c.status !== "succeeded" || c.created < since) continue;
    const net = Number(c.amount_captured ?? c.amount ?? 0) - Number(c.amount_refunded ?? 0);
    revenue30[c.currency] = Math.round(((revenue30[c.currency] || 0) + major(net, c.currency)) * 100) / 100;
  }
  const count = (r: typeof cust) => (r.ok ? (r.data?.data || []).length : null);
  const more = (r: typeof cust) => (r.ok ? !!r.data?.has_more : false);
  return json(request, env, {
    revenue: revenue30.usd ?? 0,
    revenue_30d: revenue30,
    balance: { available: sum(bal.data?.available), pending: sum(bal.data?.pending) },
    customers: count(cust),
    customers_more: more(cust),
    subscriptions: count(subs),
    subscriptions_more: more(subs),
    charges: chargeList.slice(0, 10).map((c: any) => ({
      id: c.id,
      amount: major(Number(c.amount || 0), c.currency),
      currency: c.currency,
      status: c.status,
      created: new Date(Number(c.created) * 1000).toISOString(),
      description: c.description || "",
    })),
    livemode: !!bal.data?.livemode,
    key_source: g.source,
  });
});

export { router as stripeRoutes };