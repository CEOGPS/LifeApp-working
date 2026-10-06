import { useEffect, useMemo, useRef, useState } from "react";
import { newId, type Memory } from "./memory";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Kind = "doc" | "sheet";
type Grid = { cols: string[]; rows: string[][]; colFill?: string[]; rowFill?: string[]; colText?: string[]; rowText?: string[]; table?: boolean };

const FILLS = ["#042f2e", "#1e1b4b", "#14532d", "#3f1d1d", "#1c1917"];
const INKS = ["#5eead4", "#c4b5fd", "#86efac", "#fdba74", "#ffffff"];

const EMPTY: Grid = { cols: ["A", "B", "C"], rows: [["", "", ""], ["", "", ""], ["", "", ""]] };

function splitCsv(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseDelimited(text: string): Grid | null {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.length);
  if (!lines.length) return null;
  const tabbed = lines.some((line) => line.includes("\t"));
  const cells = lines.map((line) => (tabbed ? line.split("\t") : splitCsv(line)));
  const width = Math.max(...cells.map((row) => row.length));
  if (!tabbed && width < 2 && lines.length < 2) return null;
  const header = cells[0];
  const headers = cells.length > 1 && header.every((cell) => cell !== "" && Number.isNaN(Number(cell.replace(/[$,]/g, ""))));
  if (headers) {
    const cols = header.map((cell, index) => cell || columnName(index));
    return { cols, rows: cells.slice(1).map((row) => cols.map((_, index) => row[index] || "")) };
  }
  const cols = Array.from({ length: width }, (_, index) => columnName(index));
  return { cols, rows: cells.map((row) => cols.map((_, index) => row[index] || "")) };
}

function parseHtmlTable(html: string): Grid | null {
  if (!html.includes("<table")) return null;
  const table = new DOMParser().parseFromString(html, "text/html").querySelector("table");
  if (!table) return null;
  const lines = [...table.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() || "").join("\t"));
  return parseDelimited(lines.join("\n"));
}

function fromClipboard(text: string, html: string) {
  return parseHtmlTable(html) || parseDelimited(text);
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function download(filename: string, text: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
function parseSheet(body: string): Grid {
  try {
    const raw = JSON.parse(body) as Grid;
    if (Array.isArray(raw.cols) && Array.isArray(raw.rows) && raw.cols.length) return raw;
  } catch { /* older sheets were comma text */ }
  return parseDelimited(body) || EMPTY;
}

function bareTitle(title: string) {
  return title.replace(/^Office · /, "");
}

function fileName(title: string) {
  return bareTitle(title).replace(/^(Doc|Sheet) · /, "").replace(/^[^/]+ \/ /, "");
}

function folderOf(title: string) {
  const rest = bareTitle(title).replace(/^(Doc|Sheet) · /, "");
  const cut = rest.indexOf(" / ");
  return cut > 0 ? rest.slice(0, cut) : "Inbox";
}

function asHtml(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  return value.split("\n").map((line) => "<p>" + (line.replace(/&/g, amp).replace(/</g, lt).replace(/>/g, gt) || "<br>") + "<" + "/p>").join("");
}

function wordFile(title: string, body: string) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
}

export function WordPage({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const page = useRef<HTMLDivElement>(null);
  const own = useRef(false);
  const range = useRef<Range | null>(null);
  function keep() {
    const selection = document.getSelection();
    if (selection && selection.rangeCount && page.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0);
  }
  useEffect(() => {
    if (!page.current || own.current) { own.current = false; return; }
    page.current.innerHTML = value ? asHtml(value) : "";
  }, [value]);
  function mark(command: string, arg?: string) {
    page.current?.focus();
    const selection = document.getSelection();
    if (range.current && selection) {
      selection.removeAllRanges();
      selection.addRange(range.current);
    }
    document.execCommand(command, false, arg);
    keep();
    own.current = true;
    onChange(page.current?.innerHTML || "");
  }
  function size(px: string) {
    mark("fontSize", "7");
    page.current?.querySelectorAll("font[size='7']").forEach((node) => {
      node.removeAttribute("size");
      (node as HTMLElement).style.fontSize = px;
    });
    own.current = true;
    onChange(page.current?.innerHTML || "");
  }
  return (
    <div className="mt-3">
      <style>{`.word-sheet h1{font-size:1.75rem;line-height:1.2;margin:.2rem 0 .6rem}.word-sheet h2{font-size:1.3rem;margin:.2rem 0 .4rem}.word-sheet p{margin:.35rem 0}.word-sheet ul,.word-sheet ol{margin:.4rem 0 .4rem 1.4rem}.word-sheet:empty:before{content:"Start the page, or paste from Word";color:rgba(255,255,255,.35)}`}</style>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-white/70">
        <select className="h-7 rounded-full border border-line bg-black/40 px-2 text-[11px]" aria-label="Font" defaultValue="Calibri" onChange={(event) => mark("fontName", event.target.value)}>
          {["Calibri", "Arial", "Times New Roman", "Georgia", "Garamond", "Verdana", "Trebuchet MS", "Courier New"].map((font) => <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>)}
        </select>
        <select className="h-7 w-16 rounded-full border border-line bg-black/40 px-2 text-[11px]" aria-label="Font size" defaultValue="15px" onChange={(event) => size(event.target.value)}>
          {["10px", "11px", "12px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px", "60px"].map((px) => <option key={px} value={px}>{px.replace("px", "")}</option>)}
        </select>
        <select className="h-7 rounded-full border border-line bg-black/40 px-2 text-[11px]" aria-label="Text color" defaultValue="#ffffff" onChange={(event) => mark("foreColor", event.target.value)}>
          {[
            ["#ffffff", "White"],
            ["#5eead4", "Teal"],
            ["#c4b5fd", "Purple"],
            ["#86efac", "Green"],
            ["#fdba74", "Orange"],
            ["#fde68a", "Yellow"],
            ["#fca5a5", "Red"],
            ["#93c5fd", "Blue"],
            ["#a3a3a3", "Gray"],
            ["#000000", "Black"],
          ].map(([value, label]) => <option key={value} value={value} style={{ color: value }}>{label}</option>)}
        </select>
        <button type="button" className="link-add" onClick={() => mark("bold")}>Bold</button>
        <button type="button" className="link-add" onClick={() => mark("italic")}>Italic</button>
        <button type="button" className="link-add" onClick={() => mark("underline")}>Underline</button>
        <button type="button" className="link-add" onClick={() => mark("formatBlock", "<h1>")}>Title</button>
        <button type="button" className="link-add" onClick={() => mark("formatBlock", "<h2>")}>Heading</button>
        <button type="button" className="link-add" onClick={() => mark("formatBlock", "<p>")}>Body</button>
        <button type="button" className="link-add" onClick={() => mark("insertUnorderedList")}>Bullets</button>
        <button type="button" className="link-add" onClick={() => mark("insertOrderedList")}>Numbers</button>
        <button type="button" className="link-add" onClick={() => mark("justifyLeft")}>Left</button>
        <button type="button" className="link-add" onClick={() => mark("justifyCenter")}>Center</button>
        <button type="button" className="link-add" onClick={() => mark("justifyRight")}>Right</button>
        <label className="flex items-center gap-1">Ink <input type="color" className="h-5 w-6 bg-transparent" defaultValue="#5eead4" onChange={(event) => mark("foreColor", event.target.value)} /></label>
        <label className="flex items-center gap-1">Mark <input type="color" className="h-5 w-6 bg-transparent" defaultValue="#042f2e" onChange={(event) => mark("hiliteColor", event.target.value)} /></label>
        <button type="button" className="link-remove" onClick={() => mark("removeFormat")}>Clear</button>
      </div>
      <div
        ref={page}
        className="word-sheet mx-auto min-h-[34rem] max-w-3xl rounded-sm border border-white/15 bg-black/55 px-10 py-8 text-[15px] leading-7 shadow-[0_0_0_1px_rgba(94,234,212,.15)] outline-none"
        contentEditable
        role="textbox"
        aria-label="Document"
        onInput={() => { own.current = true; onChange(page.current?.innerHTML || ""); }}
        onMouseUp={keep}
        onKeyUp={keep}
      />
    </div>
  );
}

export function OfficeDesk({ data, update }: { data: Memory; update: Update }) {
  const stored = data.media.filter((row) => /^Office · (Doc|Sheet) ·/.test(row.title));
  const older = data.notes.filter((row) => (row.title.startsWith("Doc ·") || row.title.startsWith("Sheet ·")) && !stored.some((item) => item.id === row.id));
  const files = [...stored.map((row) => ({ id: row.id, title: bareTitle(row.title), body: row.body })), ...older];
  const folders = useMemo(() => ["All", ...new Set(files.map((row) => folderOf(row.title)))], [files]);
  const [folder, setFolder] = useState("All");
  const [kind, setKind] = useState<Kind | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled");
  const [fileFolder, setFileFolder] = useState("Inbox");
  const [plain, setPlain] = useState(false);
  const [doc, setDoc] = useState("");
  const [grid, setGrid] = useState<Grid>(EMPTY);
  const [pickCol, setPickCol] = useState(0);
  const [pickRow, setPickRow] = useState(0);
  const shown = files.filter((row) => folder === "All" || folderOf(row.title) === folder);

  function open(row: { id: string; title: string; body: string }) {
    const nextKind: Kind = bareTitle(row.title).startsWith("Sheet ·") ? "sheet" : "doc";
    setKind(nextKind);
    setPlain(false);
    setOpenId(row.id);
    setName(fileName(row.title));
    setFileFolder(folderOf(row.title));
    if (nextKind === "sheet") setGrid(parseSheet(row.body));
    else setDoc(row.body);
  }

  function blank(next: Kind) {
    setKind(next);
    setPlain(false);
    setOpenId(null);
    setName(next === "doc" ? "Untitled doc" : "Untitled sheet");
    setFileFolder(folder === "All" ? "Inbox" : folder);
    setDoc("");
    setGrid(EMPTY);
  }

  function save() {
    if (!kind || !name.trim()) return;
    const title = `Office · ${kind === "doc" ? "Doc" : "Sheet"} · ${fileFolder.trim() || "Inbox"} / ${name.trim()}`;
    const body = kind === "doc" ? doc : JSON.stringify(grid);
    const id = openId && openId !== "saved" ? openId : newId();
    update((prev) => ({
      ...prev,
      notes: prev.notes.filter((row) => row.id !== id),
      media: [{ id, title, body: body.slice(0, 1_500_000), at: new Date().toISOString() }, ...prev.media.filter((row) => row.id !== id)].slice(0, 400),
    }));
    setOpenId(id);
    setPlain(false);
  }

  function setCell(rowIndex: number, colIndex: number, value: string) {
    setGrid((prev) => ({ ...prev, rows: prev.rows.map((row, index) => index === rowIndex ? row.map((cell, cellIndex) => cellIndex === colIndex ? value : cell) : row) }));
  }

  function paint(kind: "colFill" | "rowFill" | "colText" | "rowText", color: string) {
    setGrid((prev) => {
      const column = kind.startsWith("col");
      const key = column ? (kind === "colFill" ? "colFill" : "colText") : kind === "rowFill" ? "rowFill" : "rowText";
      const size = column ? prev.cols.length : prev.rows.length;
      const index = column ? pickCol : pickRow;
      const next = [...(prev[key] || Array(size).fill(""))];
      while (next.length < size) next.push("");
      next[index] = color;
      return { ...prev, [key]: next };
    });
  }

  function runColumn(fn: "sum" | "avg" | "count" | "min" | "max") {
    setGrid((prev) => {
      const rows = prev.rows.filter((row) => !["SUM", "AVG", "COUNT", "MIN", "MAX"].includes(row[0] || ""));
      const line = prev.cols.map((_, index) => {
        if (index === 0) return fn.toUpperCase();
        const values = rows.map((row) => String(row[index] || "").replace(/[$,]/g, "")).filter((cell) => cell !== "" && Number.isFinite(Number(cell))).map(Number);
        if (!values.length) return "";
        if (fn === "sum") return String(Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100);
        if (fn === "avg") return String(Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100);
        if (fn === "min") return String(Math.min(...values));
        if (fn === "max") return String(Math.max(...values));
        return String(values.length);
      });
      return { ...prev, rows: [...rows, line] };
    });
  }

  function sortColumn(dir: 1 | -1) {
    setGrid((prev) => ({
      ...prev,
      rows: [...prev.rows].sort((left, right) => {
        const a = left[pickCol] || "";
        const b = right[pickCol] || "";
        const an = Number(a.replace(/[$,]/g, ""));
        const bn = Number(b.replace(/[$,]/g, ""));
        if (a !== "" && b !== "" && Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir;
        return a.localeCompare(b) * dir;
      }),
    }));
  }

  const totals = grid.cols.map((_, colIndex) => {
    const filled = grid.rows.map((row) => row[colIndex]).filter((cell) => cell !== "");
    const numbers = filled.map(Number);
    if (!filled.length || numbers.some((value) => !Number.isFinite(value))) return "";
    return String(numbers.reduce((sum, value) => sum + value, 0));
  });

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[16rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Office</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="quiet is-on" onClick={() => blank("doc")}>New doc</button>
          <button type="button" className="quiet" onClick={() => blank("sheet")}>New sheet</button>
          <label className="quiet">
            Import
            <input className="hidden" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then((text) => {
                const next = parseDelimited(text);
                setKind(next ? "sheet" : "doc");
                setPlain(false);
                setOpenId(null);
                setName(file.name.replace(/\.[^.]+$/, ""));
                setFileFolder(folder === "All" ? "Inbox" : folder);
                if (next) setGrid(next);
                else setDoc(text.slice(0, 1_500_000));
              });
            }} />
          </label>
        </div>
        <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">FOLDERS</p>
        {folders.map((item) => <button key={item} type="button" className={`menu ${folder === item ? "is-on" : ""}`} onClick={() => setFolder(item)}>{item}</button>)}
        <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">STORED FILES</p>
        {shown.map((row) => (
          <button key={row.id} type="button" className={`menu ${openId === row.id ? "is-on" : ""}`} onClick={() => open(row)}>
            {row.title.startsWith("Sheet") ? "Sheet" : "Doc"} · {fileName(row.title)}
          </button>
        ))}
        {!shown.length ? <p className="text-[11px] text-white/35">Nothing filed here.</p> : null}
        <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">DASHBOARD NOTES</p>
        {data.notes.filter((row) => !/^(Doc ·|Sheet ·|Agent ·|Sim ·|Hub ·|Invoice ·|SEO ·|Audit ·|Competitor ·|Content ·)/.test(row.title)).map((row) => (
          <button key={row.id} type="button" className="menu" onClick={() => { setKind("doc"); setPlain(true); setOpenId(row.id); setName(row.title); setDoc(row.body); setFileFolder("Notes"); }}>{row.title || "Untitled"}</button>
        ))}
      </aside>
      <section className="module-card p-4">
        {!kind ? <p className="text-sm text-white/40">Create a doc or a sheet. Filed copies stay in the list.</p> : (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <input className="h-8 min-w-40 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} />
              <input className="h-8 w-36 rounded-full border border-line bg-black/40 px-3 text-sm" value={fileFolder} aria-label="Folder" onChange={(event) => setFileFolder(event.target.value)} />
              <button type="button" className="bg-blue" onClick={save}>Save</button>
              {openId && openId !== "saved" ? <button type="button" className="link-remove" onClick={() => { update((prev) => ({ ...prev, notes: prev.notes.filter((row) => row.id !== openId), media: prev.media.filter((row) => row.id !== openId) })); setKind(null); setOpenId(null); }}>Remove</button> : null}
              <button type="button" className="quiet" onClick={() => {
                if (kind !== "doc") {
                  void navigator.clipboard.writeText([grid.cols.join("\t"), ...grid.rows.map((row) => row.join("\t"))].join("\n")).catch(() => undefined);
                  return;
                }
                const plainText = new DOMParser().parseFromString(doc, "text/html").body.textContent || doc;
                const item = new ClipboardItem({ "text/html": new Blob([doc], { type: "text/html" }), "text/plain": new Blob([plainText], { type: "text/plain" }) });
                void navigator.clipboard.write([item]).catch(() => navigator.clipboard.writeText(plainText));
              }}>{kind === "doc" ? "Copy for Word" : "Copy for Excel / Sheets"}</button>
              <button type="button" className="quiet" onClick={() => {
                if (kind === "doc") download(`${name || "document"}.doc`, wordFile(name || "Document", doc), "application/msword");
                else download(`${name || "sheet"}.csv`, `\uFEFF${[grid.cols, ...grid.rows].map((row) => row.map(csvCell).join(",")).join("\n")}`, "text/csv");
              }}>{kind === "doc" ? "Download Word" : "Download"}</button>
            </div>
            {kind === "doc" ? <WordPage value={doc} onChange={setDoc} /> : (
              <div className="mt-3 overflow-x-auto" onPaste={(event) => {
                const text = event.clipboardData.getData("text/plain");
                const html = event.clipboardData.getData("text/html");
                const next = fromClipboard(text, html);
                if (!next) return;
                event.preventDefault();
                setGrid(next);
              }}>
                <p className="mb-2 text-[11px] text-white/40">Click a column letter or a row number, then use a tool. Paste from Excel or Google Sheets still fills the grid.</p>
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-white/60">
                  <span>Col {grid.cols[pickCol] || columnName(pickCol)}</span>
                  <button type="button" className="link-add" onClick={() => runColumn("sum")}>Sum</button>
                  <button type="button" className="link-add" onClick={() => runColumn("avg")}>Average</button>
                  <button type="button" className="link-add" onClick={() => runColumn("count")}>Count</button>
                  <button type="button" className="link-add" onClick={() => runColumn("min")}>Min</button>
                  <button type="button" className="link-add" onClick={() => runColumn("max")}>Max</button>
                  <button type="button" className="link-add" onClick={() => sortColumn(1)}>A–Z</button>
                  <button type="button" className="link-add" onClick={() => sortColumn(-1)}>Z–A</button>
                  <button type="button" className="link-add" onClick={() => setGrid((prev) => ({ ...prev, table: !prev.table }))}>{grid.table ? "Table on" : "Make table"}</button>
                  <span>Column</span>
                  {FILLS.map((color) => <button key={color} type="button" className="h-4 w-4 rounded-full border border-white/20" style={{ background: color }} aria-label="Column color" onClick={() => paint("colFill", color)} />)}
                  <button type="button" className="link-remove" onClick={() => paint("colFill", "")}>Clear</button>
                  <span>Row {pickRow + 1}</span>
                  {FILLS.map((color) => <button key={`row-${color}`} type="button" className="h-4 w-4 rounded-full border border-white/20" style={{ background: color }} aria-label="Row color" onClick={() => paint("rowFill", color)} />)}
                  <span>Text</span>
                  {INKS.map((color) => <button key={color} type="button" className="h-4 w-4 rounded-full border border-white/30" style={{ background: color }} aria-label="Text color" onClick={() => paint("colText", color)} />)}
                </div>
                <table className={`w-full border-collapse text-sm ${grid.table ? "border border-white/15" : ""}`}>
                  <thead>
                    <tr>
                      <th className="w-8" />
                      {grid.cols.map((col, index) => (
                        <th key={index} className="p-1" style={grid.table ? { background: "#042f2e", color: "#5eead4" } : undefined}>
                          <input className={`h-8 w-full min-w-24 rounded-lg border px-2 text-xs ${pickCol === index ? "border-emerald-300/70" : "border-line"}`} style={{ background: grid.colFill?.[index] || (grid.table ? "#042f2e" : "rgba(0,0,0,.4)"), color: grid.colText?.[index] || (grid.table ? "#5eead4" : undefined) }} value={col} onFocus={() => setPickCol(index)} onChange={(event) => setGrid((prev) => ({ ...prev, cols: prev.cols.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="pr-2 text-[11px] text-white/35"><button type="button" className={pickRow === rowIndex ? "text-emerald-200" : ""} onClick={() => setPickRow(rowIndex)}>{rowIndex + 1}</button></td>
                        {row.map((cell, colIndex) => (
                          <td key={colIndex} className={`p-1 ${grid.table ? "border border-white/10" : ""}`}>
                            <input className={`h-8 w-full min-w-24 rounded-lg border px-2 ${pickCol === colIndex ? "border-emerald-300/40" : "border-white/10"}`} style={{ background: grid.colFill?.[colIndex] || grid.rowFill?.[rowIndex] || (grid.table && rowIndex % 2 ? "rgba(94,234,212,.08)" : "rgba(0,0,0,.3)"), color: grid.colText?.[colIndex] || grid.rowText?.[rowIndex] || undefined }} value={cell} onFocus={() => { setPickCol(colIndex); setPickRow(rowIndex); }} onChange={(event) => setCell(rowIndex, colIndex, event.target.value)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="text-[11px] text-white/35">Σ</td>
                      {totals.map((total, index) => <td key={index} className="px-2 text-[11px] text-blue-2">{total}</td>)}
                    </tr>
                  </tbody>
                </table>
                <div className="mt-3 flex gap-4">
                  <button type="button" className="quiet" onClick={() => setGrid((prev) => ({ ...prev, rows: [...prev.rows, prev.cols.map(() => "")], rowFill: [...(prev.rowFill || []), ""], rowText: [...(prev.rowText || []), ""] }))}>Add row</button>
                  <button type="button" className="quiet" onClick={() => setGrid((prev) => ({ ...prev, cols: [...prev.cols, columnName(prev.cols.length)], rows: prev.rows.map((row) => [...row, ""]), colFill: [...(prev.colFill || []), ""], colText: [...(prev.colText || []), ""] }))}>Add column</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function columnName(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : `C${index + 1}`;
}
