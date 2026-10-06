import { useMemo, useState } from "react";
import { newId, type Memory } from "./memory";
import { WordPage } from "./office-desk";

type Update = (recipe: (prev: Memory) => Memory) => void;

const TEMPLATES: { name: string; body: string }[] = [
  { name: "Blank", body: "" },
  { name: "Daily log", body: "<h1>Daily log</h1><p><b>Did</b></p><p><br></p><p><b>Next</b></p><p><br></p>" },
  { name: "Morning pages", body: "<h1>Morning pages</h1><p>What is on my mind</p><p><br></p>" },
  { name: "Meeting", body: "<h1>Meeting</h1><p><b>Who</b></p><p><br></p><p><b>Decided</b></p><p><br></p><p><b>My action</b></p><p><br></p>" },
  { name: "Weekly review", body: "<h1>Weekly review</h1><p><b>Went well</b></p><p><br></p><p><b>Stuck</b></p><p><br></p><p><b>Next week</b></p><p><br></p>" },
  { name: "To-do", body: "<h1>To-do</h1><ul><li></li><li></li><li></li></ul>" },
];

function parts(title: string) {
  const cut = title.indexOf(" · ");
  const head = cut > 0 ? title.slice(0, cut) : title || "Inbox";
  const name = cut > 0 ? title.slice(cut + 3) : "Untitled";
  const slash = head.indexOf(" / ");
  if (slash > 0) return { book: head.slice(0, slash), section: head.slice(slash + 3) || "General", name };
  return { book: head || "Inbox", section: "General", name };
}

function plain(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function JournalDesk({ data, update }: { data: Memory; update: Update }) {
  const parsed = useMemo(() => data.journal.map((row) => ({ ...row, ...parts(row.title) })), [data.journal]);
  const books = useMemo(() => ["Inbox", ...new Set(parsed.map((row) => row.book).filter((name) => name !== "Inbox"))], [parsed]);
  const [book, setBook] = useState("Inbox");
  const [section, setSection] = useState("General");
  const [notebook, setNotebook] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [q, setQ] = useState("");
  const [body, setBody] = useState("");
  const [pageName, setPageName] = useState("Untitled");
  const [pageId, setPageId] = useState<string | null>(null);
  const sections = useMemo(() => {
    const found = [...new Set(parsed.filter((row) => row.book === book).map((row) => row.section))];
    return found.length ? found : ["General"];
  }, [parsed, book]);
  const pages = parsed.filter((row) => row.book === book && row.section === section && (!q.trim() || `${row.name} ${plain(row.body)}`.toLowerCase().includes(q.trim().toLowerCase())));

  function write(nextBook: string, nextSection: string, name: string, html: string) {
    const id = newId();
    const title = `${nextBook} / ${nextSection} · ${name}`.slice(0, 120);
    update((prev) => ({ ...prev, journal: [{ id, title, body: html, at: new Date().toISOString() }, ...prev.journal] }));
    setBook(nextBook);
    setSection(nextSection);
    setPageId(id);
    setPageName(name);
    setBody(html);
  }

  function makeNotebook(name: string) {
    const stamp = new Date().toISOString();
    const rows = ["Notes", "Meetings", "Ideas"].map((sectionName) => ({
      id: newId(),
      title: `${name} / ${sectionName} · Untitled`.slice(0, 120),
      body: "",
      at: stamp,
    }));
    update((prev) => ({ ...prev, journal: [...rows, ...prev.journal] }));
    setBook(name);
    setSection("Notes");
    setPageId(rows[0].id);
    setPageName("Untitled");
    setBody("");
  }

  function openBook(name: string) {
    const first = parsed.find((row) => row.book === name);
    setBook(name);
    setSection(first?.section || "General");
    if (first) openPage(first);
    else write(name, "General", "Untitled", "");
  }
  function openPage(row: { id: string; name: string; body: string }) {
    setPageId(row.id);
    setPageName(row.name);
    setBody(row.body);
  }

  function pagesOf(name: string) {
    return parsed.find((row) => row.book === book && row.section === name);
  }

  function fresh(nextBook = book, nextSection = section, template = "") {
    setBook(nextBook);
    setSection(nextSection);
    setPageId(null);
    setPageName("Untitled");
    setBody(template);
  }

  function save() {
    const title = `${book} / ${section} · ${pageName.trim() || "Untitled"}`.slice(0, 120);
    if (pageId) {
      update((prev) => ({ ...prev, journal: prev.journal.map((row) => row.id === pageId ? { ...row, title, body } : row) }));
      return;
    }
    const id = newId();
    update((prev) => ({ ...prev, journal: [{ id, title, body, at: new Date().toISOString() }, ...prev.journal] }));
    setPageId(id);
  }

  return (
    <div className="grid min-h-[40rem] gap-3 lg:grid-cols-[11rem_1fr_14rem]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Notebooks</p>
        <div className="mt-3">
          {books.map((name) => (
            <button key={name} type="button" className={`menu ${book === name ? "is-on" : ""}`} onClick={() => openBook(name)}>{name}</button>
          ))}
        </div>
        <form className="mt-3" onSubmit={(event) => { event.preventDefault(); const name = notebook.trim(); if (!name || books.includes(name)) return; setNotebook(""); makeNotebook(name); }}>
          <input className="h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="New notebook" value={notebook} onChange={(event) => setNotebook(event.target.value)} />
        </form>
      </aside>
      <section className="module-card p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 pb-2">
          {sections.map((name) => (
            <button key={name} type="button" className={`text-sm ${section === name ? "text-emerald-200" : "text-white/45"}`} onClick={() => { const first = pagesOf(name); setSection(name); if (first) openPage(first); else write(book, name, "Untitled", ""); }}>{name}</button>
          ))}
          <form onSubmit={(event) => { event.preventDefault(); const name = sectionName.trim(); if (!name || sections.includes(name)) return; setSectionName(""); write(book, name, "Untitled", ""); }}>
            <input className="h-7 w-32 rounded-full border border-line bg-black/40 px-3 text-xs" placeholder="New section" value={sectionName} onChange={(event) => setSectionName(event.target.value)} />
          </form>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input className="h-8 min-w-40 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" aria-label="Page title" value={pageName} onChange={(event) => setPageName(event.target.value)} />
          <button type="button" className="quiet is-on" onClick={save}>{pageId ? "Update" : "Save"}</button>
          {pageId ? <button type="button" className="link-remove" onClick={() => { if (!window.confirm("Remove this page?")) return; update((prev) => ({ ...prev, journal: prev.journal.filter((row) => row.id !== pageId) })); fresh(); }}>Remove</button> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {TEMPLATES.map((template) => (
            <button key={template.name} type="button" className="link-add" onClick={() => { if (body.trim() && !window.confirm("Replace this page with the template?")) return; setBody(template.body); }}>{template.name}</button>
          ))}
        </div>
        <WordPage value={body} onChange={setBody} />
      </section>
      <aside className="module-card h-fit max-h-[40rem] overflow-y-auto p-3">
        <p className="text-sm">Pages</p>
        <input className="mt-2 mb-2 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Find a page" value={q} onChange={(event) => setQ(event.target.value)} />
        <button type="button" className="link-add" onClick={() => write(book, section, "Untitled", "")}>New page</button>
        {pages.map((row) => (
          <button key={row.id} type="button" className={`menu ${pageId === row.id ? "is-on" : ""}`} onClick={() => openPage(row)}>
            <span className="block truncate">{row.name}</span>
            <span className="block truncate text-[11px] text-white/35">{plain(row.body).slice(0, 70) || "Empty page"}</span>
          </button>
        ))}
        {!pages.length ? <p className="mt-2 text-[11px] text-white/35">No pages in this section.</p> : null}
      </aside>
    </div>
  );
}
