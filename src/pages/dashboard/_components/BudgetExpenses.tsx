// PATCH (home-page2): back on the shared persistent store (was a private localStorage-only
// copy, which broke the Budget -> AI Money Tips link and Supabase sync). useHomeState also
// migrates bills saved under the legacy raw "budget_bills" localStorage key.
import { useState } from "react";
import { useHomeState } from "../_lib/useHomeState";
import { Plus, CheckCircle2, Circle, Trash2 } from "lucide-react";

type BillItem = {
  id: string;
  name: string;
  amount: string;
  due: string;
  paid: boolean;
  type: "static" | "new";
};

export default function BudgetExpenses() {
  const [bills, setBills] = useHomeState<BillItem[]>(
    "budget_bills",
    [],
  );
  const [form, setForm] = useState({ name: "", amount: "", due: "" });
  const [adding, setAdding] = useState(false);

  const add = () => {
    if (!form.name) return;
    setBills((b) => [
      ...b,
      { id: Date.now().toString(), ...form, paid: false, type: "new" },
    ]);
    setForm({ name: "", amount: "", due: "" });
    setAdding(false);
  };

  const toggle = (id: string) =>
    setBills((b) => b.map((x) => (x.id === id ? { ...x, paid: !x.paid } : x)));
  const del = (id: string) => setBills((b) => b.filter((x) => x.id !== id));

  const total = bills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const paid = bills
    .filter((b) => b.paid)
    .reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass rounded p-2 text-center border border-white/5">
          <div className="text-[9px] text-white/25 font-display">TOTAL</div>
          <div className="text-sm text-white/70 font-display">
            ${total.toFixed(2)}
          </div>
        </div>
        <div className="glass rounded p-2 text-center border border-white/5">
          <div className="text-[9px] text-white/25 font-display">PAID</div>
          <div className="text-sm text-emerald-400/70 font-display">
            ${paid.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Bills list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {bills.length === 0 && (
          <div className="text-[11px] text-white/15 text-center pt-4">
            No bills added yet
          </div>
        )}
        {bills.map((b) => (
          <div
            key={b.id}
            className={`flex items-center gap-2 p-2 rounded group transition-colors
            ${b.paid ? "opacity-50" : "hover:bg-white/3"}`}
          >
            <button onClick={() => toggle(b.id)}>
              {b.paid ? (
                <CheckCircle2 size={13} className="text-emerald-400/70" />
              ) : (
                <Circle size={13} className="text-white/20" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div
                className={`text-xs ${b.paid ? "line-through text-white/30" : "text-white/70"}`}
              >
                {b.name}
              </div>
              {b.due && (
                <div className="text-[9px] text-white/20">Due: {b.due}</div>
              )}
            </div>
            <div className="text-xs text-white/50">
              {b.amount ? `$${b.amount}` : "--"}
            </div>
            <button
              onClick={() => del(b.id)}
              className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-destructive"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding ? (
        <div className="space-y-1.5 border-t border-white/5 pt-2">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Bill name..."
            className="w-full h-6 px-2 text-[10px] bg-white/4 border border-white/6 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40"
          />
          <div className="flex gap-1.5">
            <input
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              placeholder="Amount"
              className="flex-1 h-6 px-2 text-[10px] bg-white/4 border border-white/6 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40"
            />
            <input
              value={form.due}
              onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
              placeholder="Due date"
              className="flex-1 h-6 px-2 text-[10px] bg-white/4 border border-white/6 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={add}
              className="flex-1 h-6 text-[10px] rounded glass-crimson text-primary font-display tracking-wider"
            >
              ADD
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex-1 h-6 text-[10px] rounded bg-white/4 text-white/30 font-display"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded border border-dashed border-white/10 text-[10px] text-white/20 hover:border-primary/30 hover:text-primary/50 transition-colors font-display tracking-wider"
        >
          <Plus size={10} /> ADD BILL
        </button>
      )}
    </div>
  );
}
