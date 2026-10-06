// Archived 2026-10-04. Removed from the sidebar. Not wired.
import { useState } from "react";
import { newId, type Memory } from "../src/components/dash/memory";

type Update = (recipe: (prev: Memory) => Memory) => void;

export function LegalDesk({ data, update }: { data: Memory; update: Update }) {
  const [form, setForm] = useState({ kind: "NDA", party: "", other: "", date: "", money: "" });
  const kinds = ["NDA", "Invoice terms", "Scope of work", "Service agreement", "Demand letter", "Privacy note"];
  const money = form.money || "$0.00";
  const body = form.kind === "NDA"
    ? `Mutual NDA dated ${form.date}. ${form.party} and ${form.other} will keep shared information private and use it only for the stated purpose.`
    : form.kind === "Invoice terms"
      ? `Invoice terms dated ${form.date}. ${form.party} will pay ${form.other} ${money} within 15 days. Late amounts accrue 1.5% per month.`
      : form.kind === "Service agreement"
        ? `Service agreement dated ${form.date}. ${form.party} will perform the services for ${form.other} for ${money}. Either side can end it with 14 days written notice.`
        : form.kind === "Demand letter"
          ? `Demand dated ${form.date}. ${form.party} asks ${form.other} to pay ${money} within 10 days. This is a draft, not a filing.`
          : form.kind === "Privacy note"
            ? `Privacy note dated ${form.date}. ${form.party} collects only what ${form.other} provides and does not sell it.`
            : `Scope of work dated ${form.date}. ${form.party} will deliver the described work to ${form.other} for ${money}. Changes require a written note.`;
  return (
    <section>
      <p>Drafts you write. Not legal advice.</p>
      {kinds.map((kind) => <button key={kind} type="button" onClick={() => setForm({ ...form, kind })}>{kind}</button>)}
      <p>{body}</p>
      <button type="button" onClick={() => update((prev) => ({ ...prev, legal: [{ id: newId(), title: `${form.kind} · ${form.date}`, body, at: new Date().toISOString() }, ...prev.legal] }))}>Save draft</button>
      <ul>{data.legal.map((row) => <li key={row.id}>{row.title}</li>)}</ul>
    </section>
  );
}
