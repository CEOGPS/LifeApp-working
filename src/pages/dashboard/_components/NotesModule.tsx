import { useState } from "react";
import { Plus, Save, FileText, Trash2 } from "lucide-react";
// PATCH (home-page2): useHomeState = shared persistent store + migration of values saved
// under the legacy raw localStorage key (they vanished when the store gained a prefix).
import { useHomeState } from "../_lib/useHomeState";
import { emitHomeActivity } from "../_lib/homeActivity";

type Note = { id: string; title: string; content: string; ts: string };

export default function NotesModule() {
  const [notes, setNotes] = useHomeState<Note[]>("notes", []);
  const [active, setActive] = useState<Note | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setDraft({ title: "", content: "" });
    setActive(null);
    setIsNew(true);
  };

  const save = async () => {
    if (!draft.title && !draft.content) return;
    const note: Note = {
      id: Date.now().toString(),
      title: draft.title || "Untitled",
      content: draft.content,
      ts: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    if (active && !isNew) {
      // PATCH (home-page2): saving an opened note updates it instead of duplicating it.
      const updated: Note = { ...note, id: active.id };
      await setNotes((n) => n.map((x) => (x.id === active.id ? updated : x)));
      setActive(updated);
      emitHomeActivity({
        source: "notes",
        event_type: "note.updated",
        title: `Note: ${updated.title}`,
        body: updated.content.slice(0, 120) || null,
        id: `note-${updated.id}`,
      });
      return;
    }
    await setNotes((n) => [note, ...n]);
    setActive(note);
    setIsNew(false);
    emitHomeActivity({
      source: "notes",
      event_type: "note.saved",
      title: `Note: ${note.title}`,
      body: note.content.slice(0, 120) || null,
      id: `note-${note.id}`,
    });
  };

  const select = (n: Note) => {
    setActive(n);
    setDraft({ title: n.title, content: n.content });
    setIsNew(false);
  };

  const del = async (id: string) => {
    await setNotes((n) => n.filter((x) => x.id !== id));
    if (active?.id === id) {
      setActive(null);
      setIsNew(false);
    }
  };

  return (
    <div className="flex gap-3 h-full min-h-0">
      {/* Saved notes list */}
      <div className="w-28 shrink-0 flex flex-col gap-1 overflow-y-auto">
        <button
          onClick={startNew}
          className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary mb-2 font-display tracking-wider"
        >
          <Plus size={11} /> NEW
        </button>
        {notes.length === 0 && (
          <div className="text-[10px] text-white/20 text-center pt-4">
            No notes
          </div>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            onClick={() => select(n)}
            className={`flex items-start gap-1.5 p-2 rounded cursor-pointer group transition-colors
              ${active?.id === n.id ? "glass-crimson" : "hover:bg-white/4"}`}
          >
            <FileText size={10} className="text-primary/50 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-white/60 truncate">
                {n.title}
              </div>
              <div className="text-[9px] text-white/20">{n.ts}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                del(n.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-destructive"
            >
              <Trash2 size={9} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {isNew || active ? (
          <>
            <input
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              placeholder="Note title..."
              className="w-full h-7 px-2 text-xs bg-white/4 border border-white/6 rounded text-white/80 placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
            />
            <textarea
              value={draft.content}
              onChange={(e) =>
                setDraft((d) => ({ ...d, content: e.target.value }))
              }
              placeholder="Start writing..."
              className="flex-1 p-2 text-xs bg-white/4 border border-white/6 rounded text-white/60 placeholder:text-white/20 focus:outline-none focus:border-primary/40 resize-none transition-colors leading-relaxed"
            />
            <button
              onClick={save}
              className="flex items-center gap-1.5 text-[10px] text-primary hover:text-primary/80 font-display tracking-wider self-end"
            >
              <Save size={11} /> SAVE
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[11px] text-white/15 text-center">
              <FileText size={20} className="mx-auto mb-2 text-white/10" />
              Select a note or create new
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
