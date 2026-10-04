import { useEffect, useMemo, useState } from "react";

type Note = {
  id: string;
  folderId: string;
  title: string;
  content: string;
  updatedAt: string;
};

type Folder = { id: string; name: string };

const KEY = "lifeos_notes_page";

function load(): { folders: Folder[]; notes: Note[] } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { folders: [{ id: "inbox", name: "Inbox" }], notes: [] };
    const parsed = JSON.parse(raw);
    const folders = Array.isArray(parsed.folders) && parsed.folders.length
      ? parsed.folders
      : [{ id: "inbox", name: "Inbox" }];
    const notes = Array.isArray(parsed.notes) ? parsed.notes : [];
    return { folders, notes };
  } catch {
    return { folders: [{ id: "inbox", name: "Inbox" }], notes: [] };
  }
}

export default function NotesPage() {
  const initial = load();
  const [folders, setFolders] = useState<Folder[]>(initial.folders);
  const [notes, setNotes] = useState<Note[]>(initial.notes);
  const [folderId, setFolderId] = useState(initial.folders[0]?.id || "inbox");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ folders, notes }));
  }, [folders, notes]);

  const visible = useMemo(
    () => notes.filter((n) => n.folderId === folderId),
    [notes, folderId],
  );

  const open = (n: Note) => {
    setActiveId(n.id);
    setTitle(n.title);
    setContent(n.content);
  };

  const createNote = () => {
    const note: Note = {
      id: crypto.randomUUID(),
      folderId,
      title: "Untitled",
      content: "",
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    open(note);
  };

  const save = () => {
    if (!activeId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId
          ? { ...n, title: title.trim() || "Untitled", content, updatedAt: new Date().toISOString() }
          : n,
      ),
    );
  };

  const removeNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setTitle("");
      setContent("");
    }
  };

  const addFolder = () => {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    const folder = { id: crypto.randomUUID(), name: name.trim() };
    setFolders((prev) => [...prev, folder]);
    setFolderId(folder.id);
  };

  return (
    <main className="flex h-full min-h-[70vh] gap-4 p-4 text-sky-50">
      <aside className="flex w-52 shrink-0 flex-col gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-sky-200">Folders</h2>
          <button type="button" className="text-sm text-sky-300" onClick={addFolder}>
            + Folder
          </button>
        </div>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFolderId(f.id)}
            className={`rounded px-2 py-2 text-left text-base ${
              folderId === f.id ? "bg-sky-600 text-white" : "text-sky-100/80 hover:bg-sky-500/10"
            }`}
          >
            {f.name}
          </button>
        ))}
      </aside>

      <section className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-sky-500/25 bg-black/40 p-3">
        <button
          type="button"
          onClick={createNote}
          className="rounded bg-sky-600 px-3 py-2 text-base text-white"
        >
          New note
        </button>
        {visible.length === 0 && <p className="text-base text-sky-200/50">No notes in this folder.</p>}
        {visible.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-2 rounded px-2 py-2 ${
              activeId === n.id ? "bg-sky-500/20" : "hover:bg-sky-500/10"
            }`}
          >
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
              <div className="truncate text-base text-white">{n.title || "Untitled"}</div>
            </button>
            <button type="button" className="text-sm text-red-300" onClick={() => removeNote(n.id)}>
              Delete
            </button>
          </div>
        ))}
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-sky-500/25 bg-black/40 p-4">
        {activeId ? (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded border border-sky-500/30 bg-black/50 px-3 py-2 text-2xl text-white outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the note..."
              className="min-h-[24rem] flex-1 rounded border border-sky-500/30 bg-black/50 p-4 text-lg leading-relaxed text-sky-50 outline-none"
            />
            <button type="button" onClick={save} className="self-end rounded bg-sky-600 px-4 py-2 text-base text-white">
              Save
            </button>
          </>
        ) : (
          <p className="text-lg text-sky-200/60">Create a note or open one from the list.</p>
        )}
      </section>
    </main>
  );
}
