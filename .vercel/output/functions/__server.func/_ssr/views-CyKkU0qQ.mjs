import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, Y as require_react, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as CalendarDays, S as Clapperboard, T as Bot, _ as LayoutDashboard, a as Settings, b as FileText, c as Plug, d as MessageSquare, f as Megaphone, g as Library, h as Lock, i as Share2, l as NotebookPen, m as Mail, o as Search, p as Map$1, r as Target, s as Scale, t as Users, u as Music, v as Images, w as Briefcase, x as Dices, y as FolderKanban } from "../_libs/lucide-react.mjs";
import { a as Bar, c as Tooltip, i as Area, n as BarChart, o as Cell, r as XAxis, s as ResponsiveContainer, t as AreaChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/views-CyKkU0qQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var NAV = [
	{
		slug: "dashboard",
		label: "Dashboard",
		icon: LayoutDashboard
	},
	{
		slug: "email",
		label: "Email",
		icon: Mail
	},
	{
		slug: "messages",
		label: "Messages",
		icon: MessageSquare
	},
	{
		slug: "calendar",
		label: "Calendar",
		icon: CalendarDays
	},
	{
		slug: "crm",
		label: "CRM",
		icon: Briefcase
	},
	{
		slug: "contacts",
		label: "Contacts",
		icon: Users
	},
	{
		slug: "omnisearch",
		label: "OmniSearch",
		icon: Search
	},
	{
		slug: "social",
		label: "Social",
		icon: Share2
	},
	{
		slug: "marketing",
		label: "Marketing",
		icon: Megaphone
	},
	{
		slug: "leads",
		label: "Leads",
		icon: Target
	},
	{
		slug: "creator",
		label: "Creator",
		icon: Clapperboard
	},
	{
		slug: "music-einstein",
		label: "Music Einstein",
		icon: Music
	},
	{
		slug: "music",
		label: "Music",
		icon: Library
	},
	{
		slug: "media",
		label: "Media",
		icon: Images
	},
	{
		slug: "office",
		label: "Office",
		icon: FileText
	},
	{
		slug: "projects",
		label: "Projects",
		icon: FolderKanban
	},
	{
		slug: "maps",
		label: "Maps",
		icon: Map$1
	},
	{
		slug: "legal",
		label: "Legal",
		icon: Scale
	},
	{
		slug: "journal",
		label: "Journal",
		icon: NotebookPen
	},
	{
		slug: "simulators",
		label: "Simulators",
		icon: Dices
	},
	{
		slug: "vault",
		label: "Vault",
		icon: Lock
	},
	{
		slug: "ai-hub",
		label: "AI Hub",
		icon: Bot
	},
	{
		slug: "integrations",
		label: "Integrations",
		icon: Plug
	},
	{
		slug: "settings",
		label: "Settings",
		icon: Settings
	}
];
function isPanel(slug) {
	return NAV.some((item) => item.slug === slug && item.slug !== "dashboard");
}
function readImage(file, onDone) {
	if (file.size > 9e5) return;
	const reader = new FileReader();
	reader.onload = () => onDone(String(reader.result || ""));
	reader.readAsDataURL(file);
}
function Shell({ active, banner, logo, onBanner, onLogo, status, children }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [spot, setSpot] = (0, import_react.useState)({
		x: 120,
		y: 80
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "dot-field relative min-h-dvh text-fg",
		suppressHydrationWarning: true,
		onMouseMove: (event) => {
			const rect = event.currentTarget.getBoundingClientRect();
			setSpot({
				x: event.clientX - rect.left,
				y: event.clientY - rect.top
			});
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute inset-0",
			style: { background: `radial-gradient(90px circle at ${spot.x}px ${spot.y}px, rgba(192,132,252,0.55), transparent 70%)` }
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative md:grid md:grid-cols-[15rem_1fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: `${open ? "block" : "hidden"} border-line bg-bg/80 md:block md:border-r`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex h-14 items-center gap-2 px-4",
					children: [logo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: logo,
						alt: "",
						className: "h-8 w-8 rounded-full object-cover"
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs tracking-widest text-blue-2",
						children: "LIFEOS"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "flex max-h-[calc(100dvh-3.5rem)] flex-col gap-0.5 overflow-y-auto px-2 pb-6",
					children: NAV.map((item) => {
						const on = item.slug === active;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.slug === "dashboard" ? "/" : "/panel/$slug",
							params: item.slug === "dashboard" ? void 0 : { slug: item.slug },
							onClick: () => setOpen(false),
							className: `flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${on ? "bg-glass text-blue-2" : "text-muted hover:text-fg"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, {
								size: 16,
								"aria-hidden": true
							}), item.label]
						}, item.slug);
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 overflow-x-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex h-14 items-center justify-between gap-3 border-b border-line px-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "min-h-11 text-sm text-blue-2 md:hidden",
								onClick: () => setOpen((value) => !value),
								children: open ? "Close" : "Menu"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "hidden font-mono text-xs tracking-widest text-green md:block",
								children: status
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "min-h-11 cursor-pointer text-sm text-blue-2",
								children: ["Logo", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "file",
									accept: "image/*",
									className: "sr-only",
									style: { caretColor: "transparent" },
									onChange: (event) => {
										const file = event.target.files?.[0];
										if (file) readImage(file, onLogo);
									}
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative mx-4 mt-4 h-28 overflow-hidden rounded-2xl border border-line bg-ink md:h-36",
						children: [banner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: banner,
							alt: "",
							className: "h-full w-full object-cover"
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "absolute right-3 bottom-3 min-h-11 cursor-pointer rounded-lg bg-bg/80 px-3 py-2 text-sm text-blue-2",
							children: ["Banner", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "file",
								accept: "image/*",
								className: "sr-only",
								style: { caretColor: "transparent" },
								onChange: (event) => {
									const file = event.target.files?.[0];
									if (file) readImage(file, onBanner);
								}
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 py-4",
						children
					})
				]
			})]
		})]
	});
}
var emptyBoard = () => ({
	logo: "",
	banner: "",
	notes: [],
	tasks: [],
	leads: [{
		id: "lead-nextdoor",
		name: "Neighborhood intro ask",
		source: "Nextdoor",
		status: "New"
	}, {
		id: "lead-group",
		name: "Local group recommendation",
		source: "Facebook Groups",
		status: "Warm"
	}],
	notifs: [{
		id: "n1",
		text: "Two warm leads have no next step.",
		source: "Leads",
		seen: false
	}, {
		id: "n2",
		text: "Phone bill is still unpaid this cycle.",
		source: "Budget",
		seen: false
	}],
	jobs: [{
		id: "j1",
		agent: "Erebus",
		task: "Read the board each morning",
		active: true
	}, {
		id: "j2",
		agent: "Kranos",
		task: "Queue the unpaid bills",
		active: false
	}],
	accounts: [
		{
			id: "a1",
			name: "Bank",
			balance: 4200,
			prior: 3900
		},
		{
			id: "a2",
			name: "Stripe",
			balance: 860,
			prior: 640
		},
		{
			id: "a3",
			name: "Cards",
			balance: -1200,
			prior: -1480
		},
		{
			id: "a4",
			name: "Cash App",
			balance: 140,
			prior: 90
		},
		{
			id: "a5",
			name: "Venmo",
			balance: 75,
			prior: 60
		},
		{
			id: "a6",
			name: "OnePay",
			balance: 310,
			prior: 300
		},
		{
			id: "a7",
			name: "Credit Karma",
			balance: 0,
			prior: 0
		}
	],
	products: [{
		id: "p1",
		name: "Listings",
		cost: 200,
		revenue: 900
	}, {
		id: "p2",
		name: "Retainers",
		cost: 400,
		revenue: 1800
	}],
	fico: 712,
	vantage: 698,
	expenses: [{
		id: "e1",
		name: "Rent",
		amount: 1450,
		paid: true,
		fixed: true
	}, {
		id: "e2",
		name: "Phone",
		amount: 85,
		paid: false,
		fixed: true
	}],
	events: [],
	links: [],
	tracks: [],
	social: [{
		id: "s1",
		label: "Followers",
		points: [
			120,
			128,
			131,
			140,
			138,
			150,
			156
		]
	}, {
		id: "s2",
		label: "Reach",
		points: [
			800,
			640,
			910,
			1e3,
			870,
			1200,
			1100
		]
	}],
	marketing: [{
		id: "m1",
		label: "Site visits",
		points: [
			40,
			55,
			48,
			70,
			66,
			80,
			74
		]
	}, {
		id: "m2",
		label: "Leads",
		points: [
			2,
			1,
			3,
			2,
			4,
			3,
			5
		]
	}]
});
function arr(value, map) {
	if (!Array.isArray(value)) return [];
	return value.map(map).filter((row) => row !== null).slice(0, 80);
}
function text(value, max) {
	return String(value ?? "").slice(0, max);
}
function num(value, min, max, fallback) {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(min, Math.min(max, Math.round(n)));
}
function sanitizeBoard(input) {
	const base = emptyBoard();
	const raw = input && typeof input === "object" ? input : {};
	return {
		logo: text(raw.logo, 5e5),
		banner: text(raw.banner, 5e5),
		notes: arr(raw.notes, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				title: text(r.title, 80),
				body: text(r.body, 4e3)
			};
		}),
		tasks: arr(raw.tasks, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				title: text(r.title, 140),
				done: Boolean(r.done)
			};
		}),
		leads: arr(raw.leads, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				name: text(r.name, 80),
				source: text(r.source, 60),
				status: text(r.status, 40) || "New"
			};
		}),
		notifs: arr(raw.notifs, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				text: text(r.text, 200),
				source: text(r.source, 40),
				seen: Boolean(r.seen)
			};
		}),
		jobs: arr(raw.jobs, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				agent: text(r.agent, 40),
				task: text(r.task, 160),
				active: Boolean(r.active)
			};
		}),
		accounts: arr(raw.accounts, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				name: text(r.name, 40),
				balance: num(r.balance, -1e6, 1e7, 0),
				prior: num(r.prior, -1e6, 1e7, 0)
			};
		}),
		products: arr(raw.products, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				name: text(r.name, 40),
				cost: num(r.cost, 0, 1e7, 0),
				revenue: num(r.revenue, 0, 1e7, 0)
			};
		}),
		fico: num(raw.fico, 300, 850, base.fico),
		vantage: num(raw.vantage, 300, 850, base.vantage),
		expenses: arr(raw.expenses, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				name: text(r.name, 60),
				amount: num(r.amount, 0, 1e6, 0),
				paid: Boolean(r.paid),
				fixed: Boolean(r.fixed)
			};
		}),
		events: arr(raw.events, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				day: num(r.day, 0, 6, 0),
				title: text(r.title, 80)
			};
		}),
		links: arr(raw.links, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			const href = text(r.href, 300);
			if (!/^https?:\/\//i.test(href)) return null;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				label: text(r.label, 60),
				href
			};
		}),
		tracks: arr(raw.tracks, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			const url = text(r.url, 300);
			if (url && !/^https?:\/\//i.test(url)) return null;
			return {
				id: text(r.id, 40) || crypto.randomUUID(),
				title: text(r.title, 80),
				url
			};
		}),
		social: series(raw.social, base.social),
		marketing: series(raw.marketing, base.marketing)
	};
}
function series(value, fallback) {
	const rows = arr(value, (row) => {
		if (!row || typeof row !== "object") return null;
		const r = row;
		const points = Array.isArray(r.points) ? r.points.slice(0, 7).map((n) => num(n, 0, 1e6, 0)) : [];
		while (points.length < 7) points.push(0);
		return {
			id: text(r.id, 40) || crypto.randomUUID(),
			label: text(r.label, 40),
			points
		};
	});
	return rows.length ? rows.slice(0, 4) : fallback;
}
function band(score) {
	if (score < 580) return "Poor";
	if (score < 670) return "Fair";
	if (score < 740) return "Good";
	return "Great";
}
function moneyTips(board) {
	const unpaid = board.expenses.filter((row) => !row.paid);
	const debt = board.accounts.filter((row) => row.balance < 0);
	const tips = [];
	if (unpaid.length) tips.push(`Pay ${unpaid.map((row) => row.name).join(", ")} before adding new spend.`);
	if (debt.length) tips.push(`${debt[0].name} is negative. Extra cash should hit that before savings.`);
	if (board.fico < 740) tips.push("Keep card use under 30% of the limit to move the FICO band.");
	if (!tips.length) tips.push("Balances are ahead of last quarter. Leave the surplus parked, not spent.");
	return tips.slice(0, 3);
}
function insights(board) {
	const open = board.tasks.filter((row) => !row.done).length;
	const warm = board.leads.filter((row) => row.status !== "Closed").length;
	const net = board.accounts.reduce((sum, row) => sum + row.balance, 0);
	return [
		`${open} open tasks and ${warm} open leads. Close one lead before adding another task.`,
		`Net across the seven accounts is $${net.toLocaleString()}.`,
		board.notes.length ? `Newest note: ${board.notes[0].title || "Untitled"}.` : "No notes yet. A note gives Erebus something personal to use."
	];
}
function lifeHacks(board) {
	const hacks = ["Block the first 25 minutes after wake-up for the oldest unpaid bill or oldest lead."];
	if (board.events.length === 0) hacks.push("Put one real appointment on the 7-day strip so the week is not only tasks.");
	if (board.links.length === 0) hacks.push("Pin the sheet you open every morning in Quicklinks so you stop hunting for it.");
	hacks.push("One compliment or check-in to a saved contact beats another hour in a feed.");
	return hacks.slice(0, 3);
}
var KEY = "lifeos.shell.v1";
var AT = "lifeos.savedAt";
var DEVICE = "lifeos.device";
function id() {
	return crypto.randomUUID();
}
function seed() {
	return {
		...emptyBoard(),
		contacts: [],
		journal: [],
		mail: [],
		thread: [{
			id: "hello",
			who: "Nyx",
			text: "I'm here. Ask about the board. I will only use what is saved on it.",
			mine: false
		}],
		projects: [],
		vault: [],
		legal: [],
		media: [],
		songs: [],
		ideas: [{
			id: "idea-1",
			title: "Local listing photos",
			note: "Offer a same-week photo pack to businesses already in Leads.",
			approved: false
		}],
		keys: [],
		query: ""
	};
}
function entry(row) {
	if (!row || typeof row !== "object") return null;
	const r = row;
	return {
		id: String(r.id || id()).slice(0, 40),
		title: String(r.title || "").slice(0, 120),
		body: String(r.body || "").slice(0, 8e3),
		at: String(r.at || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 40)
	};
}
function sanitizeMemory(input) {
	seed();
	const board = sanitizeBoard(input);
	const raw = input && typeof input === "object" ? input : {};
	const list = (value, map) => Array.isArray(value) ? value.map(map).filter((row) => row !== null).slice(0, 200) : [];
	return {
		...board,
		contacts: list(raw.contacts, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: String(r.id || id()).slice(0, 40),
				name: String(r.name || "").slice(0, 80),
				company: String(r.company || "").slice(0, 80),
				email: String(r.email || "").slice(0, 120),
				phone: String(r.phone || "").slice(0, 40),
				city: String(r.city || "").slice(0, 60),
				kind: r.kind === "crm" ? "crm" : "personal",
				avatar: String(r.avatar || "").slice(0, 500),
				stage: String(r.stage || "New").slice(0, 40)
			};
		}),
		journal: list(raw.journal, entry),
		mail: list(raw.mail, entry),
		thread: list(raw.thread, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: String(r.id || id()).slice(0, 40),
				who: String(r.who || "Nyx").slice(0, 40),
				text: String(r.text || "").slice(0, 1e3),
				mine: Boolean(r.mine)
			};
		}),
		projects: list(raw.projects, entry),
		vault: list(raw.vault, entry),
		legal: list(raw.legal, entry),
		media: list(raw.media, entry),
		songs: list(raw.songs, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: String(r.id || id()).slice(0, 40),
				title: String(r.title || "").slice(0, 80),
				note: String(r.note || "").slice(0, 500)
			};
		}),
		ideas: list(raw.ideas, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: String(r.id || id()).slice(0, 40),
				title: String(r.title || "").slice(0, 80),
				note: String(r.note || "").slice(0, 500),
				approved: Boolean(r.approved)
			};
		}),
		keys: list(raw.keys, (row) => {
			if (!row || typeof row !== "object") return null;
			const r = row;
			return {
				id: String(r.id || id()).slice(0, 40),
				name: String(r.name || "").slice(0, 60),
				value: String(r.value || "").slice(0, 400)
			};
		}),
		query: String(raw.query || "").slice(0, 120)
	};
}
function read() {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return seed();
		return sanitizeMemory(JSON.parse(raw));
	} catch {
		return seed();
	}
}
var memory = seed();
var statusText = "This browser";
var hydrated = false;
var pushTimer;
var listeners = /* @__PURE__ */ new Set();
function emit() {
	listeners.forEach((listener) => listener());
}
function deviceId() {
	if (typeof localStorage === "undefined") return "";
	let id = localStorage.getItem(DEVICE);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(DEVICE, id);
	}
	return id;
}
function bootMemory() {
	memory = read();
	emit();
}
function rememberLocal() {
	localStorage.setItem(KEY, JSON.stringify(memory));
	localStorage.setItem(AT, String(Date.now()));
}
function schedulePush() {
	if (!hydrated) return;
	clearTimeout(pushTimer);
	statusText = "Syncing";
	emit();
	pushTimer = setTimeout(() => {
		pushNow();
	}, 600);
}
async function pushNow() {
	try {
		const { pushBoard } = await import("./sync-CMSDJesh.mjs");
		const copy = {
			...memory,
			keys: [],
			vault: []
		};
		const result = await pushBoard({ data: {
			device: deviceId(),
			payload: JSON.stringify(copy)
		} });
		if (result.at) localStorage.setItem(AT, String(result.at));
		statusText = "Synced";
	} catch {
		statusText = "Saved on this browser";
	}
	emit();
}
async function hydrateMemory() {
	bootMemory();
	try {
		const { pullBoard } = await import("./sync-CMSDJesh.mjs");
		const remote = await pullBoard({ data: deviceId() });
		const localAt = Number(localStorage.getItem(AT) || 0);
		if (remote?.payload && remote.at > localAt) {
			const incoming = sanitizeMemory(JSON.parse(remote.payload));
			incoming.keys = memory.keys;
			incoming.vault = memory.vault;
			memory = incoming;
			localStorage.setItem(KEY, JSON.stringify(memory));
			localStorage.setItem(AT, String(remote.at));
			statusText = "Synced";
		} else statusText = "Saved on this browser";
	} catch {
		statusText = "Saved on this browser";
	}
	hydrated = true;
	emit();
}
function adoptDevice(next) {
	const id = next.trim();
	if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
	localStorage.setItem(DEVICE, id);
	localStorage.setItem(AT, "0");
	hydrated = false;
	hydrateMemory();
	return true;
}
function updateMemory(recipe) {
	memory = recipe(memory);
	rememberLocal();
	emit();
	schedulePush();
}
function useMemory() {
	const [data, setData] = (0, import_react.useState)(memory);
	const [status, setStatus] = (0, import_react.useState)(statusText);
	(0, import_react.useEffect)(() => {
		const listener = () => {
			setData(memory);
			setStatus(statusText);
		};
		listeners.add(listener);
		hydrateMemory();
		return () => {
			listeners.delete(listener);
		};
	}, []);
	return {
		data,
		update: (0, import_react.useCallback)((recipe) => updateMemory(recipe), []),
		status
	};
}
function newId() {
	return id();
}
function Frame({ active, children }) {
	const { data, update, status } = useMemory();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {
		active,
		banner: data.banner,
		logo: data.logo,
		onBanner: (banner) => update((prev) => ({
			...prev,
			banner
		})),
		onLogo: (logo) => update((prev) => ({
			...prev,
			logo
		})),
		status,
		children
	});
}
function Card$1({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "glass rounded-2xl p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-mono text-xs tracking-widest text-blue-2",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3",
			children
		})]
	});
}
function Field$1({ label, value, onChange, area }) {
	const className = "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-fg outline-none";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block text-sm text-muted",
		children: [label, area ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
			className: `${className} min-h-24`,
			style: { caretColor: "transparent" },
			value,
			onChange: (event) => onChange(event.target.value)
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			className,
			style: { caretColor: "transparent" },
			value,
			onChange: (event) => onChange(event.target.value)
		})]
	});
}
function Add$1({ label, onAdd }) {
	const [value, setValue] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "flex gap-2",
		onSubmit: (event) => {
			event.preventDefault();
			const next = value.trim();
			if (!next) return;
			onAdd(next);
			setValue("");
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			className: "min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm",
			style: { caretColor: "transparent" },
			value,
			placeholder: label,
			onChange: (event) => setValue(event.target.value)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "submit",
			className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
			children: "Save"
		})]
	});
}
function people(kind, data, update) {
	return {
		rows: data.contacts.filter((row) => row.kind === kind),
		add: (row) => update((prev) => ({
			...prev,
			contacts: [row, ...prev.contacts]
		})),
		removeAll: () => update((prev) => ({
			...prev,
			contacts: prev.contacts.filter((row) => row.kind !== kind)
		})),
		remove: (id) => update((prev) => ({
			...prev,
			contacts: prev.contacts.filter((row) => row.id !== id)
		}))
	};
}
function parseCsv(text, kind) {
	const lines = text.split(/\r?\n/).filter((line) => line.trim());
	if (lines.length < 2) return [];
	const headers = lines[0].split(",").map((cell) => cell.trim().toLowerCase().replace(/["']/g, ""));
	const pick = (cells, names) => {
		const index = headers.findIndex((header) => names.includes(header));
		return index >= 0 ? (cells[index] || "").replace(/^"|"$/g, "").trim() : "";
	};
	return lines.slice(1, 201).map((line) => {
		const cells = line.split(",");
		const first = pick(cells, ["first_name", "firstname"]);
		const last = pick(cells, ["last_name", "lastname"]);
		const named = pick(cells, [
			"name",
			"full_name",
			"fullname"
		]);
		return {
			id: newId(),
			name: named || `${first} ${last}`.trim(),
			company: pick(cells, ["company", "organization"]),
			email: pick(cells, ["email", "e-mail"]),
			phone: pick(cells, [
				"phone",
				"phone_number",
				"mobile"
			]),
			city: pick(cells, ["city", "address"]),
			avatar: pick(cells, [
				"avatar",
				"avatar_url",
				"image",
				"photo"
			]),
			stage: pick(cells, ["stage", "status"]) || "New",
			kind
		};
	}).filter((row) => row.name);
}
function Contacts({ kind, data, update }) {
	const book = people(kind, data, update);
	const [q, setQ] = (0, import_react.useState)("");
	const [form, setForm] = (0, import_react.useState)({
		name: "",
		company: "",
		email: "",
		phone: "",
		city: "",
		avatar: "",
		stage: "New"
	});
	const set = (key) => (value) => setForm((prev) => ({
		...prev,
		[key]: value
	}));
	const rows = book.rows.filter((row) => `${row.name} ${row.company} ${row.email}`.toLowerCase().includes(q.toLowerCase()));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
			title: kind === "crm" ? "CRM" : "Contacts",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "min-h-11 min-w-40 flex-1 rounded-lg border border-line bg-ink px-3 text-sm",
						style: { caretColor: "transparent" },
						value: q,
						placeholder: "Search",
						onChange: (event) => setQ(event.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "min-h-11 cursor-pointer rounded-lg border border-line px-3 py-2 text-sm text-blue-2",
						children: ["Import CSV", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "file",
							accept: ".csv,text/csv",
							className: "sr-only",
							onChange: (event) => {
								const file = event.target.files?.[0];
								if (!file) return;
								file.text().then((text) => update((prev) => ({
									...prev,
									contacts: [...parseCsv(text, kind), ...prev.contacts]
								})));
							}
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "min-h-11 rounded-lg border border-line px-3 text-sm",
						onClick: () => {
							const header = "name,company,email,phone,city,avatar,stage\n";
							const body = rows.map((row) => [
								row.name,
								row.company,
								row.email,
								row.phone,
								row.city,
								row.avatar,
								row.stage
							].join(",")).join("\n");
							const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
							const link = document.createElement("a");
							link.href = url;
							link.download = `${kind}.csv`;
							link.click();
							URL.revokeObjectURL(url);
						},
						children: "Export"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "min-h-11 rounded-lg border border-line px-3 text-sm text-muted",
						onClick: book.removeAll,
						children: "Delete all"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 grid gap-2 md:grid-cols-2",
				onSubmit: (event) => {
					event.preventDefault();
					if (!form.name.trim()) return;
					book.add({
						...form,
						id: newId(),
						kind
					});
					setForm({
						name: "",
						company: "",
						email: "",
						phone: "",
						city: "",
						avatar: "",
						stage: "New"
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Name",
						value: form.name,
						onChange: set("name")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Company",
						value: form.company,
						onChange: set("company")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Email",
						value: form.email,
						onChange: set("email")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Phone",
						value: form.phone,
						onChange: set("phone")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "City",
						value: form.city,
						onChange: set("city")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Image URL",
						value: form.avatar,
						onChange: set("avatar")
					}),
					kind === "crm" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Stage",
						value: form.stage,
						onChange: set("stage")
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
						children: "Save contact"
					})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 md:grid-cols-2",
			children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "glass flex gap-3 rounded-2xl p-4",
				children: [row.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: row.avatar,
					alt: "",
					className: "h-14 w-14 rounded-full object-cover"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid h-14 w-14 place-items-center rounded-full bg-ink text-blue-2",
					children: row.name.slice(0, 1)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: row.name }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: [
								row.company,
								row.email,
								row.phone,
								row.city,
								kind === "crm" ? row.stage : ""
							].filter(Boolean).join(" · ")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap gap-3",
							children: [
								row.phone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									className: "min-h-11 text-green",
									href: `tel:${row.phone}`,
									children: "Call"
								}) : null,
								row.phone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									className: "min-h-11 text-pink",
									href: `sms:${row.phone}`,
									children: "Text"
								}) : null,
								row.email ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									className: "min-h-11 text-blue-2",
									href: `mailto:${row.email}`,
									children: "Email"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "min-h-11 text-muted",
									onClick: () => book.remove(row.id),
									children: "Remove"
								})
							]
						})
					]
				})]
			}, row.id))
		})]
	});
}
var DAYS = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat"
];
var TOOLS = [
	"SEO notes",
	"Site audit",
	"Rank tracking",
	"Keywords",
	"Competitors",
	"Automation",
	"Content",
	"Customer notes",
	"Assets",
	"Lead generator",
	"Listings"
];
var SIMS = [
	"Alternate Life",
	"Dream Forge",
	"Echo Persona",
	"Fantasy Friend",
	"Narrative Conflict",
	"Shadow Budget",
	"Life RPG",
	"Compliment Cannon",
	"Smart Browser",
	"Life Audit"
];
function facts(data) {
	return [
		`Tasks: ${data.tasks.map((row) => `${row.title}${row.done ? " done" : ""}`).join(", ") || "none"}.`,
		`Leads: ${data.leads.map((row) => `${row.name} ${row.status}`).join(", ") || "none"}.`,
		`Unpaid: ${data.expenses.filter((row) => !row.paid).map((row) => row.name).join(", ") || "none"}.`
	].join(" ");
}
async function grounded(question, data) {
	try {
		const { askNyx } = await import("./sync-CMSDJesh.mjs");
		const result = await askNyx({ data: {
			question,
			facts: facts(data)
		} });
		if (result.ok && result.text) return result.text;
	} catch {}
	return "No model reply. The note was saved from what you typed.";
}
function WiredPanel({ slug, data, update }) {
	const [draft, setDraft] = (0, import_react.useState)("");
	const [extra, setExtra] = (0, import_react.useState)("");
	const [place, setPlace] = (0, import_react.useState)("Atlanta");
	const [day, setDay] = (0, import_react.useState)((/* @__PURE__ */ new Date()).getDay());
	const [tool, setTool] = (0, import_react.useState)(TOOLS[0]);
	const [code, setCode] = (0, import_react.useState)("");
	const [playing, setPlaying] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => setCode(deviceId()), []);
	const hits = (0, import_react.useMemo)(() => {
		const q = data.query.toLowerCase();
		if (!q) return [];
		return [
			...data.notes.map((row) => `Note · ${row.title}`),
			...data.contacts.map((row) => `Contact · ${row.name}`),
			...data.leads.map((row) => `Lead · ${row.name}`),
			...data.tasks.map((row) => `Task · ${row.title}`),
			...data.mail.map((row) => `Email · ${row.title}`),
			...data.projects.map((row) => `Project · ${row.title}`)
		].filter((row) => row.toLowerCase().includes(q)).slice(0, 12);
	}, [data]);
	if (slug === "email") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Email",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "grid gap-2",
			onSubmit: (event) => {
				event.preventDefault();
				if (!draft.trim() && !extra.trim()) return;
				update((prev) => ({
					...prev,
					mail: [{
						id: newId(),
						title: draft.trim() || "No subject",
						body: extra.trim(),
						at: (/* @__PURE__ */ new Date()).toISOString()
					}, ...prev.mail]
				}));
				setDraft("");
				setExtra("");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Subject",
					value: draft,
					onChange: setDraft
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Message",
					value: extra,
					onChange: setExtra,
					area: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
						children: "Save draft"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-blue-2",
						href: `mailto:?subject=${encodeURIComponent(draft)}&body=${encodeURIComponent(extra)}`,
						children: "Open in mail"
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 grid gap-2",
			children: data.mail.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-blue-2",
					children: row.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-1 block text-muted",
					children: row.body
				})]
			}, row.id))
		})]
	});
	if (slug === "messages") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Messages",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid max-h-80 gap-2 overflow-y-auto",
				children: data.thread.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted",
						children: [row.who, ": "]
					}), row.text]
				}, row.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					const text = draft.trim();
					if (!text) return;
					update((prev) => ({
						...prev,
						thread: [...prev.thread, {
							id: newId(),
							who: "You",
							text,
							mine: true
						}]
					}));
					setDraft("");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm",
					style: { caretColor: "transparent" },
					value: draft,
					onChange: (event) => setDraft(event.target.value),
					placeholder: "Text"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
					children: "Send"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 grid gap-2",
				children: data.contacts.filter((row) => row.phone).slice(0, 8).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex min-h-11 flex-wrap items-center gap-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.name }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "text-green",
							href: `tel:${row.phone}`,
							children: "Call"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "text-pink",
							href: `sms:${row.phone}`,
							children: "Text"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "text-muted",
							onClick: () => update((prev) => ({
								...prev,
								thread: [...prev.thread, {
									id: newId(),
									who: "Call",
									text: `Called ${row.name}`,
									mine: true
								}]
							})),
							children: "Log call"
						})
					]
				}, row.id))
			})
		]
	});
	if (slug === "calendar") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Calendar",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-3 flex flex-wrap gap-2",
				children: DAYS.map((name, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `min-h-11 rounded-lg px-3 text-sm ${day === index ? "bg-blue text-ink" : "border border-line"}`,
					onClick: () => setDay(index),
					children: name
				}, name))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
				label: "Event title",
				onAdd: (title) => update((prev) => ({
					...prev,
					events: [...prev.events, {
						id: newId(),
						day,
						title
					}]
				}))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 grid gap-3 md:grid-cols-7",
				children: DAYS.map((name, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted",
					children: name
				}), data.events.filter((row) => row.day === index).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-pink",
					children: row.title
				}, row.id))] }, name))
			})
		]
	});
	if (slug === "crm") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contacts, {
		kind: "crm",
		data,
		update
	});
	if (slug === "contacts") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contacts, {
		kind: "personal",
		data,
		update
	});
	if (slug === "omnisearch") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
			title: "OmniSearch",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
					label: "Search the board and the web",
					onAdd: (query) => update((prev) => ({
						...prev,
						query
					}))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3",
					children: hits.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "min-h-11 text-sm",
						children: row
					}, row))
				}),
				data.query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					className: "mt-2 inline-flex min-h-11 items-center text-sm text-blue-2",
					href: `https://duckduckgo.com/?q=${encodeURIComponent(data.query)}`,
					target: "_blank",
					rel: "noreferrer",
					children: "Open web results"
				}) : null
			]
		}), data.query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card$1, {
			title: "Video",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
				title: "Search video",
				className: "aspect-video w-full rounded-xl",
				src: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(data.query)}`,
				allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			})
		}) : null]
	});
	if (slug === "social") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-4 md:grid-cols-2",
		children: data.social.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
			title: row.label,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-28",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
						data: row.points.map((value, index) => ({
							name: String(index + 1),
							value
						})),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
							type: "monotone",
							dataKey: "value",
							stroke: "#c084fc",
							fill: "#c084fc",
							fillOpacity: .25
						})]
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
				label: `Log ${row.label}`,
				onAdd: (value) => {
					const point = Number(value);
					if (!Number.isFinite(point)) return;
					update((prev) => ({
						...prev,
						social: prev.social.map((item) => item.id === row.id ? {
							...item,
							points: [...item.points.slice(1), point]
						} : item)
					}));
				}
			})]
		}, row.id))
	});
	if (slug === "marketing") {
		const saved = data.notes.find((row) => row.title === `Marketing · ${tool}`);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 lg:grid-cols-[16rem_1fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card$1, {
				title: "Tools",
				children: TOOLS.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `block min-h-11 w-full text-left text-sm ${tool === name ? "text-pink" : ""}`,
					onClick: () => {
						setTool(name);
						setExtra(data.notes.find((row) => row.title === `Marketing · ${name}`)?.body || "");
					},
					children: name
				}, name))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
					title: tool,
					children: [tool === "Lead generator" || tool === "Listings" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
						label: tool === "Listings" ? "Business to list" : "Lead name",
						onAdd: (name) => update((prev) => ({
							...prev,
							leads: [{
								id: newId(),
								name,
								source: tool,
								status: "New"
							}, ...prev.leads]
						}))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "grid gap-2",
						onSubmit: (event) => {
							event.preventDefault();
							const title = `Marketing · ${tool}`;
							update((prev) => ({
								...prev,
								notes: [{
									id: saved?.id || newId(),
									title,
									body: extra
								}, ...prev.notes.filter((row) => row.title !== title)]
							}));
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
							label: "Notes",
							value: extra,
							onChange: setExtra,
							area: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "submit",
							className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
							children: ["Save ", tool]
						})]
					}), tool === "Rank tracking" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						children: [data.marketing.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: [
								row.label,
								": ",
								row.points.at(-1)
							]
						}, row.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
								label: "Log site visits",
								onAdd: (value) => {
									const point = Number(value);
									if (!Number.isFinite(point)) return;
									update((prev) => ({
										...prev,
										marketing: prev.marketing.map((item) => item.label === "Site visits" ? {
											...item,
											points: [...item.points.slice(1), point]
										} : item)
									}));
								}
							})
						})]
					}) : null]
				})
			})]
		});
	}
	if (slug === "leads") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
			title: "Leads",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
				label: "New lead",
				onAdd: (name) => update((prev) => ({
					...prev,
					leads: [{
						id: newId(),
						name,
						source: "Manual",
						status: "New"
					}, ...prev.leads]
				}))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3",
				children: data.leads.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex min-h-11 flex-wrap items-center gap-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.name }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: row.source
						}),
						[
							"New",
							"Warm",
							"Closed"
						].map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: row.status === status ? "text-green" : "text-muted",
							onClick: () => update((prev) => ({
								...prev,
								leads: prev.leads.map((item) => item.id === row.id ? {
									...item,
									status
								} : item)
							})),
							children: status
						}, status))
					]
				}, row.id))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
			title: "Lucid",
			children: [data.ideas.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-line py-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: row.title }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: row.note
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-2 min-h-11 text-blue-2",
						onClick: () => update((prev) => ({
							...prev,
							ideas: prev.ideas.map((item) => item.id === row.id ? {
								...item,
								approved: !item.approved
							} : item)
						})),
						children: row.approved ? "Approved — you set up the accounts, then it stays on this list" : "Approve"
					})
				]
			}, row.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
				label: "Low-effort idea",
				onAdd: (title) => update((prev) => ({
					...prev,
					ideas: [{
						id: newId(),
						title,
						note: "Approve it, then set up the accounts yourself. Lucid keeps the plan here.",
						approved: false
					}, ...prev.ideas]
				}))
			})]
		})]
	});
	if (slug === "creator") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Creator",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "grid gap-2",
			onSubmit: (event) => {
				event.preventDefault();
				if (!draft.trim()) return;
				update((prev) => ({
					...prev,
					media: [{
						id: newId(),
						title: draft.trim(),
						body: extra.trim(),
						at: (/* @__PURE__ */ new Date()).toISOString()
					}, ...prev.media]
				}));
				setDraft("");
				setExtra("");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Title",
					value: draft,
					onChange: setDraft
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Script or shot list",
					value: extra,
					onChange: setExtra,
					area: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
					children: "Save piece"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 grid gap-2",
			children: data.media.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-pink",
					children: row.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-1 block text-muted",
					children: row.body
				})]
			}, row.id))
		})]
	});
	if (slug === "music-einstein") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Music Einstein",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "grid gap-2",
			onSubmit: (event) => {
				event.preventDefault();
				if (!draft.trim()) return;
				update((prev) => ({
					...prev,
					songs: [{
						id: newId(),
						title: draft.trim(),
						note: extra.trim() || "Draft"
					}, ...prev.songs]
				}));
				setDraft("");
				setExtra("");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Title",
					value: draft,
					onChange: setDraft
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Verse, chorus, or hook",
					value: extra,
					onChange: setExtra,
					area: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
					children: "Save song"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4",
			children: data.songs.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "min-h-11 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-blue-2",
					children: row.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-1 block text-muted",
					children: row.note
				})]
			}, row.id))
		})]
	});
	if (slug === "music") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Music",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
				label: "Audio URL",
				onAdd: (url) => update((prev) => ({
					...prev,
					tracks: [{
						id: newId(),
						title: url.split("/").pop() || "Track",
						url
					}, ...prev.tracks]
				}))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3",
				children: data.tracks.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `min-h-11 text-sm ${playing === index ? "text-pink" : ""}`,
					onClick: () => setPlaying(index),
					children: row.title
				}) }, row.id))
			}),
			data.tracks[playing]?.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", {
				className: "mt-3 w-full",
				controls: true,
				src: data.tracks[playing].url
			}) : null
		]
	});
	if (slug === "media") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Media",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
			label: "Clip or image URL",
			onAdd: (url) => {
				if (!/^https?:\/\//i.test(url)) return;
				update((prev) => ({
					...prev,
					links: [...prev.links, {
						id: newId(),
						label: url,
						href: url
					}]
				}));
			}
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3",
			children: data.links.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				className: "inline-flex min-h-11 items-center text-sm text-blue-2",
				href: row.href,
				target: "_blank",
				rel: "noreferrer",
				children: row.label
			}) }, row.id))
		})]
	});
	if (slug === "office") {
		const open = data.tasks.filter((row) => !row.done).length;
		const unpaid = data.expenses.filter((row) => !row.paid);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 md:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
					title: "Tasks",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-3xl text-pink",
						children: open
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "still open"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
					title: "Leads",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-3xl text-violet",
						children: data.leads.length
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "on the board"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
					title: "Unpaid",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-3xl text-orange",
						children: unpaid.length
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: unpaid.map((row) => row.name).join(", ") || "None"
					})]
				})
			]
		});
	}
	if (slug === "projects") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Projects",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "grid gap-2",
			onSubmit: (event) => {
				event.preventDefault();
				if (!draft.trim()) return;
				update((prev) => ({
					...prev,
					projects: [{
						id: newId(),
						title: draft.trim(),
						body: extra.trim(),
						at: (/* @__PURE__ */ new Date()).toISOString()
					}, ...prev.projects]
				}));
				setDraft("");
				setExtra("");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Project",
					value: draft,
					onChange: setDraft
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Next step",
					value: extra,
					onChange: setExtra,
					area: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
					children: "Save project"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 grid gap-3",
			children: data.projects.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-blue-2",
						children: row.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: row.body
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "min-h-11 text-pink",
						onClick: () => update((prev) => ({
							...prev,
							tasks: [{
								id: newId(),
								title: row.title,
								done: false
							}, ...prev.tasks]
						})),
						children: "Add to tasks"
					})
				]
			}, row.id))
		})]
	});
	if (slug === "maps") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Maps",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
			label: "Place",
			onAdd: setPlace
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
			title: "Map",
			className: "mt-3 h-80 w-full rounded-xl",
			src: `https://maps.google.com/maps?q=${encodeURIComponent(place)}&output=embed`
		})]
	});
	if (slug === "legal") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Legal",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Drafts you write. Not legal advice."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [
					"NDA outline",
					"Invoice terms",
					"Scope of work"
				].map((title) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "min-h-11 rounded-lg border border-line px-3 text-sm",
					onClick: () => update((prev) => ({
						...prev,
						legal: [{
							id: newId(),
							title,
							body: `${title} draft. Fill the parties, the dates, and the money before you send it.`,
							at: (/* @__PURE__ */ new Date()).toISOString()
						}, ...prev.legal]
					})),
					children: title
				}, title))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 grid gap-2",
				children: data.legal.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-blue-2",
						children: row.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-muted",
						children: row.body
					})]
				}, row.id))
			})
		]
	});
	if (slug === "journal") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Journal",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "grid gap-2",
			onSubmit: (event) => {
				event.preventDefault();
				if (!extra.trim()) return;
				update((prev) => ({
					...prev,
					journal: [{
						id: newId(),
						title: draft.trim() || (/* @__PURE__ */ new Date()).toLocaleDateString(),
						body: extra.trim(),
						at: (/* @__PURE__ */ new Date()).toISOString()
					}, ...prev.journal]
				}));
				setDraft("");
				setExtra("");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Title",
					value: draft,
					onChange: setDraft
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
					label: "Entry",
					value: extra,
					onChange: setExtra,
					area: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						"Steady",
						"Stressed",
						"Sharp"
					].map((mood) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "min-h-11 rounded-lg border border-line px-3 text-sm",
						onClick: () => setExtra((value) => `${mood}. ${value}`),
						children: mood
					}, mood))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
					children: "Save entry"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 grid gap-2",
			children: data.journal.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-pink",
					children: row.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-1 block text-muted",
					children: row.body
				})]
			}, row.id))
		})]
	});
	if (slug === "simulators") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Simulators",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-2",
			children: SIMS.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: `min-h-11 rounded-lg border border-line px-3 text-sm ${draft === name ? "text-pink" : ""}`,
				onClick: () => setDraft(name),
				children: name
			}, name))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-3 grid gap-2",
			onSubmit: (event) => {
				event.preventDefault();
				const name = draft || SIMS[0];
				grounded(`${name}. Use only the board. ${extra.trim() || facts(data)}`, data).then((text) => {
					update((prev) => ({
						...prev,
						notes: [{
							id: newId(),
							title: name,
							body: text
						}, ...prev.notes]
					}));
					setExtra("");
				});
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
				label: "What should it use?",
				value: extra,
				onChange: setExtra,
				area: true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "submit",
				className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
				children: "Run and save a note"
			})]
		})]
	});
	if (slug === "vault") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Vault",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Stays on this browser. It is not included in the sync code."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 grid gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					if (!draft.trim() && !extra.trim()) return;
					update((prev) => ({
						...prev,
						vault: [{
							id: newId(),
							title: draft.trim() || "Locked note",
							body: extra.trim(),
							at: (/* @__PURE__ */ new Date()).toISOString()
						}, ...prev.vault]
					}));
					setDraft("");
					setExtra("");
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Label",
						value: draft,
						onChange: setDraft
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: "Secret",
						value: extra,
						onChange: setExtra,
						area: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
						children: "Save here"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4",
				children: data.vault.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "min-h-11 text-sm",
					children: row.title
				}, row.id))
			})
		]
	});
	if (slug === "ai-hub") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-[16rem_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
			title: "Agents",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/agents/nyx.jpg",
						alt: "Nyx",
						className: "agent-ring h-20 w-20 rounded-full object-cover"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid h-20 w-20 place-items-center rounded-full border border-line text-sm",
						children: "Nova"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4",
					children: data.jobs.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-11 w-full items-center justify-between text-left text-sm",
						onClick: () => update((prev) => ({
							...prev,
							jobs: prev.jobs.map((item) => item.id === row.id ? {
								...item,
								active: !item.active
							} : item)
						})),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							row.agent,
							": ",
							row.task
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: row.active ? "text-green" : "text-muted",
							children: row.active ? "Active" : "Off"
						})]
					}) }, row.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
						label: "New assignment",
						onAdd: (task) => update((prev) => ({
							...prev,
							jobs: [{
								id: newId(),
								agent: "Erebus",
								task,
								active: true
							}, ...prev.jobs]
						}))
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
			title: "Nyx",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid max-h-64 gap-2 overflow-y-auto",
				children: data.thread.slice(-8).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted",
						children: [row.who, ": "]
					}), row.text]
				}, row.id))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					const text = draft.trim();
					if (!text) return;
					setDraft("");
					update((prev) => ({
						...prev,
						thread: [...prev.thread, {
							id: newId(),
							who: "You",
							text,
							mine: true
						}]
					}));
					grounded(text, data).then((reply) => update((prev) => ({
						...prev,
						thread: [...prev.thread, {
							id: newId(),
							who: "Nyx",
							text: reply,
							mine: false
						}]
					})));
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm",
					style: { caretColor: "transparent" },
					value: draft,
					placeholder: "Ask from the board",
					onChange: (event) => setDraft(event.target.value)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
					children: "Ask"
				})]
			})]
		})]
	});
	if (slug === "integrations") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Integrations",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Keys stay on this browser. No password. Google Calendar fills the week when this app is opened from Grok with Google connected."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-3 min-h-11 rounded-lg border border-line px-3 text-sm text-pink",
				onClick: () => {
					import("./sync-CMSDJesh.mjs").then(({ pullCalendar }) => pullCalendar()).then((day) => {
						if (!day.events.length) return;
						update((prev) => ({
							...prev,
							events: [...day.events.map((event) => ({
								id: newId(),
								day: (/* @__PURE__ */ new Date()).getDay(),
								title: event.title
							})), ...prev.events]
						}));
					}).catch(() => void 0);
				},
				children: "Pull today's calendar"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add$1, {
					label: "Service name",
					onAdd: (name) => update((prev) => ({
						...prev,
						keys: [{
							id: newId(),
							name,
							value: ""
						}, ...prev.keys]
					}))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3",
				children: data.keys.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "mt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field$1, {
						label: row.name,
						value: row.value,
						onChange: (value) => update((prev) => ({
							...prev,
							keys: prev.keys.map((item) => item.id === row.id ? {
								...item,
								value
							} : item)
						}))
					})
				}, row.id))
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card$1, {
		title: "Settings",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Notes, tasks, contacts, and the rest of the board sync with this code. Keys and the vault stay on this browser only."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 break-all font-mono text-xs text-violet",
				children: code
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					const input = event.currentTarget.elements.namedItem("code");
					if (adoptDevice(input instanceof HTMLInputElement ? input.value : "") && input instanceof HTMLInputElement) input.value = "";
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					name: "code",
					placeholder: "Paste a code from another browser",
					className: "min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm",
					style: { caretColor: "transparent" }
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
					children: "Load"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
					onClick: () => {
						const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
						const link = document.createElement("a");
						link.href = url;
						link.download = "lifeos.json";
						link.click();
						URL.revokeObjectURL(url);
					},
					children: "Export"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "min-h-11 cursor-pointer rounded-lg border border-line px-3 py-2 text-sm",
					children: ["Import", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "file",
						accept: "application/json",
						className: "sr-only",
						onChange: (event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							file.text().then((text) => update(() => sanitizeMemory(JSON.parse(text))));
						}
					})]
				})]
			})
		]
	});
}
function Card({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "glass rounded-2xl p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-mono text-xs tracking-widest text-blue-2",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3",
			children
		})]
	});
}
function Field({ label, value, onChange, area }) {
	const className = "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-fg outline-none";
	const style = { caretColor: "transparent" };
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block text-sm text-muted",
		children: [label, area ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
			className: `${className} min-h-24`,
			style,
			value,
			onChange: (event) => onChange(event.target.value)
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			className,
			style,
			value,
			onChange: (event) => onChange(event.target.value)
		})]
	});
}
function Add({ label, onAdd }) {
	const [value, setValue] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "flex gap-2",
		onSubmit: (event) => {
			event.preventDefault();
			const next = value.trim();
			if (!next) return;
			onAdd(next);
			setValue("");
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			className: "min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm text-fg outline-none",
			style: { caretColor: "transparent" },
			value,
			placeholder: label,
			onChange: (event) => setValue(event.target.value)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "submit",
			className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
			children: "Save"
		})]
	});
}
function clock() {
	return (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
function answer(text, data) {
	const q = text.toLowerCase();
	const openTasks = data.tasks.filter((row) => !row.done);
	const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);
	if (q.includes("task")) return openTasks.length ? openTasks.map((row) => row.title).join(". ") : "No open tasks on the board.";
	if (q.includes("lead") || q.includes("contact")) {
		const names = [...data.leads.map((row) => row.name), ...data.contacts.map((row) => row.name)].filter(Boolean);
		return names.length ? names.join(", ") : "No leads or contacts saved.";
	}
	if (q.includes("money") || q.includes("balance") || q.includes("pay")) {
		const unpaid = data.expenses.filter((row) => !row.paid).map((row) => row.name);
		return `Net on the board is $${net.toLocaleString()}.${unpaid.length ? ` Unpaid: ${unpaid.join(", ")}.` : ""}`;
	}
	if (q.includes("note")) return data.notes[0]?.body || data.notes[0]?.title || "No notes saved.";
	return "I only use saved notes, tasks, leads, contacts, and balances. Ask about one of those.";
}
function listen(onText) {
	const Rec = window.webkitSpeechRecognition;
	if (!Rec) return;
	const rec = new Rec();
	rec.onresult = (event) => onText(event.results[0][0].transcript);
	rec.start();
}
var GLOW = [
	"#c084fc",
	"#ff4fd8",
	"#ff8a3d",
	"#3dffb0",
	"#ffb020",
	"#7c5cff"
];
function GlowBars({ rows }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-28 min-w-0 overflow-hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
				data: rows,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						dataKey: "name",
						tick: {
							fill: "#a394b8",
							fontSize: 10
						},
						interval: "preserveStartEnd"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						dataKey: "value",
						radius: 4,
						children: rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, { fill: GLOW[index % GLOW.length] }, row.name))
					})
				]
			})
		})
	});
}
function GlowArea({ rows, color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-24 min-w-0 overflow-hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
				data: rows,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
					type: "monotone",
					dataKey: "value",
					stroke: color,
					fill: color,
					fillOpacity: .22
				})]
			})
		})
	});
}
function Dashboard() {
	const { data, update } = useMemory();
	const [now, setNow] = (0, import_react.useState)("Atlanta");
	const [weather, setWeather] = (0, import_react.useState)("Atlanta");
	const [draft, setDraft] = (0, import_react.useState)("");
	const [live, setLive] = (0, import_react.useState)("Calendar uses the Google connection when this app is opened from Grok.");
	const [noteTitle, setNoteTitle] = (0, import_react.useState)("");
	const [noteBody, setNoteBody] = (0, import_react.useState)("");
	const [video, setVideo] = (0, import_react.useState)("atlanta skyline");
	const [billName, setBillName] = (0, import_react.useState)("");
	const [bill, setBill] = (0, import_react.useState)("");
	const open = data.tasks.filter((row) => !row.done).length;
	const done = data.tasks.length - open;
	const money = data.accounts.map((row) => ({
		name: row.name,
		value: row.balance
	}));
	const tasks = [{
		name: "Open",
		value: open
	}, {
		name: "Done",
		value: done
	}];
	const leadMap = /* @__PURE__ */ new Map();
	for (const lead of data.leads) leadMap.set(lead.status || "New", (leadMap.get(lead.status || "New") || 0) + 1);
	const leads = [...leadMap.entries()].map(([name, value]) => ({
		name,
		value
	}));
	const budget = data.expenses.map((row) => ({
		name: row.name,
		value: row.paid ? row.amount : -row.amount
	}));
	const social = (data.social[0]?.points || []).map((value, index) => ({
		name: String(index + 1),
		value
	}));
	(0, import_react.useEffect)(() => {
		const timer = setInterval(() => setNow(clock()), 3e4);
		setNow(clock());
		fetch("https://api.open-meteo.com/v1/forecast?latitude=33.75&longitude=-84.39&current=temperature_2m,weather_code").then((response) => response.json()).then((payload) => {
			const temp = payload?.current?.temperature_2m;
			if (typeof temp === "number") setWeather(`${Math.round(temp)}° Atlanta`);
		}).catch(() => setWeather("Atlanta"));
		import("./sync-CMSDJesh.mjs").then(({ pullCalendar }) => pullCalendar()).then((day) => {
			if (day.events.length) update((prev) => ({
				...prev,
				events: day.events.map((event, index) => ({
					id: `cal-${index}`,
					day: (/* @__PURE__ */ new Date()).getDay(),
					title: `${event.when.slice(11, 16) || "Today"} ${event.title}`
				}))
			}));
			setLive(day.note);
		}).catch(() => setLive("Calendar is not connected."));
		return () => clearInterval(timer);
	}, [update]);
	function facts() {
		const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);
		return [
			`Time ${now}. Weather ${weather}.`,
			`Open tasks: ${data.tasks.filter((row) => !row.done).map((row) => row.title).join(", ") || "none"}.`,
			`Leads: ${data.leads.map((row) => `${row.name} (${row.status})`).join(", ") || "none"}.`,
			`Net balance ${net}. Unpaid: ${data.expenses.filter((row) => !row.paid).map((row) => row.name).join(", ") || "none"}.`,
			`Notes: ${data.notes.map((row) => row.title).join(", ") || "none"}.`
		].join("\n");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_19rem]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid content-start gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							title: "Today",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-2xl",
								children: now
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-green",
								children: weather
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							title: "Tasks",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlowBars, { rows: tasks }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add, {
								label: "New task",
								onAdd: (title) => update((prev) => ({
									...prev,
									tasks: [{
										id: newId(),
										title,
										done: false
									}, ...prev.tasks]
								}))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							title: "Leads",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlowBars, { rows: leads.length ? leads : [{
								name: "None",
								value: 0
							}] }), data.leads.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [
									row.name,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted",
										children: row.status
									})
								]
							}, row.id))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
							title: "Notes",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								className: "grid gap-2",
								onSubmit: (event) => {
									event.preventDefault();
									update((prev) => ({
										...prev,
										notes: [{
											id: newId(),
											title: noteTitle,
											body: noteBody
										}, ...prev.notes]
									}));
									setNoteTitle("");
									setNoteBody("");
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Title",
										value: noteTitle,
										onChange: setNoteTitle
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Note",
										value: noteBody,
										onChange: setNoteBody,
										area: true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
										children: "Save note"
									})
								]
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid content-start gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "glass rounded-3xl p-4 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-xs tracking-widest text-pink",
								children: "AI ASSISTANT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "agent-ring mx-auto mt-3 h-52 w-52 overflow-hidden rounded-full",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: "/agents/nyx.jpg",
									alt: "Nyx",
									className: "h-full w-full object-cover"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-sm text-muted",
								children: "Nyx only uses what is saved on this board."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-3 grid gap-2 text-left",
								children: data.thread.slice(-4).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: `rounded-2xl px-3 py-2 text-sm ${row.mine ? "ml-8 bg-ink text-pink" : "mr-8 border border-line"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-muted",
										children: [row.who, ": "]
									}), row.text]
								}, row.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								className: "mt-3 flex gap-2",
								onSubmit: (event) => {
									event.preventDefault();
									const text = draft.trim();
									if (!text) return;
									setDraft("");
									const mine = {
										id: newId(),
										who: "You",
										text,
										mine: true
									};
									update((prev) => ({
										...prev,
										thread: [...prev.thread, mine]
									}));
									import("./sync-CMSDJesh.mjs").then(({ askNyx }) => askNyx({ data: {
										question: text,
										facts: facts()
									} })).then((result) => {
										const reply = result.ok && result.text ? result.text : answer(text, data);
										update((prev) => ({
											...prev,
											thread: [...prev.thread, {
												id: newId(),
												who: "Nyx",
												text: reply,
												mine: false
											}]
										}));
									}).catch(() => {
										update((prev) => ({
											...prev,
											thread: [...prev.thread, {
												id: newId(),
												who: "Nyx",
												text: answer(text, data),
												mine: false
											}]
										}));
									});
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "min-h-11 flex-1 rounded-full border border-line bg-ink px-4 text-sm",
										style: { caretColor: "transparent" },
										value: draft,
										placeholder: "Ask Nyx",
										onChange: (event) => setDraft(event.target.value)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "min-h-11 rounded-full border border-pink px-3 text-sm text-pink",
										onClick: () => listen(setDraft),
										children: "Listen"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "min-h-11 rounded-full bg-blue px-4 text-sm text-ink",
										children: "Send"
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
							title: "Agents",
							children: data.jobs.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "flex min-h-11 w-full items-center justify-between text-left text-sm",
								onClick: () => update((prev) => ({
									...prev,
									jobs: prev.jobs.map((item) => item.id === row.id ? {
										...item,
										active: !item.active
									} : item)
								})),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.agent }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: row.active ? "text-green" : "text-muted",
									children: row.active ? "Active" : "Off"
								})]
							}, row.id))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
							title: "Notifications",
							children: data.notifs.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "flex min-h-11 w-full items-start gap-2 py-1 text-left text-sm",
								onClick: () => update((prev) => ({
									...prev,
									notifs: prev.notifs.map((item) => item.id === row.id ? {
										...item,
										seen: true
									} : item)
								})),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: row.seen ? "mt-1 h-2 w-2 rounded-full bg-muted" : "blink mt-1 h-2 w-2 rounded-full bg-orange" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.text })]
							}, row.id))
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid content-start gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
							title: "Money",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlowBars, { rows: money })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							title: "Credit",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meter, {
								label: "FICO",
								score: data.fico
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Meter, {
								label: "Vantage",
								score: data.vantage
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							title: "Budget",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlowArea, {
								rows: budget.map((row) => ({
									name: row.name,
									value: Math.abs(row.value)
								})),
								color: "#ff8a3d"
							}), data.expenses.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "flex min-h-11 w-full items-center justify-between text-sm",
								onClick: () => update((prev) => ({
									...prev,
									expenses: prev.expenses.map((item) => item.id === row.id ? {
										...item,
										paid: !item.paid
									} : item)
								})),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: row.paid ? "text-green" : "text-orange",
									children: row.paid ? "Paid" : "Due"
								})]
							}, row.id))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							title: "Schedule",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: live
							}), data.events.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "min-h-11 text-sm",
								children: row.title
							}, row.id))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							title: "Reach",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlowArea, {
									rows: social.length ? social : [{
										name: "0",
										value: 0
									}],
									color: "#3dffb0"
								}),
								insights(data).slice(0, 2).map((tip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm",
									children: tip
								}, tip)),
								moneyTips(data).slice(0, 1).map((tip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm text-pink",
									children: tip
								}, tip))
							]
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 lg:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					title: "Notes",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-[8rem_1fr]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-col gap-1",
							children: data.notes.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "min-h-11 truncate text-left text-sm text-blue-2",
								onClick: () => {
									setNoteTitle(row.title);
									setNoteBody(row.body);
								},
								children: row.title || "Untitled"
							}, row.id))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "grid gap-2",
							onSubmit: (event) => {
								event.preventDefault();
								update((prev) => ({
									...prev,
									notes: [{
										id: newId(),
										title: noteTitle,
										body: noteBody
									}, ...prev.notes.filter((row) => row.title !== noteTitle)]
								}));
								setNoteTitle("");
								setNoteBody("");
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Title",
									value: noteTitle,
									onChange: setNoteTitle
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Note",
									value: noteBody,
									onChange: setNoteBody,
									area: true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									className: "min-h-11 rounded-lg bg-blue text-sm text-ink",
									children: "Save note"
								})
							]
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					title: "Tasks",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add, {
						label: "New task",
						onAdd: (title) => update((prev) => ({
							...prev,
							tasks: [{
								id: newId(),
								title,
								done: false
							}, ...prev.tasks]
						}))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2",
						children: data.tasks.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex min-h-11 items-center gap-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: row.done,
								onChange: () => update((prev) => ({
									...prev,
									tasks: prev.tasks.map((item) => item.id === row.id ? {
										...item,
										done: !item.done
									} : item)
								}))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: row.done ? "text-muted line-through" : "",
								children: row.title
							})]
						}) }, row.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					title: "Video",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add, {
						label: "Search YouTube",
						onAdd: setVideo
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
						title: "Video",
						className: "mt-3 aspect-video w-full rounded-xl",
						src: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(video)}`,
						allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					title: "Music",
					children: data.tracks[0]?.url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", {
						className: "w-full",
						controls: true,
						src: data.tracks[0].url
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Add a track on the Music page."
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					title: "Product ROI",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlowBars, { rows: data.products.map((row) => ({
						name: row.name,
						value: row.revenue - row.cost
					})) }), data.products.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							row.name,
							" · cost $",
							row.cost,
							" · revenue $",
							row.revenue
						]
					}, row.id))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					title: "Budget",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "flex gap-2",
						onSubmit: (event) => {
							event.preventDefault();
							const amount = Number(bill);
							if (!billName.trim() || !Number.isFinite(amount)) return;
							update((prev) => ({
								...prev,
								expenses: [{
									id: newId(),
									name: billName.trim(),
									amount,
									paid: false,
									fixed: true
								}, ...prev.expenses]
							}));
							setBillName("");
							setBill("");
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm",
								style: { caretColor: "transparent" },
								placeholder: "Bill",
								value: billName,
								onChange: (event) => setBillName(event.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "min-h-11 w-24 rounded-lg border border-line bg-ink px-3 text-sm",
								style: { caretColor: "transparent" },
								placeholder: "Amount",
								value: bill,
								onChange: (event) => setBill(event.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								className: "min-h-11 rounded-lg bg-blue px-3 text-sm text-ink",
								children: "Add"
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					title: "Money tips",
					children: moneyTips(data).map((tip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: tip
					}, tip))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					title: "Insights",
					children: insights(data).map((tip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: tip
					}, tip))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					title: "Life hacks",
					children: lifeHacks(data).map((tip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: tip
					}, tip))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					title: "Quick links",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Add, {
						label: "https:// link",
						onAdd: (href) => {
							if (!/^https?:\/\//i.test(href)) return;
							update((prev) => ({
								...prev,
								links: [{
									id: newId(),
									label: href.replace(/^https?:\/\//, "").slice(0, 40),
									href
								}, ...prev.links]
							}));
						}
					}), data.links.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "mt-2 block min-h-11 text-sm text-blue-2",
						href: row.href,
						target: "_blank",
						rel: "noreferrer",
						children: row.label
					}, row.id))]
				})
			]
		})]
	});
}
function Meter({ label, score }) {
	const width = `${(score - 300) / 550 * 100}%`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm",
			children: [
				label,
				" ",
				score,
				" · ",
				band(score)
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-1 h-2 rounded-full bg-ink",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-2 rounded-full bg-green",
				style: { width }
			})
		})]
	});
}
function Panel({ slug }) {
	const { data, update } = useMemory();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WiredPanel, {
		slug,
		data,
		update
	});
}
//#endregion
export { isPanel as i, Frame as n, Panel as r, Dashboard as t };
