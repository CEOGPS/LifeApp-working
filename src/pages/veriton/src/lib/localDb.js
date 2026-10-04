// Local store so Music Einstein works without the old hosted database.
const KEY = "lifeos_music_einstein";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function bucket(name) {
  return {
    async list() {
      return load()[name] || [];
    },
    async get(id) {
      return (load()[name] || []).find((row) => row.id === id) || null;
    },
    async create(row) {
      const data = load();
      const rec = {
        id: crypto.randomUUID(),
        created_date: new Date().toISOString(),
        status: "ready",
        ...row,
      };
      data[name] = [rec, ...(data[name] || [])];
      save(data);
      return rec;
    },
    async update(id, patch) {
      const data = load();
      data[name] = (data[name] || []).map((row) => (row.id === id ? { ...row, ...patch } : row));
      save(data);
      return (data[name] || []).find((row) => row.id === id) || null;
    },
    async delete(id) {
      const data = load();
      data[name] = (data[name] || []).filter((row) => row.id !== id);
      save(data);
    },
    async filter() {
      return load()[name] || [];
    },
  };
}

export const db = {
  entities: new Proxy(
    {},
    {
      get(_target, name) {
        return bucket(String(name));
      },
    },
  ),
  integrations: {
    Core: {
      async UploadFile({ file }) {
        return { file_url: file ? URL.createObjectURL(file) : "" };
      },
      async InvokeLLM() {
        return { response: "" };
      },
    },
  },
};
