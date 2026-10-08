import { useEffect, useRef, useState } from "react";
import { EngineBar } from "./engine-bar";
import { moneyTips } from "@/lib/lifeos/board";
import { newId, type Memory } from "./memory";
import { fmtDate, fmtMoney } from "./format";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Section = "markets" | "balances" | "budget" | "cash" | "holdings" | "products" | "invoices" | "credit" | "insights";
type Quote = { symbol: string; price: number; change: number };

const NAV: { id: Section; label: string }[] = [
  { id: "markets", label: "Markets" },
  { id: "balances", label: "Balances" },
  { id: "budget", label: "Budget" },
  { id: "cash", label: "Cash" },
  { id: "holdings", label: "Holdings" },
  { id: "products", label: "Products" },
  { id: "invoices", label: "Invoices" },
  { id: "credit", label: "Credit" },
  { id: "insights", label: "Insights" },
];
const LEVELS = [
  { label: "Poor", min: 300, max: 579, color: "#fb923c" },
  { label: "Fair", min: 580, max: 669, color: "#fbbf24" },
  { label: "Good", min: 670, max: 739, color: "#4fd2ff" },
  { label: "Great", min: 740, max: 850, color: "#34d399" },
];

function roi(cost: number, revenue: number) {
  if (!cost) return revenue ? "No cost on file" : "—";
  return `${Math.round(((revenue - cost) / cost) * 100)}%`;
}

function money(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function Tape({ rows }: { rows: Quote[] }) {
  if (!rows.length) return <p className="text-sm text-white/40">No match on the board. Press Search to look it up.</p>;
  const line = [...rows, ...rows];
  return (
    <div className="overflow-hidden">
      <div className="tape-row flex w-max gap-8 py-1">
        {line.map((row, index) => (
          <span key={`${row.symbol}-${index}`} className="text-sm">{row.symbol} {money(row.price)} <span className={row.change >= 0 ? "text-green" : "text-ember"}>{row.change.toFixed(1)}%</span></span>
        ))}
      </div>
    </div>
  );
}

function QuoteTable({ rows }: { rows: Quote[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[10px] tracking-widest text-white/35"><th className="py-1">Symbol</th><th>Price</th><th>Change</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-t border-white/10">
              <td className="py-2">{row.symbol}</td>
              <td>{money(row.price)}</td>
              <td className={row.change >= 0 ? "text-green" : "text-ember"}>{row.change >= 0 ? "+" : ""}{row.change.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function invoiceParts(body: string) {
  const [amount, due, status] = body.split("\n");
  return { amount: amount || "$0.00", due: (due || "").replace(/^Due\s*/, ""), status: status || "Draft" };
}

function Ring({ label, score, bureau }: { label: string; score: number; bureau: string }) {
  const level = LEVELS.find((row) => score >= row.min && score <= row.max);
  const pct = Math.min(100, Math.max(0, ((score - 300) / 550) * 100));
  const length = 2 * Math.PI * 32;
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={level?.color ?? "#4fd2ff"} strokeWidth="6" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - pct / 100)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm">{score}</span>
          <span className="text-[11px]" style={{ color: level?.color }}>{level?.label}</span>
        </div>
      </div>
      <p className="text-center text-xs text-white/50">{label}<span className="block text-white/35">{bureau}</span></p>
    </div>
  );
}

export function FinanceDesk({ data, update }: { data: Memory; update: Update }) {
  const [section, setSection] = useState<Section>("markets");
  const [crypto, setCrypto] = useState<Quote[]>([]);
  const [stocks, setStocks] = useState<Quote[]>([]);
  const [when, setWhen] = useState("");
  const [invoice, setInvoice] = useState({ name: "", amount: "", due: "", status: "Draft" });
  const [cash, setCash] = useState({ name: "", amount: "" });
  const [hold, setHold] = useState({ symbol: "BTC", qty: "", kind: "crypto" });
  const [debt, setDebt] = useState({ name: "", balance: "", limit: "", apr: "" });
  const [plan, setPlan] = useState({ amount: "10000", years: "5", risk: "moderate" });
  const [insight, setInsight] = useState("");
  const [spend, setSpend] = useState("");
  const [verdict, setVerdict] = useState("");
  const [lookup, setLookup] = useState({ symbol: "", kind: "all" });
  const [found, setFound] = useState<Quote | null>(null);
  const [lookupNote, setLookupNote] = useState("");
  const [feedNote, setFeedNote] = useState("Connecting to the market feeds…");
  const feed = useRef<WebSocket | null>(null);
  const invoices = data.notes.filter((row) => row.title.startsWith("Invoice ·"));
  const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);
  const unpaid = data.expenses.filter((row) => !row.paid);

  useEffect(() => {
    const products = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD"];
    let socket: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const live = { current: false };
    function connect() {
      socket = new WebSocket("wss://ws-feed.exchange.coinbase.com");
      feed.current = socket;
      socket.onopen = () => {
        setFeedNote("Crypto feed live");
        socket?.send(JSON.stringify({ type: "subscribe", product_ids: products, channels: ["ticker"] }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; product_id?: string; price?: string; open_24h?: string };
          if (message.type !== "ticker" || !message.price || !message.product_id) return;
          live.current = true;
          const symbol = message.product_id.replace("-USD", "");
          const price = Number(message.price);
          const open = Number(message.open_24h) || price;
          if (!price) return;
          const change = open ? ((price - open) / open) * 100 : 0;
          setCrypto((prev) => prev.some((row) => row.symbol === symbol) ? prev.map((row) => row.symbol === symbol ? { symbol, price, change } : row) : [...prev, { symbol, price, change }]);
          setWhen(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }));
          setFeedNote("Crypto feed live");
        } catch { /* ignore a bad tick */ }
      };
      socket.onerror = () => setFeedNote("Crypto feed interrupted");
      socket.onclose = () => {
        if (closed) return;
        setFeedNote("Crypto feed reconnecting…");
        retry = setTimeout(connect, 2000);
      };
    }
    connect();
    let stop = false;
    async function loadStocks() {
      try {
        const { marketQuotes } = await import("@/lib/lifeos/sync");
        const rows = await marketQuotes();
        if (stop) return;
        setStocks(rows.stocks.filter((row) => row.price));
        if (!live.current) setCrypto(rows.crypto.filter((row) => row.price));
        const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
        setFeedNote(live.current ? `Crypto feed live · stocks ${stamp}` : `Stocks ${stamp}`);
      } catch { /* keep the last stock prices */ }
    }
    void loadStocks();
    const timer = setInterval(() => void loadStocks(), 8000);
    return () => { closed = true; stop = true; clearInterval(timer); clearTimeout(retry); socket?.close(); feed.current = null; };
  }, []);

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[12rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Finance</p>
        <div className="mt-3">
          {NAV.map((item) => <button key={item.id} type="button" className={`menu ${section === item.id ? "is-on" : ""}`} onClick={() => setSection(item.id)}>{item.label}</button>)}
        </div>
      </aside>
      <section className="module-card p-4">
        <EngineBar panel="Finance" data={data} update={update} />
        {section === "markets" ? (
          <div>
            <h1 className="text-2xl">Markets</h1>
            <p className="text-sm text-white/50">{feedNote}{when ? ` · last tick ${when}` : ""}</p>
            <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(event) => {
              event.preventDefault();
              const symbol = lookup.symbol.trim().toUpperCase();
              if (!symbol) return;
              const kind = lookup.kind === "all" ? (["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT", "LTC"].includes(symbol) ? "crypto" : "stock") : lookup.kind;
              setLookupNote("Searching…");
              setFound(null);
              void import("@/lib/lifeos/sync").then(({ watchQuote }) => watchQuote({ data: { symbol, kind } })).then((result) => {
                if (!result.ok) { setLookupNote(result.error); return; }
                setFound(result.quote);
                setLookupNote("");
                if (kind === "crypto") {
                  if (feed.current?.readyState === WebSocket.OPEN) feed.current.send(JSON.stringify({ type: "subscribe", product_ids: [`${result.quote.symbol}-USD`], channels: ["ticker"] }));
                  setCrypto((prev) => prev.some((row) => row.symbol === result.quote.symbol) ? prev.map((row) => row.symbol === result.quote.symbol ? result.quote : row) : [...prev, result.quote]);
                } else setStocks((prev) => prev.some((row) => row.symbol === result.quote.symbol) ? prev.map((row) => row.symbol === result.quote.symbol ? result.quote : row) : [...prev, result.quote]);
              });
            }}>
              <input className="h-9 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-4 text-sm" placeholder="Search stocks or crypto" value={lookup.symbol} onChange={(event) => setLookup({ ...lookup, symbol: event.target.value.toUpperCase() })} />
              {["all", "crypto", "stock"].map((kind) => <button key={kind} type="button" className={`quiet ${lookup.kind === kind ? "is-on" : ""}`} onClick={() => setLookup({ ...lookup, kind })}>{kind}</button>)}
              <button type="submit" className="quiet is-on">Search</button>
            </form>
            {found ? <p className="mt-2 text-sm">{found.symbol} {money(found.price)} <span className={found.change >= 0 ? "text-green" : "text-ember"}>{found.change.toFixed(1)}%</span></p> : null}
            {lookupNote ? <p className="mt-2 text-sm text-white/50">{lookupNote}</p> : null}
            <p className="mt-4 text-[10px] tracking-widest text-white/35">CRYPTO</p>
            <Tape rows={crypto.filter((row) => lookup.kind !== "stock" && (!lookup.symbol.trim() || row.symbol.includes(lookup.symbol.trim().toUpperCase())))} />
            <QuoteTable rows={crypto.filter((row) => lookup.kind !== "stock" && (!lookup.symbol.trim() || row.symbol.includes(lookup.symbol.trim().toUpperCase())))} />
            <p className="mt-4 text-[10px] tracking-widest text-white/35">STOCKS</p>
            <Tape rows={stocks.filter((row) => lookup.kind !== "crypto" && (!lookup.symbol.trim() || row.symbol.includes(lookup.symbol.trim().toUpperCase())))} />
            <QuoteTable rows={stocks.filter((row) => lookup.kind !== "crypto" && (!lookup.symbol.trim() || row.symbol.includes(lookup.symbol.trim().toUpperCase())))} />
          </div>
        ) : null}
        {section === "balances" ? (
          <div>
            <h1 className="text-2xl">Balances</h1>
            <p className="text-sm text-white/50">Net {fmtMoney(net)} across {data.accounts.length} accounts</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {data.accounts.map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm">{row.name}</p>
                      <p className="text-[11px] text-white/40">{[row.kind || "Account", row.institution, row.last4 ? `··${row.last4}` : ""].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className={row.balance >= row.prior ? "text-green" : "text-ember"}>{row.balance >= row.prior ? "Up" : "Down"} {fmtMoney(Math.abs(row.balance - row.prior))}</span>
                  </div>
                  <label className="mt-2 block text-[11px] text-white/40">Balance
                    <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-right text-sm" value={row.balance} onChange={(event) => { const balance = Number(event.target.value); if (Number.isFinite(balance)) update((prev) => ({ ...prev, accounts: prev.accounts.map((item) => item.id === row.id ? { ...item, prior: item.balance, balance } : item) })); }} />
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input className="h-8 rounded-full border border-line bg-black/40 px-2 text-xs" placeholder="Type" value={row.kind || ""} onChange={(event) => update((prev) => ({ ...prev, accounts: prev.accounts.map((item) => item.id === row.id ? { ...item, kind: event.target.value } : item) }))} />
                    <input className="h-8 rounded-full border border-line bg-black/40 px-2 text-xs" placeholder="Bank" value={row.institution || ""} onChange={(event) => update((prev) => ({ ...prev, accounts: prev.accounts.map((item) => item.id === row.id ? { ...item, institution: event.target.value } : item) }))} />
                    <input className="h-8 rounded-full border border-line bg-black/40 px-2 text-xs" placeholder="Last 4" value={row.last4 || ""} onChange={(event) => update((prev) => ({ ...prev, accounts: prev.accounts.map((item) => item.id === row.id ? { ...item, last4: event.target.value.replace(/\D/g, "").slice(0, 4) } : item) }))} />
                  </div>
                </div>
              ))}
            </div>
            <Add name="New account" onAdd={(name) => update((prev) => ({ ...prev, accounts: [...prev.accounts, { id: newId(), name, balance: 0, prior: 0, kind: "Bank", institution: "", last4: "" }] }))} />
          </div>
        ) : null}
        {section === "budget" ? (
          <div>
            <h1 className="text-2xl">Budget</h1>
            <p className="text-sm text-white/50">{unpaid.length ? `${unpaid.length} unpaid` : "Nothing unpaid"} · {fmtMoney(data.expenses.reduce((sum, row) => sum + row.amount, 0))} listed · {fmtMoney(data.expenses.filter((row) => row.paid).reduce((sum, row) => sum + row.amount, 0))} paid</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-300/80" style={{ width: `${data.expenses.reduce((sum, row) => sum + row.amount, 0) ? Math.round((data.expenses.filter((row) => row.paid).reduce((sum, row) => sum + row.amount, 0) / data.expenses.reduce((sum, row) => sum + row.amount, 0)) * 100) : 0}%` }} />
            </div>
            {data.expenses.map((row) => (
              <div key={row.id} className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-28">{row.name}</span>
                <input className="h-8 w-28 rounded-full border border-line bg-black/40 px-3 text-xs" placeholder="Category" value={row.category || ""} onChange={(event) => update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, category: event.target.value } : item) }))} />
                <input className="h-8 w-24 rounded-full border border-line bg-black/40 px-3 text-right text-sm" value={row.amount} aria-label="Amount" onChange={(event) => { const amount = Number(event.target.value); if (Number.isFinite(amount)) update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, amount } : item) })); }} />
                <span>{fmtMoney(row.amount)}</span>
                <button type="button" className={`quiet ${row.fixed ? "is-on" : ""}`} onClick={() => update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, fixed: !item.fixed } : item) }))}>{row.fixed ? "Fixed" : "Flexible"}</button>
                <button type="button" className={`quiet ${row.paid ? "is-on" : ""}`} onClick={() => update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, paid: !item.paid } : item) }))}>{row.paid ? "Paid" : "Due"}</button>
              </div>
            ))}
            <Add name="New bill" onAdd={(name) => update((prev) => ({ ...prev, expenses: [{ id: newId(), name, amount: 0, paid: false, fixed: true, category: "Bills" }, ...prev.expenses] }))} />
          </div>
        ) : null}
        {section === "cash" ? (
          <div>
            <h1 className="text-2xl">Cash</h1>
            <p className="text-sm text-white/50">Money in is what you log. Money out is the bills already on the budget.</p>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(cash.amount);
              if (!cash.name.trim() || !Number.isFinite(amount)) return;
              update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Income · ${cash.name.trim()}`, body: fmtMoney(amount) }, ...prev.notes] }));
              setCash({ name: "", amount: "" });
            }}>
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Source" value={cash.name} onChange={(event) => setCash({ ...cash, name: event.target.value })} />
              <input className="h-8 w-28 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Amount" value={cash.amount} onChange={(event) => setCash({ ...cash, amount: event.target.value.replace(/[^0-9.]/g, "") })} />
              <button type="submit" className="quiet is-on">Add income</button>
            </form>
            {data.notes.filter((row) => row.title.startsWith("Income ·")).map((row) => (
              <div key={row.id} className="mt-3 flex items-center justify-between border-b border-white/10 py-2 text-sm">
                <span>{row.title.replace("Income · ", "")} <span className="text-green">{row.body}</span></span>
                <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== row.id) }))}>Remove</button>
              </div>
            ))}
            <p className="mt-3 text-sm text-white/50">Bills listed {fmtMoney(data.expenses.reduce((sum, row) => sum + row.amount, 0))}. Still due {fmtMoney(unpaid.reduce((sum, row) => sum + row.amount, 0))}.</p>
          </div>
        ) : null}
        {section === "holdings" ? (
          <div>
            <h1 className="text-2xl">Holdings</h1>
            <p className="text-sm text-white/50">Quantity times the live quote when the symbol matches the tape. Otherwise the value stays blank.</p>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => {
              event.preventDefault();
              const qty = Number(hold.qty);
              if (!hold.symbol.trim() || !Number.isFinite(qty) || qty <= 0) return;
              const symbol = hold.symbol.trim().toUpperCase();
              update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Hold · ${symbol}`, body: `${qty}\n${hold.kind}` }, ...prev.notes.filter((row) => row.title !== `Hold · ${symbol}`)] }));
              setHold({ ...hold, qty: "" });
            }}>
              <input className="h-8 w-24 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Symbol" value={hold.symbol} onChange={(event) => setHold({ ...hold, symbol: event.target.value })} />
              <input className="h-8 w-24 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Qty" value={hold.qty} onChange={(event) => setHold({ ...hold, qty: event.target.value.replace(/[^0-9.]/g, "") })} />
              {["crypto", "stock"].map((kind) => <button key={kind} type="button" className={`quiet ${hold.kind === kind ? "is-on" : ""}`} onClick={() => setHold({ ...hold, kind })}>{kind}</button>)}
              <button type="submit" className="quiet is-on">Save</button>
            </form>
            {data.notes.filter((row) => row.title.startsWith("Hold ·")).map((row) => {
              const symbol = row.title.replace("Hold · ", "");
              const [qtyLine, kind] = row.body.split("\n");
              const qty = Number(qtyLine);
              const quote = [...crypto, ...stocks].find((item) => item.symbol.toUpperCase() === symbol);
              return (
                <div key={row.id} className="mt-3 flex items-center justify-between border-b border-white/10 py-2 text-sm">
                  <span>{symbol} <span className="text-white/40">{qty} {kind || ""}</span></span>
                  <span>{quote && Number.isFinite(qty) ? fmtMoney(qty * quote.price) : "No quote"}</span>
                  <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== row.id) }))}>Remove</button>
                </div>
              );
            })}
          </div>
        ) : null}
        {section === "products" ? (
          <div>
            <h1 className="text-2xl">Products</h1>
            <p className="text-sm text-white/50">Cost, revenue, and return on each product.</p>
            {data.products.map((row) => (
              <div key={row.id} className="mt-3 grid items-center gap-2 text-sm sm:grid-cols-[1fr_6rem_6rem_auto]">
                <span>{row.name}</span>
                <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={row.cost} aria-label="Cost" onChange={(event) => { const cost = Number(event.target.value); if (Number.isFinite(cost)) update((prev) => ({ ...prev, products: prev.products.map((item) => item.id === row.id ? { ...item, cost } : item) })); }} />
                <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={row.revenue} aria-label="Revenue" onChange={(event) => { const revenue = Number(event.target.value); if (Number.isFinite(revenue)) update((prev) => ({ ...prev, products: prev.products.map((item) => item.id === row.id ? { ...item, revenue } : item) })); }} />
                <span>{fmtMoney(row.revenue - row.cost)} · {roi(row.cost, row.revenue)}</span>
              </div>
            ))}
            <Add name="New product" onAdd={(name) => update((prev) => ({ ...prev, products: [...prev.products, { id: newId(), name, cost: 0, revenue: 0 }] }))} />
          </div>
        ) : null}
        {section === "invoices" ? (
          <div>
            <h1 className="text-2xl">Invoices</h1>
            <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={(event) => {
              event.preventDefault();
              if (!invoice.name.trim()) return;
              const amount = Number(invoice.amount);
              update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Invoice · ${invoice.name.trim()}`, body: `${Number.isFinite(amount) ? fmtMoney(amount) : "$0.00"}\nDue ${invoice.due || fmtDate(new Date())}\n${invoice.status}` }, ...prev.notes] }));
              setInvoice({ name: "", amount: "", due: "", status: "Draft" });
            }}>
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Client" value={invoice.name} onChange={(event) => setInvoice({ ...invoice, name: event.target.value })} />
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Amount" value={invoice.amount} onChange={(event) => setInvoice({ ...invoice, amount: event.target.value.replace(/[^0-9.]/g, "") })} />
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="MM/DD/YYYY" value={invoice.due} onChange={(event) => setInvoice({ ...invoice, due: event.target.value })} />
              <button type="submit" className="bg-blue">Save invoice</button>
            </form>
            <div className="mt-2 flex gap-4">{["Draft", "Sent", "Paid"].map((status) => <button key={status} type="button" className={`quiet ${invoice.status === status ? "is-on" : ""}`} onClick={() => setInvoice({ ...invoice, status })}>{status}</button>)}</div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/60">
              <span>Open {fmtMoney(invoices.reduce((sum, row) => invoiceParts(row.body).status === "Paid" ? sum : sum + Number(invoiceParts(row.body).amount.replace(/[^0-9.]/g, "")), 0))}</span>
              <span>Paid {fmtMoney(invoices.reduce((sum, row) => invoiceParts(row.body).status === "Paid" ? sum + Number(invoiceParts(row.body).amount.replace(/[^0-9.]/g, "")) : sum, 0))}</span>
            </div>
            {invoices.map((row) => {
              const parts = invoiceParts(row.body);
              return (
                <div key={row.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-2 text-sm">
                  <div>
                    <p>{row.title.replace("Invoice · ", "")}</p>
                    <p className="text-[11px] text-white/40">{parts.amount} · due {parts.due || "—"}</p>
                  </div>
                  <button type="button" className={`quiet ${parts.status === "Paid" ? "is-on" : ""}`} onClick={() => {
                    const order = ["Draft", "Sent", "Paid"];
                    const next = order[(order.indexOf(parts.status) + 1) % order.length];
                    update((prev) => ({ ...prev, notes: prev.notes.map((item) => item.id === row.id ? { ...item, body: `${parts.amount}\nDue ${parts.due}\n${next}` } : item) }));
                  }}>{parts.status}</button>
                  <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== row.id) }))}>Remove</button>
                </div>
              );
            })}
            {!invoices.length ? <p className="mt-3 text-sm text-white/40">No invoices yet.</p> : null}
          </div>
        ) : null}
        {section === "credit" ? (
          <div>
            <h1 className="text-2xl">Credit</h1>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] uppercase tracking-wider text-white/40">FICO
                <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm normal-case" value={data.fico} onChange={(event) => { const fico = Number(event.target.value); if (Number.isFinite(fico)) update((prev) => ({ ...prev, fico })); }} />
              </label>
              <label className="text-[11px] uppercase tracking-wider text-white/40">Vantage
                <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm normal-case" value={data.vantage} onChange={(event) => { const vantage = Number(event.target.value); if (Number.isFinite(vantage)) update((prev) => ({ ...prev, vantage })); }} />
              </label>
            </div>
            <div className="mt-4 flex justify-around gap-3">
              <Ring label="FICO" score={data.fico} bureau="Experian" />
              <Ring label="Vantage" score={data.vantage} bureau="Credit Karma" />
            </div>
            <form className="mt-4 grid gap-2 sm:grid-cols-4" onSubmit={(event) => {
              event.preventDefault();
              if (!debt.name.trim()) return;
              update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Debt · ${debt.name.trim()}`, body: `${debt.balance || "0"}\n${debt.limit || "0"}\n${debt.apr || "0"}` }, ...prev.notes.filter((row) => row.title !== `Debt · ${debt.name.trim()}`)] }));
              setDebt({ name: "", balance: "", limit: "", apr: "" });
            }}>
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Debt" value={debt.name} onChange={(event) => setDebt({ ...debt, name: event.target.value })} />
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Balance" value={debt.balance} onChange={(event) => setDebt({ ...debt, balance: event.target.value.replace(/[^0-9.]/g, "") })} />
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Limit" value={debt.limit} onChange={(event) => setDebt({ ...debt, limit: event.target.value.replace(/[^0-9.]/g, "") })} />
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="APR" value={debt.apr} onChange={(event) => setDebt({ ...debt, apr: event.target.value.replace(/[^0-9.]/g, "") })} />
              <button type="submit" className="quiet is-on sm:col-span-4 sm:w-fit">Save debt</button>
            </form>
            {data.notes.filter((row) => row.title.startsWith("Debt ·")).map((row) => {
              const [balance, limit, apr] = row.body.split("\n").map(Number);
              const used = limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0;
              return (
                <div key={row.id} className="mt-3 border-b border-white/10 py-2 text-sm">
                  <div className="flex justify-between"><span>{row.title.replace("Debt · ", "")}</span><span>{fmtMoney(balance || 0)}{apr ? ` · ${apr}%` : ""}</span></div>
                  {limit > 0 ? <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-blue" style={{ width: `${used}%` }} /></div> : null}
                  {limit > 0 ? <p className="text-[11px] text-white/40">{used}% of {fmtMoney(limit)}{used > 30 ? " · over 30%" : ""}</p> : null}
                  <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== row.id) }))}>Remove</button>
                </div>
              );
            })}
          </div>
        ) : null}
        {section === "insights" ? (
          <div>
            <h1 className="text-2xl">Insights</h1>
            <p className="text-sm text-white/50">Notes from the numbers on this board. Not a trade.</p>
            {moneyTips(data).map((tip) => <p key={tip} className="mt-3 text-sm">{tip}</p>)}
            {data.products.map((row) => <p key={row.id} className="mt-2 text-sm text-white/70">{row.name} returns {fmtMoney(row.revenue - row.cost)} on {fmtMoney(row.cost)} cost ({roi(row.cost, row.revenue)}).</p>)}
            <button type="button" className="bg-blue mt-4" onClick={() => {
              setInsight("Reading the figures…");
              const facts = [`Net ${fmtMoney(net)}.`, `Unpaid: ${unpaid.map((row) => `${row.name} ${fmtMoney(row.amount)}`).join(", ") || "none"}.`, `Open invoices ${fmtMoney(invoices.reduce((sum, row) => invoiceParts(row.body).status === "Paid" ? sum : sum + Number(invoiceParts(row.body).amount.replace(/[^0-9.]/g, "")), 0))}.`, `FICO ${data.fico}, Vantage ${data.vantage}.`, ...data.products.map((row) => `${row.name} cost ${row.cost} revenue ${row.revenue}.`), ...[...crypto, ...stocks].slice(0, 8).map((row) => `${row.symbol} ${money(row.price)} ${row.change.toFixed(1)}%.`)].join(" ");
              void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: "Using only these figures, give three short notes on cash, ROI, or what to pay first. Do not invent prices, returns, or market calls.", facts } })).then((result) => setInsight(result.text || "No note came back."));
            }}>Read the books</button>
            {insight ? <p className="mt-3 whitespace-pre-wrap text-sm text-white/70">{insight}</p> : null}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h2 className="text-lg">Decision check</h2>
              <p className="text-sm text-white/45">Uses the surplus on this board. It does not invent a bank balance.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="A purchase or bill" value={spend} onChange={(event) => setSpend(event.target.value)} />
                <button type="button" className="quiet is-on" onClick={() => {
                  if (!spend.trim()) return;
                  const surplus = net - unpaid.reduce((sum, row) => sum + row.amount, 0);
                  setVerdict("Checking the ripple…");
                  const facts = `Board net ${fmtMoney(net)}. Unpaid ${fmtMoney(unpaid.reduce((sum, row) => sum + row.amount, 0))}. Surplus after unpaid ${fmtMoney(surplus)}. FICO ${data.fico}.`;
                  void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { name: "Oracle", prompt: "Judge one spend against these figures only. Say worth it, skip it, or delay it, then one sentence. If the price is not in the question, do not invent one. Do not invent a freedom number.", facts, question: spend } })).then((result) => setVerdict(result.text || "No verdict."));
                }}>Scan</button>
              </div>
              {verdict ? <p className="mt-3 whitespace-pre-wrap text-sm text-white/70">{verdict}</p> : null}
            </div>
            <div className="mt-6 border-t border-white/10 pt-4">
              <h2 className="text-lg">Growth model</h2>
              <p className="text-sm text-white/45">Compound math only. It is not a forecast and it does not use live prices.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input className="h-8 w-28 rounded-full border border-line bg-black/40 px-3 text-sm" value={plan.amount} aria-label="Amount" onChange={(event) => setPlan({ ...plan, amount: event.target.value.replace(/[^0-9.]/g, "") })} />
                <input className="h-8 w-16 rounded-full border border-line bg-black/40 px-3 text-sm" value={plan.years} aria-label="Years" onChange={(event) => setPlan({ ...plan, years: event.target.value.replace(/[^0-9]/g, "") })} />
                {["conservative", "moderate", "aggressive"].map((risk) => <button key={risk} type="button" className={`quiet ${plan.risk === risk ? "is-on" : ""}`} onClick={() => setPlan({ ...plan, risk })}>{risk}</button>)}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
                {([["5%", 0.05], ["10%", 0.1], ["14%", 0.14]] as const).map(([label, rate]) => {
                  const start = Number(plan.amount) || 0;
                  const years = Math.min(40, Number(plan.years) || 0);
                  return <p key={label} className="module-card p-3">{label}<span className="mt-1 block text-lg">{fmtMoney(Math.round(start * (1 + rate) ** years))}</span><span className="text-[11px] text-white/40">in {years || 0} years</span></p>;
                })}
              </div>
              <button type="button" className="bg-blue mt-3" onClick={() => {
                const start = Number(plan.amount) || 0;
                const years = Number(plan.years) || 0;
                const facts = `Model only: ${fmtMoney(start)} for ${years} years, ${plan.risk} risk. Board net ${fmtMoney(net)}. FICO ${data.fico}. Unpaid ${unpaid.map((row) => row.name).join(", ") || "none"}.`;
                setInsight("Reading the model…");
                void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { name: "Books", prompt: "Suggest an allocation in percents that adds to 100. Use only the figures given. Say unknown when a holding is not on the board. Do not invent tickers or expected returns.", facts, question: "How should this amount be split?" } })).then((result) => setInsight(result.text || "No split came back."));
              }}>Split it</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Add({ name, onAdd }: { name: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form className="mt-4 flex gap-3" onSubmit={(event) => { event.preventDefault(); if (!value.trim()) return; onAdd(value.trim()); setValue(""); }}>
      <input className="h-8 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={value} placeholder={name} onChange={(event) => setValue(event.target.value)} />
      <button type="submit" className="quiet is-on">Add</button>
    </form>
  );
}
