import { a as getRequest, n as createServerFn, r as TSS_SERVER_FUNCTION } from "./ssr.mjs";
import { c as getSql, i as GoogleCalendarTools, l as isWorkspacePreview, o as env, r as ConnectorType, t as CONNECTOR_TOKEN_PENDING_CODE } from "./types-BXEdwaaU.mjs";
import { createHash } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/sync-MavImbWi.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/**
* Fetch-Metadata sibling isolation — **server-only** (`.server.ts` suffix).
*
* MUST keep the `.server` suffix: this file imports `@tanstack/react-start/server`
* (`getRequest` → Node `AsyncLocalStorage`). If it is imported from a dual
* client/server module under a non-`.server` name, Vite ships it to the browser
* and the app dies with: `AsyncLocalStorage is not a constructor`.
*
* Apps deployed on `*.grok.me` are "same-site" to each other but MUTUALLY
* UNTRUSTED, and a `SameSite=Lax` session cookie IS sent on same-site
* subrequests — so without this, a malicious sibling could make a SCRIPTED
* (fetch/XHR/form-POST) request to this app's server functions and ride this
* app's session cookie.
*
* We allow only: same-origin requests (this app's own client), non-browser
* requests (SSR / server-to-server, which send no `Sec-Fetch-Site`), and
* top-level GET navigations (how the OAuth callback and normal page loads
* arrive). Every cross-site / same-site *scripted* request is rejected.
* Together with `__Host-` cookies and Better Auth's `trustedOrigins`, this
* closes the sibling-tenant attack surface. Enforced at the `authMiddleware`
* chokepoint (see `middleware.ts`).
*/
var CrossSiteRequestError = class extends Error {
	status = 403;
	constructor() {
		super("Forbidden: cross-site request blocked");
		this.name = "CrossSiteRequestError";
	}
};
/** Throw `CrossSiteRequestError` for a scripted cross-site/sibling request. */
function assertSameSiteRequest() {
	const request = getRequest();
	if (!request) return;
	const h = request.headers;
	const site = h.get("sec-fetch-site");
	if (!site || site === "same-origin" || site === "none") return;
	const dest = h.get("sec-fetch-dest");
	if (h.get("sec-fetch-mode") === "navigate" && request.method === "GET" && dest !== "object" && dest !== "embed") return;
	throw new CrossSiteRequestError();
}
function assertAppDataServerOnly(context = "app-data/client.server") {
	if (typeof window !== "undefined") throw new Error(`@/lib/${context} is server-only. Call connector tools from a createServerFn handler (dynamic import of @/lib/app-data/client.server), never from a React component, useEffect, or browser fetch. Types and login helpers are client-safe via @/lib/app-data.`);
}
assertAppDataServerOnly("app-data/client.server");
assertAppDataServerOnly("app-data/client.server");
var CONNECTORS_HOST_STAGING = "connectors.app-builder-testing.com";
var CONNECTORS_HOST_PROD = "connectors.grok.me";
function isLoopbackHost(host) {
	return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
function connectorsBaseFor(publicHost) {
	const explicit = env("GROK_CONNECTORS_URL");
	if (explicit) return explicit.replace(/\/+$/, "");
	const host = publicHost?.toLowerCase();
	if (!host || isLoopbackHost(host)) return null;
	if (host === "app-builder-testing.com" || host.endsWith(".app-builder-testing.com")) return `https://${CONNECTORS_HOST_STAGING}`;
	if (host === "grok.me" || host.endsWith(".grok.me")) return `https://${CONNECTORS_HOST_PROD}`;
	return null;
}
function tryGetRequest() {
	try {
		return getRequest() ?? null;
	} catch {
		return null;
	}
}
function inboundContext() {
	const req = tryGetRequest();
	const publicHost = (req?.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req?.headers.get("host") || "").split(":")[0]?.trim() || null;
	return {
		token: (req?.headers.get("x-connector-access-token")?.trim() || null) ?? null,
		publicHost,
		connectorsBase: connectorsBaseFor(publicHost)
	};
}
var rejectedTokenDigest = null;
function tokenDigest(token) {
	return createHash("sha256").update(token).digest("base64url");
}
function noteTokenRejected(token) {
	rejectedTokenDigest = tokenDigest(token);
}
function noteTokenAccepted(token) {
	if (rejectedTokenDigest === tokenDigest(token)) rejectedTokenDigest = null;
}
async function gatePost(ctx, body, token) {
	const base = ctx.connectorsBase;
	if (!base) throw new Error("cannot resolve gate host (missing x-forwarded-host/host on the server request); open the app through the gated public URL so the gate can proxy and inject credentials");
	if (!/^https?:\/\//i.test(base)) throw new Error(`gate base must be absolute http(s) URL (got ${base}); refusing relative fetch`);
	const headers = {
		"content-type": "application/json",
		accept: "application/json",
		authorization: `Bearer ${token}`
	};
	if (ctx.publicHost) headers["x-forwarded-host"] = ctx.publicHost;
	const res = await fetch(`${base}/call-tool`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
		redirect: "manual"
	});
	let json = {};
	const text = await res.text();
	if (text) try {
		json = JSON.parse(text);
	} catch {
		json = {
			ok: false,
			errorMessage: `gate non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`
		};
	}
	return {
		status: res.status,
		json
	};
}
function gateSigninUrl(ctx) {
	const base = ctx.connectorsBase;
	if (!base) return void 0;
	try {
		const connectorsHost = new URL(base).host.toLowerCase();
		const gateHost = connectorsHost.replace(/^connectors\./, "gate.");
		if (gateHost === connectorsHost) return void 0;
		const publicHost = ctx.publicHost?.toLowerCase();
		const gated = publicHost && !isLoopbackHost(publicHost) ? `https://${publicHost}` : void 0;
		const signin = `https://${gateHost}/__gate/signin`;
		return gated ? `${signin}?return_to=${encodeURIComponent(gated)}` : signin;
	} catch {
		return;
	}
}
var PENDING_TOKEN_MISSING = "the preview has not received the connector token yet; it arrives once the connector grant is approved";
var PENDING_TOKEN_REJECTED = "the gate rejected the current preview token; the preview panel pushes a fresh one on its own schedule";
function pendingTokenResult(reason) {
	return {
		ok: false,
		data: null,
		pending: true,
		errorMessage: `${CONNECTOR_TOKEN_PENDING_CODE}: ${reason}`
	};
}
function missingAuthResult() {
	if (isWorkspacePreview()) return pendingTokenResult(PENDING_TOKEN_MISSING);
	return {
		ok: false,
		data: null,
		errorMessage: "missing_connector_token: open this app through the edge gate (the server must receive x-connector-access-token on the inbound request)"
	};
}
function unauthorizedResult(ctx, json, token) {
	if (isWorkspacePreview()) {
		noteTokenRejected(token);
		return pendingTokenResult(PENDING_TOKEN_REJECTED);
	}
	const loginUrl = gateSigninUrl(ctx) ?? (typeof json.loginUrl === "string" && json.loginUrl ? json.loginUrl : void 0);
	return {
		ok: false,
		data: null,
		loginRequired: true,
		errorMessage: json.errorMessage ?? "login required",
		...loginUrl ? { loginUrl } : {}
	};
}
function crossSiteBlockedResult() {
	try {
		assertSameSiteRequest();
		return null;
	} catch (e) {
		if (e instanceof CrossSiteRequestError) return {
			ok: false,
			data: null,
			errorMessage: e.message
		};
		return null;
	}
}
var FAILURE_MEMO_TTL_MS = 5e3;
var failureMemo = /* @__PURE__ */ new Map();
function tokenIdentityKey(token) {
	const payload = token.split(".")[1];
	if (payload) try {
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
		if (claims && typeof claims === "object" && !Array.isArray(claims)) {
			const { sub, team_id: teamId } = claims;
			if (typeof sub === "string" && sub) return createHash("sha256").update(JSON.stringify([sub, typeof teamId === "string" ? teamId : null])).digest("base64url");
		}
	} catch {}
	return createHash("sha256").update(token).digest("base64url");
}
function memoizedFailure(key) {
	if (!key) return null;
	const hit = failureMemo.get(key);
	if (!hit) return null;
	if (Date.now() - hit.at > FAILURE_MEMO_TTL_MS) {
		failureMemo.delete(key);
		return null;
	}
	return hit.result;
}
function memoizeFailure(key, result) {
	if (!key) return result;
	const now = Date.now();
	for (const [staleKey, entry] of failureMemo) if (now - entry.at > FAILURE_MEMO_TTL_MS) failureMemo.delete(staleKey);
	failureMemo.set(key, {
		at: now,
		result
	});
	return result;
}
function safeMemoKey(parts) {
	try {
		return JSON.stringify(parts);
	} catch {
		return null;
	}
}
function nonPostBlockedResult() {
	const req = tryGetRequest();
	if (!req || req.method === "POST") return null;
	return {
		ok: false,
		data: null,
		errorMessage: `blocked ${req.method} inbound request: connector calls must run inside a createServerFn({ method: "POST" }) handler`
	};
}
async function callTool(toolName, args, options) {
	const blocked = crossSiteBlockedResult() ?? nonPostBlockedResult();
	if (blocked) return blocked;
	const ctx = inboundContext();
	const token = options.token ?? ctx.token;
	if (!token) return missingAuthResult();
	const connectorType = options.connectorType;
	if (!connectorType) return {
		ok: false,
		data: null,
		errorMessage: "connectorType is required: pass the connector type granted to this app (e.g. { connectorType: ConnectorType.GoogleDrive })"
	};
	const memoKey = safeMemoKey([
		toolName,
		args,
		connectorType,
		options?.connectorCatalogId ?? null,
		tokenIdentityKey(token)
	]);
	const memoized = memoizedFailure(memoKey);
	if (memoized) return memoized;
	const fail = (errorMessage) => memoizeFailure(memoKey, {
		ok: false,
		data: null,
		errorMessage
	});
	if (connectorType === ConnectorType.Mcp && !options?.connectorCatalogId) return {
		ok: false,
		data: null,
		errorMessage: "connectorCatalogId is required when connectorType is Mcp"
	};
	try {
		const { status, json } = await gatePost(ctx, {
			host: ctx.publicHost ?? void 0,
			connector_type: connectorType,
			tool_name: toolName,
			arguments: args,
			connector_catalog_id: options.connectorCatalogId
		}, token);
		if (status === 401) return unauthorizedResult(ctx, json, token);
		noteTokenAccepted(token);
		if (status === 403) return fail(json.errorMessage ?? "access_denied");
		if (json.errorMessage && json.ok === false) return fail(json.errorMessage);
		if (status >= 400 && json.ok !== true) return fail(json.errorMessage ?? `HTTP ${status}`);
		if (json.ok === false) return fail(json.errorMessage ?? "tool error");
		return {
			ok: true,
			data: json.data ?? null
		};
	} catch (e) {
		return fail(e instanceof Error ? e.message : String(e));
	}
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function device(value) {
	const id = String(value || "").trim();
	if (!UUID.test(id)) throw new Error("bad device");
	return id;
}
var pullBoard_createServerFn_handler = createServerRpc({
	id: "9cfd941d8bd78387fd8ebfd76a9afcdc28769fb6babc222e81c215898baad78d",
	name: "pullBoard",
	filename: "src/lib/lifeos/sync.ts"
}, (opts) => pullBoard.__executeServer(opts));
var pullBoard = createServerFn({ method: "POST" }).validator((id) => device(id)).handler(pullBoard_createServerFn_handler, async ({ data }) => {
	const rows = await (await getSql())`
      select payload, updated_at from life_board where user_id = ${data}
    `;
	if (!rows[0]) return null;
	return {
		payload: rows[0].payload,
		at: new Date(rows[0].updated_at).getTime()
	};
});
var pushBoard_createServerFn_handler = createServerRpc({
	id: "e9d0e0346919adc719a37f581ec9395ad24ad1eb656a639fc7e8b18935b9e094",
	name: "pushBoard",
	filename: "src/lib/lifeos/sync.ts"
}, (opts) => pushBoard.__executeServer(opts));
var pushBoard = createServerFn({ method: "POST" }).validator((input) => {
	const id = device(input?.device);
	const payload = String(input?.payload || "");
	if (payload.length > 9e5) throw new Error("Board is too large");
	const parsed = JSON.parse(payload);
	delete parsed.keys;
	delete parsed.vault;
	return {
		id,
		payload: JSON.stringify(parsed)
	};
}).handler(pushBoard_createServerFn_handler, async ({ data }) => {
	await (await getSql())`
      insert into life_board (user_id, payload, updated_at)
      values (${data.id}, ${data.payload}, now())
      on conflict (user_id) do update
      set payload = excluded.payload, updated_at = now()
    `;
	return {
		ok: true,
		at: Date.now()
	};
});
var askNyx_createServerFn_handler = createServerRpc({
	id: "be998f075e8d8075f9256b47a873c47f348a89d05e1a44a2b1d2fda9bdde3b96",
	name: "askNyx",
	filename: "src/lib/lifeos/sync.ts"
}, (opts) => askNyx.__executeServer(opts));
var askNyx = createServerFn({ method: "POST" }).validator((input) => {
	const question = String(input?.question || "").trim().slice(0, 400);
	const facts = String(input?.facts || "").slice(0, 1800);
	if (!question) throw new Error("question required");
	return {
		question,
		facts
	};
}).handler(askNyx_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		text: ""
	};
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "grok-4.5",
			max_tokens: 180,
			temperature: .2,
			messages: [{
				role: "system",
				content: "You are Nyx, the LifeOS assistant. Use only the facts given. If a fact is missing, say it is not on the board. Never invent names, balances, times, or lead statuses."
			}, {
				role: "user",
				content: `Facts:\n${data.facts}\n\nQuestion: ${data.question}`
			}]
		})
	});
	if (!res.ok) return {
		ok: false,
		text: ""
	};
	return {
		ok: true,
		text: ((await res.json()).choices?.[0]?.message?.content || "").slice(0, 600)
	};
});
var pullCalendar_createServerFn_handler = createServerRpc({
	id: "6e730b5e9c79d56d3084b2c9fd82075b3340881ff5d3c704b46fd5daecee1ed3",
	name: "pullCalendar",
	filename: "src/lib/lifeos/sync.ts"
}, (opts) => pullCalendar.__executeServer(opts));
var pullCalendar = createServerFn({ method: "POST" }).validator(() => ({})).handler(pullCalendar_createServerFn_handler, async () => {
	const start = /* @__PURE__ */ new Date();
	const end = new Date(start.getTime() + 864e5);
	const result = await callTool(GoogleCalendarTools.search, {
		timeMin: start.toISOString(),
		timeMax: end.toISOString(),
		maxResults: 6
	}, { connectorType: ConnectorType.GoogleCalendar });
	if (!result.ok) return {
		ok: false,
		events: [],
		note: result.pending ? "Calendar is waiting on the Google connection." : result.errorMessage || "Calendar is not connected."
	};
	const raw = result.data;
	const events = (Array.isArray(raw) ? raw : raw?.items ?? []).slice(0, 6).map((item) => ({
		title: String(item.summary || "Untitled").slice(0, 80),
		when: String(item.start?.dateTime || item.start?.date || "").slice(0, 32)
	}));
	return {
		ok: true,
		events,
		note: events.length ? "From Google Calendar." : "Google Calendar returned no events today."
	};
});
//#endregion
export { askNyx_createServerFn_handler, pullBoard_createServerFn_handler, pullCalendar_createServerFn_handler, pushBoard_createServerFn_handler };
