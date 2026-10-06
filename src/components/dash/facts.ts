import { fmtMoney } from "./format";
import type { Contact, Memory } from "./memory";

const CAP = 90_000;

function contactLine(row: Contact) {
  const name = row.name || `${row.firstName} ${row.lastName}`.trim();
  return [name, row.kind, row.phone || row.phones?.[0], row.email || row.emails?.[0], row.company, row.jobTitle, row.city, row.stage, row.deal].filter(Boolean).join(" | ");
}

export function boardFacts(data: Memory, question = "") {
  const accounts = data.accounts.map((row) => `${row.name} ${row.kind || ""} ${row.institution || ""} ${row.last4 ? `····${row.last4}` : ""} balance ${fmtMoney(row.balance)} prior ${fmtMoney(row.prior)}`.replace(/\s+/g, " ").trim());
  const bills = data.expenses.map((row) => `${row.name} ${row.category || ""} ${fmtMoney(row.amount)} ${row.paid ? "paid" : "due"} ${row.fixed ? "fixed" : "flexible"}`.replace(/\s+/g, " ").trim());
  const products = data.products.map((row) => `${row.name} cost ${fmtMoney(row.cost)} revenue ${fmtMoney(row.revenue)} profit ${fmtMoney(row.revenue - row.cost)}`);
  const invoices = data.notes.filter((row) => row.title.startsWith("Invoice ·")).map((row) => `${row.title}: ${row.body.replace(/\n/g, " ")}`);
  const head = [
    `Contacts on file: ${data.contacts.length}. Personal ${data.contacts.filter((row) => row.kind !== "crm").length}. CRM ${data.contacts.filter((row) => row.kind === "crm").length}.`,
    `Accounts:\n${accounts.join("\n") || "none"}`,
    `Bills:\n${bills.join("\n") || "none"}`,
    `Products:\n${products.join("\n") || "none"}`,
    `Invoices:\n${invoices.join("\n") || "none"}`,
    `FICO ${data.fico}. Vantage ${data.vantage}.`,
    `Open tasks: ${data.tasks.filter((row) => !row.done).map((row) => row.title).join(", ") || "none"}.`,
    `Leads: ${data.leads.map((row) => `${row.name} (${row.status})`).join(", ") || "none"}.`,
  ].join("\n");
  const tokens = question.toLowerCase().split(/\W+/).filter((token) => token.length > 2);
  const ranked = data.contacts
    .map((row) => {
      const line = contactLine(row);
      const hay = line.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      return { line, score };
    })
    .sort((a, b) => b.score - a.score);
  let body = `${head}\nContact book:\n`;
  let used = 0;
  for (const row of ranked) {
    if (body.length + row.line.length + 1 > CAP) break;
    body += `${row.line}\n`;
    used += 1;
  }
  if (used < data.contacts.length) body += `… ${data.contacts.length - used} more contacts are saved but did not fit. Ask with a name, phone, email, or company to pull them in.\n`;
  return body.slice(0, CAP);
}
