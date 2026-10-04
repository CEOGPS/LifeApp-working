import { useState } from "react";
import { BarChart3, Package, Plus, Trash2, DollarSign, Minus } from "lucide-react";
// PATCH: useHomeState = shared persistent store (localStorage lifeos_unified_* + Supabase app_settings)
import { useHomeState } from "../_lib/useHomeState";

type Product = {
  id: string;
  name: string;
  revenue: number;
  cost: number;
};

const DEFAULT_PRODUCTS: Product[] = [
  { id: "1", name: "Product A", revenue: 0, cost: 0 },
  { id: "2", name: "Product B", revenue: 0, cost: 0 },
  { id: "3", name: "Product C", revenue: 0, cost: 0 },
];

export default function RoiAnalysis() {
  const [products, setProducts] = useHomeState<Product[]>("roi_products", DEFAULT_PRODUCTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRevenue, setNewRevenue] = useState("");
  const [newCost, setNewCost] = useState("");

  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const totalCost = products.reduce((sum, p) => sum + p.cost, 0);
  const totalROI = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

  const addProduct = async () => {
    if (!newName.trim()) return;
    const newProduct: Product = {
      id: Date.now().toString(),
      name: newName.trim(),
      revenue: parseFloat(newRevenue) || 0,
      cost: parseFloat(newCost) || 0,
    };
    await setProducts((prev) => [...prev, newProduct]);
    setShowAddForm(false);
    setNewName("");
    setNewRevenue("");
    setNewCost("");
  };

  const deleteProduct = async (id: string) => {
    await setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const updateProduct = async (id: string, field: "revenue" | "cost", value: number) => {
    await setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-lg p-2.5 text-center border border-white/5">
          <div className="text-[9px] text-white/25 font-display tracking-wider mb-1">Revenue</div>
          <div className="text-sm text-emerald-400 font-display">${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="glass rounded-lg p-2.5 text-center border border-white/5">
          <div className="text-[9px] text-white/25 font-display tracking-wider mb-1">Cost</div>
          <div className="text-sm text-red-400 font-display">${totalCost.toLocaleString()}</div>
        </div>
        <div className="glass rounded-lg p-2.5 text-center border border-white/5">
          <div className="text-[9px] text-white/25 font-display tracking-wider mb-1">ROI</div>
          <div className="text-sm font-display" style={{ color: totalROI >= 0 ? "#22c55e" : "#ef4444" }}>
            {totalROI >= 0 ? "+" : ""}{totalROI.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 rounded-lg bg-white/2 border border-white/5 flex flex-col items-center justify-center gap-2 min-h-[80px]">
        {totalRevenue > 0 || totalCost > 0 ? (
                  <div className="w-full h-full flex items-end justify-around gap-1 p-4">
                    {products.map((p) => {
                      const revPct = totalRevenue > 0 ? ((p.revenue / Math.max(totalRevenue, 1)) * 100) : 0;
                      const costPct = totalCost > 0 ? ((p.cost / Math.max(totalCost, 1)) * 100) : 0;
                      return (
                        <div key={p.id} className="flex flex-col items-center gap-1 flex-1">
                          <div className="w-full flex-1 flex items-end">
                            <div
                              className="w-full bg-emerald-400/50 rounded-t"
                              style={{
                                height: `${revPct}%`,
                                minHeight: p.revenue > 0 ? "4px" : "0",
                              }}
                            />
                          </div>
                          <div className="w-full flex-1 flex items-end mt-1">
                            <div
                              className="w-full bg-red-400/50 rounded-t"
                              style={{
                                height: `${costPct}%`,
                                minHeight: p.cost > 0 ? "4px" : "0",
                              }}
                            />
                          </div>
                          <span className="text-[8px] text-white/40 text-center truncate w-full">{p.name}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
          <>
            <BarChart3 size={22} className="text-white/10" />
            <div className="text-[10px] text-white/20 text-center">Add products to generate ROI charts</div>
          </>
        )}
      </div>

      {/* Products list with add/edit/delete */}
      <div className="border-t border-white/5 pt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Package size={11} className="text-white/25" />
            <span className="text-[10px] text-white/30">Products</span>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-white/8 text-white/25 hover:border-primary/30 hover:text-primary/50 transition-colors"
          >
            <Plus size={10} /> Add
          </button>
        </div>

        {/* Add product form */}
        {showAddForm && (
          <div className="flex flex-col gap-1.5 mb-2 p-2 bg-white/3 rounded border border-white/5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Product name"
              className="w-full px-2 py-1.5 text-[11px] bg-white/4 border border-white/6 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="number"
                value={newRevenue}
                onChange={(e) => setNewRevenue(e.target.value)}
                placeholder="Revenue $"
                className="w-full px-2 py-1.5 text-[11px] bg-white/4 border border-white/6 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40"
                step="0.01"
                min="0"
              />
              <input
                type="number"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="Cost $"
                className="w-full px-2 py-1.5 text-[11px] bg-white/4 border border-white/6 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40"
                step="0.01"
                min="0"
              />
            </div>
            <div className="flex justify-end gap-1">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewName("");
                  setNewRevenue("");
                  setNewCost("");
                }}
                className="px-3 py-1 text-[10px] border border-white/8 text-white/25 hover:border-primary/30 hover:text-primary/50 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addProduct}
                className="px-3 py-1 text-[10px] glass-crimson text-primary rounded transition-colors"
              >
                Add Product
              </button>
            </div>
          </div>
        )}

        {/* Product list */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-2 bg-white/2 rounded p-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-white/70 truncate">{p.name}</div>
                <div className="flex gap-2 text-[9px]">
                  <span className="text-emerald-400">Rev: ${p.revenue.toLocaleString()}</span>
                  <span className="text-red-400">Cost: ${p.cost.toLocaleString()}</span>
                  <span style={{ color: p.revenue - p.cost >= 0 ? "#22c55e" : "#ef4444" }}>
                    ROI: {p.cost > 0 ? `${(((p.revenue - p.cost) / p.cost) * 100).toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const newRevenue = prompt(`Revenue for ${p.name}:`, p.revenue.toString());
                    if (newRevenue !== null) updateProduct(p.id, "revenue", parseFloat(newRevenue) || 0);
                  }}
                  className="p-1 text-[10px] text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
                  title="Edit Revenue"
                >
                  <DollarSign size={10} />
                </button>
                <button
                  onClick={() => {
                    const newCost = prompt(`Cost for ${p.name}:`, p.cost.toString());
                    if (newCost !== null) updateProduct(p.id, "cost", parseFloat(newCost) || 0);
                  }}
                  className="p-1 text-[10px] text-red-400 hover:bg-red-400/10 rounded transition-colors"
                  title="Edit Cost"
                >
                  <Minus size={10} />
                </button>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="p-1 text-[10px] text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                  title="Delete Product"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="text-center text-[10px] text-white/20 py-4">No products added yet</div>
          )}
        </div>
      </div>
    </div>
  );
}