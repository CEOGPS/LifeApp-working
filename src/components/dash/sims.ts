import { fmtMoney } from "./format";
import type { Memory } from "./memory";

export const SIMS = [
  "Alternate Life",
  "Dark Card",
  "Dream Forge",
  "Echo Persona",
  "Fantasy Friend",
  "Narrative Conflict",
  "Shadow Budget",
  "Life RPG",
  "Compliment Cannon",
  "Smart Browser",
  "Life Audit",
] as const;

export type SimName = (typeof SIMS)[number];

const CARDS = ["The Gate", "The Debt", "The Ally", "The Delay", "The Offer", "The Cut"];

function names(rows: { title?: string; name?: string }[]) {
  return rows.map((row) => row.title || row.name).filter(Boolean).slice(0, 6);
}

export function runSim(name: string, data: Memory): string {
  const tasks = data.tasks;
  const open = tasks.filter((row) => !row.done);
  const done = tasks.filter((row) => row.done);
  const unpaid = data.expenses.filter((row) => !row.paid);
  const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);

  if (name === "Alternate Life") {
    const choice = open[0]?.title || data.notes[0]?.title;
    if (!choice) return "No open task or note is saved, so there is no alternate path to run.";
    return `If you drop "${choice}" this week, the board keeps ${open.length - (open[0] ? 1 : 0)} open tasks and the unpaid list stays ${unpaid.map((row) => row.name).join(", ") || "clear"}.`;
  }
  if (name === "Dark Card") {
    const card = CARDS[new Date().getDate() % CARDS.length];
    const fact = data.leads[0]?.name || unpaid[0]?.name || open[0]?.title;
    return fact ? `${card}. The only board fact under it is ${fact}.` : `${card}. The board has no lead, bill, or task under it.`;
  }
  if (name === "Dream Forge") {
    const note = data.notes[0];
    return note ? `Scene from "${note.title}": ${note.body.slice(0, 280) || "The note has a title and no body."}` : "No note is saved to forge.";
  }
  if (name === "Echo Persona") {
    const lines = names(data.journal.length ? data.journal : data.notes);
    return lines.length ? `Echo only has these saved pages: ${lines.join(", ")}.` : "No journal or note is saved, so there is no persona to echo.";
  }
  if (name === "Fantasy Friend") {
    const person = data.contacts[0];
    return person ? `${person.name}${person.city ? ` in ${person.city}` : ""} is the only friend the board can name.` : "No contact is saved, so the friend stays unnamed.";
  }
  if (name === "Narrative Conflict") {
    const a = data.leads[0]?.name || open[0]?.title;
    const b = data.leads[1]?.name || open[1]?.title;
    if (!a || !b) return "Need two leads or two open tasks. The board does not have both.";
    return `${a} wants the next step. ${b} is the other claim. Nothing else was added.`;
  }
  if (name === "Shadow Budget") {
    return `Net ${fmtMoney(net)}. Unpaid: ${unpaid.map((row) => `${row.name} ${fmtMoney(row.amount)}`).join(", ") || "none"}.`;
  }
  if (name === "Life RPG") {
    return open.length || done.length
      ? `Open quests: ${names(open).join(", ") || "none"}. Cleared: ${names(done).join(", ") || "none"}.`
      : "No quests are saved.";
  }
  if (name === "Compliment Cannon") {
    const win = done[0]?.title || data.notes.find((row) => row.body.trim())?.title;
    return win ? `You already finished ${win}. That is the only compliment the board can support.` : "Nothing is marked done, so the cannon stays quiet.";
  }
  if (name === "Smart Browser") {
    return data.query ? `Saved search: ${data.query}.` : "No search is saved on OmniSearch.";
  }
  const empty = [
    ["notes", data.notes.length],
    ["tasks", data.tasks.length],
    ["contacts", data.contacts.length],
    ["mail", data.mail.length],
    ["events", data.events.length],
  ].filter((row) => row[1] === 0).map((row) => row[0]);
  return `Audit: ${data.tasks.length} tasks, ${data.contacts.length} contacts, ${data.mail.length} mail, net ${fmtMoney(net)}. Empty: ${empty.join(", ") || "none"}.`;
}

export function runCommand(line: string, data: Memory): string {
  const [head, ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(" ");
  const cmd = (head || "").toLowerCase();
  if (!cmd) return "";
  if (cmd === "help") return "help, board, notes, tasks, contacts, leads, money, events, sim <name>, clear";
  if (cmd === "board") return `${data.notes.length} notes, ${data.tasks.length} tasks, ${data.contacts.length} contacts, ${data.leads.length} leads, ${data.mail.length} mail.`;
  if (cmd === "notes") return names(data.notes).join("\n") || "No notes.";
  if (cmd === "tasks") return data.tasks.map((row) => `${row.done ? "done" : "open"}  ${row.title}`).join("\n") || "No tasks.";
  if (cmd === "contacts") return data.contacts.map((row) => `${row.name}${row.kind === "crm" ? "  crm" : ""}`).join("\n") || "No contacts.";
  if (cmd === "leads") return data.leads.map((row) => `${row.name}  ${row.status}`).join("\n") || "No leads.";
  if (cmd === "money") return runSim("Shadow Budget", data);
  if (cmd === "events") return data.events.map((row) => row.title).join("\n") || "No events.";
  if (cmd === "sim") return SIMS.includes(arg as SimName) ? runSim(arg, data) : `Unknown sim. Use: ${SIMS.join(", ")}`;
  if (cmd === "echo") return arg;
  if (cmd === "clear") return "__clear__";
  return `Unknown command "${cmd}". Type help.`;
}
