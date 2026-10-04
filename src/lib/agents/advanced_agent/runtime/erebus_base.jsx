// =============================================
// Erebus v5.0 — Autonomous AI with File System
// =============================================

class Erebus {
  constructor() {
    this.fs = JSON.parse(localStorage.getItem('er_filesystem')) || this.createInitialFS();
    this.shortTerm = JSON.parse(localStorage.getItem('er_short')) || [];
    this.longTerm = JSON.parse(localStorage.getItem('er_longterm')) || { facts: {}, reflections: [] };
    this.loadCore();
  }

  createInitialFS() {
    return {
      "/": {
        "lifeos": {
          "notes": {
            "family-goals.txt": "Protect dinner times. Jamal soccer 4pm. Elena dance.",
            "business-leads.txt": "Sarah Patel - Decatur event plumbing - Warm lead"
          },
          "media": {
            "avatar.png": "[Base64 placeholder - cyborg avatar]",
            "logo.png": "[CEO GPS Logo]"
          },
          "reports": {
            "life-pulse-april2026.md": "# Life Pulse\nHarmony Score: 89\nFamily protected • 3 warm leads"
          }
        },
        "config": {
          "agent-settings.json": JSON.stringify({ voice: "sultry", priority: "family-first" })
        }
      }
    };
  }

  saveFS() {
    localStorage.setItem('er_filesystem', JSON.stringify(this.fs));
  }

  // === FILE SYSTEM OPERATIONS ===
  ls(path = "/") {
    let current = this.fs;
    const parts = path.split('/').filter(Boolean);
    
    for (let part of parts) {
      if (current[part]) current = current[part];
      else return `Error: Path not found: ${path}`;
    }
    
    return Object.keys(current).join("\n");
  }

  readFile(path) {
    let current = this.fs;
    const parts = path.split('/').filter(Boolean);
    const filename = parts.pop();
    
    for (let part of parts) {
      if (current[part]) current = current[part];
      else return `Error: File not found: ${path}`;
    }
    
    return current[filename] || `Error: File not found: ${path}`;
  }

  writeFile(path, content) {
    let current = this.fs;
    const parts = path.split('/').filter(Boolean);
    const filename = parts.pop();
    
    for (let part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
    
    current[filename] = content;
    this.saveFS();
    return `✓ Wrote ${path} (${content.length} characters)`;
  }

  deleteFile(path) {
    let current = this.fs;
    const parts = path.split('/').filter(Boolean);
    const filename = parts.pop();
    
    for (let part of parts) {
      if (current[part]) current = current[part];
      else return `Error: Path not found`;
    }
    
    if (current[filename]) {
      delete current[filename];
      this.saveFS();
      return `✓ Deleted ${path}`;
    }
    return `Error: File not found`;
  }

  // === CORE AI ===
  remember(role, text) {
    this.shortTerm.push({ role, text, time: new Date().toISOString() });
    if (this.shortTerm.length > 40) this.shortTerm.shift();
    localStorage.setItem('er_short', JSON.stringify(this.shortTerm));
  }

  async process(input) {
    this.remember("user", input);
    await new Promise(r => setTimeout(r, 650));

    let reply = this.generateResponse(input);

    this.remember("assistant", reply);
    this.learnFromInput(input, reply);

    return reply;
  }

  generateResponse(input) {
    const text = input.toLowerCase();

    // File system commands
    if (text.includes("list files") || text.includes("ls")) {
      return `Current files:\n${this.ls("/lifeos/notes")}\n\n${this.ls("/lifeos/reports")}`;
    }
    
    if (text.includes("read") && text.includes("file")) {
      return this.readFile("/lifeos/notes/business-leads.txt");
    }
    
    if (text.includes("write") || text.includes("save")) {
      const content = "New lead: Gino Bambino - Followed up on Apr 21";
      return this.writeFile("/lifeos/notes/followups.txt", content);
    }

    // Default intelligent responses
    if (text.includes("gino") || text.includes("bambino")) {
      return "Gino Bambino context loaded from memory. Draft message ready. Shall I write it to a file?";
    }
    if (text.includes("family")) {
      return "Family protection protocols active. Dinner at 6:30pm is locked in.";
    }

    return "I've analyzed your request and reviewed our file system. How would you like to proceed, Chris?";
  }

  learnFromInput(input, response) {
    if (input.toLowerCase().includes("remember")) {
      this.longTerm.facts[input] = response;
      localStorage.setItem('er_longterm', JSON.stringify(this.longTerm));
    }
  }

  getStatus() {
    return `AgentZero v5.0 Status:\n` +
           `• Files in system: ${Object.keys(this.fs["/lifeos"] || {}).length}\n` +
           `• Short-term memories: ${this.shortTerm.length}\n` +
           `• Long-term facts learned: ${Object.keys(this.longTerm.facts).length}`;
  }
}

// Initialize
window.erebus = new Erebus();

console.log('%c🤖 Erebus v5.0 — Full File System + Self-Learning AI Ready', 'color:#00c896;font-weight:700;font-size:14px');