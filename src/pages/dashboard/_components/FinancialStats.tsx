import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  BarChart3,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";

const lifeosApi = {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  },
};

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initialValue : (JSON.parse(stored) as T);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore unavailable or restricted browser storage.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

interface FinanceResponse {
  accounts?: Account[];
  [key: string]: unknown;
}

type Account = {
  name: string;
  sub: string;
  icon: string;
  balance: string;
};

const ACCOUNT_LIST: Account[] = [
  { name: "Banking", sub: "Primary", icon: "🏦", balance: "0.00" },
  { name: "Stripe", sub: "Revenue", icon: "💳", balance: "0.00" },
  { name: "Cash App", sub: "P2P", icon: "💸", balance: "0.00" },
  { name: "Venmo", sub: "P2P", icon: "🔵", balance: "0.00" },
  { name: "OnePay", sub: "Alt Pay", icon: "🟡", balance: "0.00" },
  { name: "Credit Karma", sub: "Credit", icon: "📊", balance: "0.00" },
];

export default function FinancialStats() {
  const [accounts, setAccounts] = usePersistentState<Account[]>(
    "dashboard_accounts",
    ACCOUNT_LIST,
  );
  const [loading, setLoading] = useState(false);

  const totalBalance = accounts.reduce((sum, acc) => {
    const val = parseFloat(acc.balance.replace(/[,$]/g, ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  const syncData = async () => {
    setLoading(true);
    try {
      const response = await lifeosApi.get<FinanceResponse>("/api/finance/balances");
      if (response && Array.isArray(response.accounts)) {
        setAccounts(response.accounts);
      }
    } catch (e) {
      console.warn("[FinancialStats] Sync failed: no data available from backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="glass-crimson rounded-lg p-3 text-center relative group">
        <button
          onClick={syncData}
          disabled={loading}
          className="absolute top-2 right-2 text-white/20 hover:text-primary transition-colors"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
        </button>
        <div className="text-[10px] text-white/30 font-display tracking-widest mb-1">
          TOTAL BALANCE
        </div>
        <div className="text-2xl text-white/80 font-display">
          {formatCurrency(totalBalance)}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1">
          <TrendingUp size={11} className="text-emerald-400/60" />
          <span className="text-[10px] text-white/25">
            {loading ? "Syncing..." : "Connect accounts for live data"}
          </span>
        </div>
      </div>

      <div className="h-16 rounded-lg bg-white/2 border border-white/5 flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/15">
          <BarChart3 size={14} />
          <span className="text-[10px]">
            Growth chart loads after account sync
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 overflow-y-auto">
        {accounts.map((acc) => (
          <div
            key={acc.name}
            className="glass rounded p-2 text-center border border-white/5 hover:border-primary/20 transition-colors cursor-pointer group"
          >
            <div className="text-base mb-1">{acc.icon}</div>
            <div className="text-[10px] text-white/60 font-medium leading-none">
              {acc.name}
            </div>
            <div className="text-[9px] text-white/20 mt-0.5">{acc.sub}</div>
            <div className="text-[10px] text-white/30 mt-1">
              ${acc.balance}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
