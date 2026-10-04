export interface FinanceAccount {
  id: string;
  name: string;
  balance: number;
  [key: string]: unknown;
}

export interface CreditScores {
  karma: number;
  experian: number;
  avg: number;
}

export interface BudgetCategory {
  id: string;
  name: string;
  amount: number;
  [key: string]: unknown;
}

export interface FinanceHubSnapshot {
  totalBalances: number;
  accounts: FinanceAccount[];
  credit: CreditScores;
  budget: { categories: BudgetCategory[] };
  updatedAt: string;
}

export interface SyncResult {
  success: boolean;
  [key: string]: unknown;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadFinanceHubSnapshot(): FinanceHubSnapshot {
  const accounts = read<Array<{ name: string; balance: string }>>("dashboard_accounts", []);
  const bills = read<Array<{ id: string; name: string; amount: string }>>("lifeos_unified_budget_bills", []);
  const credit = read<{ fico: number; vantage: number }>("lifeos_credit_scores", { fico: 0, vantage: 0 });
  const mapped = accounts.map((account, index) => ({
    id: String(index),
    name: account.name,
    balance: parseFloat(account.balance) || 0,
  }));
  return {
    totalBalances: mapped.reduce((sum, account) => sum + account.balance, 0),
    accounts: mapped,
    credit: {
      karma: credit.vantage || 0,
      experian: credit.fico || 0,
      avg: credit.fico && credit.vantage ? Math.round((credit.fico + credit.vantage) / 2) : credit.fico || credit.vantage || 0,
    },
    budget: {
      categories: bills.map((bill) => ({
        id: bill.id,
        name: bill.name,
        amount: parseFloat(bill.amount) || 0,
      })),
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function refreshFinanceKv(): Promise<FinanceHubSnapshot> {
  return loadFinanceHubSnapshot();
}

export async function syncFinanceAccounts(_accounts: FinanceAccount[]): Promise<SyncResult> {
  return { success: true };
}

export async function syncCreditScores(_scores: CreditScores): Promise<SyncResult> {
  return { success: true };
}

export default {
  loadFinanceHubSnapshot,
  refreshFinanceKv,
  syncFinanceAccounts,
  syncCreditScores,
};
