import { useEffect, useMemo, useState } from "react";

type Account = { name: string; sub: string; icon: string; balance: string };
type Bill = { id: string; name: string; amount: string; due: string; paid: boolean; type: "static" | "new" };
type Product = { id: string; name: string; revenue: number; cost: number };
type Invoice = { id: string; client: string; amount: string; status: "draft" | "sent" | "paid"; date: string };
type RepairItem = { id: string; label: string; done: boolean; note: string };
type Quote = { symbol: string; price: number; change: number; kind: "crypto" | "stock" };

const ACCOUNTS_KEY = "dashboard_accounts";
const BILLS_KEY = "lifeos_unified_budget_bills";
const ROI_KEY = "lifeos_unified_roi_products";
const CREDIT_KEY = "lifeos_credit_scores";
const TIPS_KEY = "lifeos_unified_dashboard_money_tips";
const INVOICES_KEY = "lifeos_finance_invoices";
const REPAIR_KEY = "lifeos_credit_repair";

const DEFAULT_ACCOUNTS: Account[] = [
  { name: "Banking", sub: "Primary", icon: "🏦", balance: "0.00" },
  { name: "Stripe", sub: "Revenue", icon: "💳", balance: "0.00" },
  { name: "Credit Cards", sub: "Cards", icon: "💎", balance: "0.00" },
  { name: "Cash App", sub: "P2P", icon: "💸", balance: "0.00" },
  { name: "Venmo", sub: "P2P", icon: "🔵", balance: "0.00" },
  { name: "OnePay", sub: "Alt Pay", icon: "🟡", balance: "0.00" },
  { name: "Credit Karma", sub: "Credit", icon: "📊", balance: "0.00" },
];

const DEFAULT_REPAIR: RepairItem[] = [
  { id: "util", label: "Bring credit-card utilization under 30%", done: false, note: "" },
  { id: "late", label: "Stop new late payments", done: false, note: "" },
  { id: "dispute", label: "Dispute inaccurate collections", done: false, note: "" },
  { id: "limit", label: "Ask for a limit increase on a clean card", done: false, note: "" },
];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function level(score: number) {
  if (score >= 740) return "Great";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Poor";
}

export default function FinancePage() {
  const [accounts, setAccounts] = useState<Account[]>(() => read(ACCOUNTS_KEY, DEFAULT_ACCOUNTS));
  const [bills, setBills] = useState<Bill[]>(() => read(BILLS_KEY, []));
  const [products, setProducts] = useState<Product[]>(() => read(ROI_KEY, []));
  const [credit, setCredit] = useState(() => read(CREDIT_KEY, { fico: 0, vantage: 0 }));
  const [invoices, setInvoices] = useState<Invoice[]>(() => read(INVOICES_KEY, []));
  const [repair, setRepair] = useState<RepairItem[]>(() => read(REPAIR_KEY, DEFAULT_REPAIR));
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteNote, setQuoteNote] = useState("Loading live quotes…");
  const [billForm, setBillForm] = useState({ name: "", amount: "", due: "" });
  const [productForm, setProductForm] = useState({ name: "", revenue: "", cost: "" });
  const [invoiceForm, setInvoiceForm] = useState({ client: "", amount: "", date: "" });

  useEffect(() => write(ACCOUNTS_KEY, accounts), [accounts]);
  useEffect(() => {
    write(BILLS_KEY, bills);
    write("budget_bills", bills);
  }, [bills]);
  useEffect(() => write(ROI_KEY, products), [products]);
  useEffect(() => write(CREDIT_KEY, credit), [credit]);
  useEffect(() => write(INVOICES_KEY, invoices), [invoices]);
  useEffect(() => write(REPAIR_KEY, repair), [repair]);

  const tips = useMemo(() => {
    const total = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const unpaid = bills.filter((b) => !b.paid);
    const unpaidSum = unpaid.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    const revenue = products.reduce((s, p) => s + p.revenue, 0);
    const cost = products.reduce((s, p) => s + p.cost, 0);
    const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
    const next: string[] = [];
    if (unpaidSum > 0) next.push(`Pay ${unpaid.length} open bill${unpaid.length === 1 ? "" : "s"} totaling ${money(unpaidSum)} before adding new spend.`);
    else next.push("No unpaid bills are on the list. Keep the next due date filled in so nothing slips.");
    if (roi < 0) next.push("Product cost is higher than revenue. Raise price or cut the cost line on the weakest product.");
    else if (cost > 0) next.push(`Product ROI is ${roi.toFixed(1)}%. Put the next dollar into the product with the widest gap.`);
    else next.push("Add product revenue and cost so ROI can tell you what is actually making money.");
    if (credit.fico && credit.fico < 670) next.push(`FICO is ${credit.fico} (${level(credit.fico)}). Utilization and on-time payments move this faster than new accounts.`);
    else next.push(credit.fico ? `FICO ${credit.fico} is ${level(credit.fico)}. Do not open new credit you do not need.` : "Enter FICO and VantageScore so the dashboard meters match your reports.");
    if (total <= 0) next.push("Balances are still zero. Type the real amounts and the home cards will show them.");
    return next.slice(0, 4);
  }, [accounts, bills, products, credit]);

  useEffect(() => {
    write(TIPS_KEY, tips);
    write("lifeos_unified_dashboard_money_tips_meta", { ts: Date.now(), via: "finance page" });
  }, [tips]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const next: Quote[] = [];
      let note = "";
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,dogecoin&vs_currencies=usd&include_24hr_change=true",
        );
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, string> = {
            bitcoin: "BTC",
            ethereum: "ETH",
            solana: "SOL",
            ripple: "XRP",
            dogecoin: "DOGE",
          };
          for (const [id, symbol] of Object.entries(map)) {
            const row = data[id];
            if (!row) continue;
            next.push({ symbol, price: Number(row.usd) || 0, change: Number(row.usd_24h_change) || 0, kind: "crypto" });
          }
        }
      } catch {
        note = "Crypto quotes did not load. ";
      }
      try {
        const symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"];
        const res = await fetch(
          `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}`,
        );
        if (res.ok) {
          const data = await res.json();
          for (const row of data?.quoteResponse?.result || []) {
            next.push({
              symbol: row.symbol,
              price: Number(row.regularMarketPrice) || 0,
              change: Number(row.regularMarketChangePercent) || 0,
              kind: "stock",
            });
          }
        } else note += "Stock quotes were blocked by the browser.";
      } catch {
        note += "Stock quotes were blocked by the browser.";
      }
      if (!stop) {
        if (next.length) setQuotes(next);
        setQuoteNote(note || "Live crypto. Stocks show when Yahoo allows the browser request.");
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  const total = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  const billTotal = bills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const billPaid = bills.filter((b) => b.paid).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const revenue = products.reduce((s, p) => s + p.revenue, 0);
  const cost = products.reduce((s, p) => s + p.cost, 0);
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
  const openInvoices = invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const tape = quotes.length ? [...quotes, ...quotes] : [];

  return (
    <main className="min-h-full space-y-4 bg-black p-4 text-sky-50">
      <header>
        <h1 className="text-2xl font-semibold text-white">Finance</h1>
        <p className="text-sm text-sky-200/60">Balances, bills, ROI, invoices, and credit save here and show on the dashboard. Crypto and stocks stay on this page.</p>
      </header>

      <section className="overflow-hidden rounded-lg border border-sky-500/30 bg-sky-500/5">
        <div className="flex w-max gap-8 px-4 py-3 text-sm" style={{ animation: tape.length ? "lifeos-ticker 40s linear infinite" : undefined }}>
          {tape.map((q, i) => (
            <span key={`${q.symbol}-${i}`} className="whitespace-nowrap">
              <span className="text-sky-300">{q.kind === "crypto" ? "CRYPTO" : "STOCK"}</span>{" "}
              {q.symbol} {money(q.price)}{" "}
              <span className={q.change >= 0 ? "text-emerald-400" : "text-red-400"}>
                {q.change >= 0 ? "+" : ""}
                {q.change.toFixed(2)}%
              </span>
            </span>
          ))}
          {!tape.length && <span className="text-sky-200/50">Waiting for quotes…</span>}
        </div>
        <p className="px-4 pb-2 text-xs text-sky-200/40">{quoteNote}</p>
        <style>{`@keyframes lifeos-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </section>

      <section className="rounded-lg border border-sky-500/25 p-4">
        <h2 className="text-lg text-white">Balances</h2>
        <p className="mb-3 text-2xl text-white">{money(total)}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, index) => (
            <label key={account.name} className="rounded border border-sky-500/20 bg-sky-500/5 p-3 text-sm">
              <span className="mb-2 block text-sky-100">{account.icon} {account.name}</span>
              <input
                value={account.balance}
                onChange={(e) => setAccounts((rows) => rows.map((row, i) => i === index ? { ...row, balance: e.target.value } : row))}
                className="w-full rounded border border-sky-500/30 bg-black px-2 py-2 text-base text-white"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-sky-500/25 p-4">
        <h2 className="text-lg text-white">Budget and payments</h2>
        <p className="mb-3 text-sm text-sky-200/70">Total {money(billTotal)} · Paid {money(billPaid)}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={billForm.name} onChange={(e) => setBillForm({ ...billForm, name: e.target.value })} placeholder="Bill" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <input value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} placeholder="Amount" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <input value={billForm.due} onChange={(e) => setBillForm({ ...billForm, due: e.target.value })} placeholder="Due date" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <button
            type="button"
            className="rounded bg-sky-600 px-3 py-2 text-sm text-white"
            onClick={() => {
              if (!billForm.name.trim()) return;
              setBills((rows) => [...rows, { id: crypto.randomUUID(), name: billForm.name.trim(), amount: billForm.amount, due: billForm.due, paid: false, type: "new" }]);
              setBillForm({ name: "", amount: "", due: "" });
            }}
          >
            Add payment
          </button>
        </div>
        {bills.map((bill) => (
          <div key={bill.id} className="mb-2 flex items-center gap-3 text-sm">
            <button type="button" className={bill.paid ? "text-emerald-400" : "text-sky-200"} onClick={() => setBills((rows) => rows.map((row) => row.id === bill.id ? { ...row, paid: !row.paid } : row))}>
              {bill.paid ? "Paid" : "Unpaid"}
            </button>
            <span className="flex-1">{bill.name} {bill.due ? `· due ${bill.due}` : ""}</span>
            <span>{money(parseFloat(bill.amount) || 0)}</span>
            <button type="button" className="text-red-300" onClick={() => setBills((rows) => rows.filter((row) => row.id !== bill.id))}>Delete</button>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-sky-500/25 p-4">
        <h2 className="text-lg text-white">Product ROI</h2>
        <p className="mb-3 text-sm text-sky-200/70">Revenue {money(revenue)} · Cost {money(cost)} · ROI {roi.toFixed(1)}%</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <input value={productForm.revenue} onChange={(e) => setProductForm({ ...productForm, revenue: e.target.value })} placeholder="Revenue" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <input value={productForm.cost} onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })} placeholder="Cost" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <button
            type="button"
            className="rounded bg-sky-600 px-3 py-2 text-sm text-white"
            onClick={() => {
              if (!productForm.name.trim()) return;
              setProducts((rows) => [...rows, { id: crypto.randomUUID(), name: productForm.name.trim(), revenue: parseFloat(productForm.revenue) || 0, cost: parseFloat(productForm.cost) || 0 }]);
              setProductForm({ name: "", revenue: "", cost: "" });
            }}
          >
            Add product
          </button>
        </div>
        {products.map((product) => {
          const rowRoi = product.cost > 0 ? ((product.revenue - product.cost) / product.cost) * 100 : 0;
          return (
            <div key={product.id} className="mb-2 flex items-center gap-3 text-sm">
              <span className="flex-1">{product.name}</span>
              <span>{money(product.revenue)} / {money(product.cost)}</span>
              <span>{rowRoi.toFixed(1)}%</span>
              <button type="button" className="text-red-300" onClick={() => setProducts((rows) => rows.filter((row) => row.id !== product.id))}>Delete</button>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-sky-500/25 p-4">
        <h2 className="text-lg text-white">Invoices</h2>
        <p className="mb-3 text-sm text-sky-200/70">Open {money(openInvoices)}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={invoiceForm.client} onChange={(e) => setInvoiceForm({ ...invoiceForm, client: e.target.value })} placeholder="Client" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <input value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} placeholder="Amount" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <input value={invoiceForm.date} onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })} placeholder="Date" className="rounded border border-sky-500/30 bg-black px-2 py-2 text-sm" />
          <button
            type="button"
            className="rounded bg-sky-600 px-3 py-2 text-sm text-white"
            onClick={() => {
              if (!invoiceForm.client.trim()) return;
              setInvoices((rows) => [...rows, { id: crypto.randomUUID(), client: invoiceForm.client.trim(), amount: invoiceForm.amount, status: "draft", date: invoiceForm.date }]);
              setInvoiceForm({ client: "", amount: "", date: "" });
            }}
          >
            Add invoice
          </button>
        </div>
        {invoices.map((invoice) => (
          <div key={invoice.id} className="mb-2 flex items-center gap-3 text-sm">
            <span className="flex-1">{invoice.client} {invoice.date ? `· ${invoice.date}` : ""}</span>
            <span>{money(parseFloat(invoice.amount) || 0)}</span>
            <select
              value={invoice.status}
              onChange={(e) => setInvoices((rows) => rows.map((row) => row.id === invoice.id ? { ...row, status: e.target.value as Invoice["status"] } : row))}
              className="rounded border border-sky-500/30 bg-black px-2 py-1"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
            </select>
            <button type="button" className="text-red-300" onClick={() => setInvoices((rows) => rows.filter((row) => row.id !== invoice.id))}>Delete</button>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-sky-500/25 p-4">
          <h2 className="mb-3 text-lg text-white">Credit</h2>
          <label className="mb-3 block text-sm">
            FICO · {credit.fico ? `${credit.fico} ${level(credit.fico)}` : "not set"}
            <input type="number" value={credit.fico || ""} onChange={(e) => setCredit({ ...credit, fico: Number(e.target.value) || 0 })} className="mt-1 w-full rounded border border-sky-500/30 bg-black px-2 py-2 text-base" />
          </label>
          <label className="block text-sm">
            VantageScore · {credit.vantage ? `${credit.vantage} ${level(credit.vantage)}` : "not set"}
            <input type="number" value={credit.vantage || ""} onChange={(e) => setCredit({ ...credit, vantage: Number(e.target.value) || 0 })} className="mt-1 w-full rounded border border-sky-500/30 bg-black px-2 py-2 text-base" />
          </label>
        </div>
        <div className="rounded-lg border border-sky-500/25 p-4">
          <h2 className="mb-3 text-lg text-white">Credit repair</h2>
          {repair.map((item) => (
            <label key={item.id} className="mb-3 block text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={item.done} onChange={(e) => setRepair((rows) => rows.map((row) => row.id === item.id ? { ...row, done: e.target.checked } : row))} />
                {item.label}
              </span>
              <input
                value={item.note}
                onChange={(e) => setRepair((rows) => rows.map((row) => row.id === item.id ? { ...row, note: e.target.value } : row))}
                placeholder="Note"
                className="mt-1 w-full rounded border border-sky-500/30 bg-black px-2 py-2"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-sky-500/25 p-4">
        <h2 className="mb-2 text-lg text-white">AI financial tips</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-sky-100">
          {tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </section>
    </main>
  );
}
