// ============================================================
// Kranos.ts — Strategist Agent (Planning, Memory, Decisions)
// Place in: src/lib/agents/kranos/Kranos.ts
// ============================================================

import { UnifiedAgent, Tool, AgentThinkResult } from "../UnifiedAgentCore.js";

// ---------- Local types ----------

interface ToolContext {
  agent: {
    llm: {
      invoke: (
        messages: Array<{ role: string; content: string }>,
        opts?: { maxTokens?: number },
      ) => Promise<{ text: string }>;
    };
    memory: {
      add: (role: string, content: string) => void;
    };
    browser: {
      createSession: () => Promise<BrowserSession>;
      navigate: (sessionId: string, url: string) => Promise<unknown>;
      exec: (
        sessionId: string | undefined,
        action: string,
        args: { url?: string; selector?: string; text?: string },
      ) => Promise<unknown>;
    };
    media: {
      generateImage: (prompt: string, opts: Record<string, unknown>) => Promise<unknown>;
      generateVideo: (prompt: string, opts: Record<string, unknown>) => Promise<unknown>;
      generateAudio: (text: string, opts: Record<string, unknown>) => Promise<unknown>;
    };
    config: { worker: string };
  };
  preferences?: Record<string, unknown>;
}

interface BrowserSession {
  id: string;
  [key: string]: unknown;
}

interface Decision {
  decision: string;
  rationale: string;
  alternatives?: string[];
  timestamp: number;
  id: string;
}

interface Goal {
  id: string;
  progress: number;
  created: number;
  [key: string]: unknown;
}

interface Pattern {
  query: string;
  toolsUsed: string[];
  success: boolean;
  timestamp: number;
}

interface FeedbackEntry {
  [key: string]: unknown;
  timestamp: number;
}

interface ToolResult {
  tool: string;
  [key: string]: unknown;
}

interface KranosConfig {
  [key: string]: unknown;
}

// ---------- Decision Logging ----------
const logDecisionTool = new Tool({
  name: "log_decision",
  description: "Log a strategic decision with rationale",
  parameters: {
    type: "object",
    required: ["decision", "rationale"],
    properties: {
      decision: { type: "string" },
      rationale: { type: "string" },
      alternatives: { type: "array" },
    },
  },
  permission: "safe",
  handler: async (args: { decision: string; rationale: string; alternatives?: string[] }) => {
    const decisions: Decision[] = JSON.parse(
      localStorage.getItem("kranos_decisions") || "[]",
    );
    decisions.push({ ...args, timestamp: Date.now(), id: crypto.randomUUID() });
    localStorage.setItem(
      "kranos_decisions",
      JSON.stringify(decisions.slice(-100)),
    );
    return { success: true, decisionId: decisions[decisions.length - 1].id };
  },
});

// ---------- Goal Management ----------
const manageGoalsTool = new Tool({
  name: "manage_goals",
  description: "Create, update, or track goals",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["list", "create", "update", "progress"],
      },
      goal: { type: "object" },
      goalId: { type: "string" },
      progress: { type: "number" },
    },
  },
  permission: "safe",
  handler: async (args: {
    action: "list" | "create" | "update" | "progress";
    goal?: Partial<Goal>;
    goalId?: string;
    progress?: number;
  }) => {
    let goals: Goal[] = JSON.parse(localStorage.getItem("kranos_goals") || "[]");
    switch (args.action) {
      case "list":
        return goals;
      case "create": {
        const newGoal: Goal = {
          id: crypto.randomUUID(),
          ...(args.goal ?? {}),
          created: Date.now(),
          progress: 0,
        };
        goals.push(newGoal);
        localStorage.setItem("kranos_goals", JSON.stringify(goals));
        return newGoal;
      }
      case "update":
        goals = goals.map((g) =>
          g.id === args.goalId ? { ...g, ...args.goal } : g,
        );
        localStorage.setItem("kranos_goals", JSON.stringify(goals));
        return { success: true };
      case "progress":
        goals = goals.map((g) =>
          g.id === args.goalId ? { ...g, progress: args.progress ?? g.progress } : g,
        );
        localStorage.setItem("kranos_goals", JSON.stringify(goals));
        return { success: true, progress: args.progress };
      default:
        return { error: `Unknown action: ${String(args.action)}` };
    }
  },
});

// ---------- Context Analysis ----------
const analyzeContextTool = new Tool({
  name: "analyze_context",
  description: "Analyze situation and provide strategic recommendations",
  parameters: {
    type: "object",
    required: ["situation"],
    properties: {
      situation: { type: "string" },
      constraints: { type: "array" },
    },
  },
  permission: "safe",
  handler: async (
    args: { situation: string; constraints?: string[] },
    context: ToolContext,
  ) => {
    const analysisPrompt = `Analyze: ${args.situation}\nConstraints: ${JSON.stringify(args.constraints || [])}\n\nProvide:\n1. Core problem/opportunity\n2. 2-3 approaches\n3. Best approach and why\n4. First action\n\nBe concise.`;
    const response = await context.agent.llm.invoke(
      [{ role: "user", content: analysisPrompt }],
      { maxTokens: 800 },
    );
    return { analysis: response.text, timestamp: Date.now() };
  },
});

// ---------- Training Data Upload ----------
const uploadTrainingDataTool = new Tool({
  name: "upload_training_data",
  description: "Upload data to improve agent intelligence",
  parameters: {
    type: "object",
    required: ["data", "type"],
    properties: {
      data: { type: "object" },
      type: {
        type: "string",
        enum: ["conversation", "preference", "fact", "feedback"],
      },
    },
  },
  permission: "safe",
  handler: async (
    args: { data: Record<string, unknown>; type: "conversation" | "preference" | "fact" | "feedback" },
    context: ToolContext,
  ) => {
    switch (args.type) {
      case "preference": {
        const prefs: Record<string, unknown> = JSON.parse(
          localStorage.getItem("kranos_preferences") || "{}",
        );
        Object.assign(prefs, args.data);
        localStorage.setItem("kranos_preferences", JSON.stringify(prefs));
        break;
      }
      case "fact":
        context.agent.memory.add(
          "system",
          `Learned: ${JSON.stringify(args.data)}`,
        );
        break;
      case "feedback": {
        const feedback: FeedbackEntry[] = JSON.parse(
          localStorage.getItem("kranos_feedback") || "[]",
        );
        feedback.push({ ...args.data, timestamp: Date.now() });
        localStorage.setItem(
          "kranos_feedback",
          JSON.stringify(feedback.slice(-200)),
        );
        break;
      }
    }
    return { success: true, type: args.type };
  },
});

// ---------- File System — Read ----------
const readFileTool = new Tool({
  name: "read_file",
  description:
    "Read a file from the user's computer using the File System Access API",
  parameters: {
    type: "object",
    required: [],
    properties: { hint: { type: "string" } },
  },
  permission: "confirm",
  handler: async () => {
    try {
      const [handle] = await (window as unknown as {
        showOpenFilePicker: (opts: { multiple: boolean }) => Promise<FileSystemFileHandle[]>;
      }).showOpenFilePicker({ multiple: false });
      const file = await handle.getFile();
      const text = await file.text();
      return {
        name: file.name,
        size: file.size,
        content: text.slice(0, 50000),
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

// ---------- File System — Write / Create ----------
const writeFileTool = new Tool({
  name: "write_file",
  description: "Write or create a file on the user's computer",
  parameters: {
    type: "object",
    required: ["content", "suggestedName"],
    properties: {
      content: { type: "string" },
      suggestedName: { type: "string" },
      type: { type: "string" },
    },
  },
  permission: "confirm",
  handler: async (args: { content: string; suggestedName: string; type?: string }) => {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: {
          suggestedName: string;
          types: Array<{ description: string; accept: Record<string, string[]> }>;
        }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: args.suggestedName,
        types: [
          {
            description: "File",
            accept: {
              "text/plain": [".txt"],
              "application/json": [".json"],
              "text/javascript": [".js"],
              "text/html": [".html"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(args.content);
      await writable.close();
      return { success: true, name: handle.name };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

// ---------- Browser Takeover ----------
const browserTakeoverTool = new Tool({
  name: "browser_takeover",
  description:
    "Open and control a browser session via the local Puppeteer agent",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: [
          "open",
          "navigate",
          "click",
          "type",
          "extract",
          "screenshot",
          "close",
        ],
      },
      url: { type: "string" },
      selector: { type: "string" },
      text: { type: "string" },
      sessionId: { type: "string" },
    },
  },
  permission: "confirm",
  requiresBrowser: true,
  handler: async (
    args: {
      action: "open" | "navigate" | "click" | "type" | "extract" | "screenshot" | "close";
      url?: string;
      selector?: string;
      text?: string;
      sessionId?: string;
    },
    context: ToolContext,
  ) => {
    const browser = context.agent.browser;
    try {
      if (args.action === "open") {
        const session = await browser.createSession();
        if (args.url) await browser.navigate(session.id, args.url);
        return session;
      }
      return await browser.exec(args.sessionId, args.action, {
        url: args.url,
        selector: args.selector,
        text: args.text,
      });
    } catch (e) {
      return {
        error: (e as Error).message,
        hint: "Make sure the local browser agent is running on port 8100",
      };
    }
  },
});

// ---------- Generate Image ----------
const generateImageTool = new Tool({
  name: "generate_image",
  description: "Generate an image via Replicate or local ComfyUI",
  parameters: {
    type: "object",
    required: ["prompt"],
    properties: {
      prompt: { type: "string" },
      model: { type: "string" },
      size: { type: "string" },
    },
  },
  permission: "safe",
  handler: async (
    args: { prompt: string; model?: string; size?: string },
    context: ToolContext,
  ) => {
    try {
      return await context.agent.media.generateImage(args.prompt, args);
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

// ---------- Generate Video ----------
const generateVideoTool = new Tool({
  name: "generate_video",
  description: "Generate video via Runway Gen-3 or local model",
  parameters: {
    type: "object",
    required: ["prompt"],
    properties: {
      prompt: { type: "string" },
      duration: { type: "number" },
      image_url: { type: "string" },
    },
  },
  permission: "safe",
  handler: async (
    args: { prompt: string; duration?: number; image_url?: string },
    context: ToolContext,
  ) => {
    try {
      return await context.agent.media.generateVideo(args.prompt, args);
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

// ---------- Generate Audio ----------
const generateAudioTool = new Tool({
  name: "generate_audio",
  description: "Generate speech or audio via ElevenLabs",
  parameters: {
    type: "object",
    required: ["text"],
    properties: { text: { type: "string" }, voice_id: { type: "string" } },
  },
  permission: "safe",
  handler: async (
    args: { text: string; voice_id?: string },
    context: ToolContext,
  ) => {
    try {
      return await context.agent.media.generateAudio(args.text, args);
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

// ---------- Web Search ----------
const webSearchTool = new Tool({
  name: "web_search",
  description: "Search the web via Worker browse endpoint",
  parameters: {
    type: "object",
    required: ["query"],
    properties: { query: { type: "string" } },
  },
  permission: "safe",
  handler: async (args: { query: string }, context: ToolContext) => {
    try {
      const r = await fetch(
        `${context.agent.config.worker}/api/browse/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: args.query }),
        },
      );
      return await r.json();
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

// ---------- Kranos Agent ----------
class Kranos extends UnifiedAgent {
  identity = "Kranos";
  preferences: Record<string, unknown>;

  constructor(customConfig: KranosConfig = {}) {
    super(customConfig);
    this.registerTool(logDecisionTool);
    this.registerTool(manageGoalsTool);
    this.registerTool(analyzeContextTool);
    this.registerTool(uploadTrainingDataTool);
    this.registerTool(readFileTool);
    this.registerTool(writeFileTool);
    this.registerTool(browserTakeoverTool);
    this.registerTool(generateImageTool);
    this.registerTool(generateVideoTool);
    this.registerTool(generateAudioTool);
    this.registerTool(webSearchTool);
    this.preferences = JSON.parse(
      localStorage.getItem("kranos_preferences") || "{}",
    );
  }

  async think(userMessage: string, context: Record<string, unknown> = {}): Promise<AgentThinkResult> {
    const ctx = context as { preferences?: Record<string, unknown> };
    ctx.preferences = this.preferences;
    const result = await super.think(userMessage, context);
    if (result.toolResults && result.toolResults.length > 0) {
      const pattern: Pattern = {
        query: userMessage.slice(0, 200),
        toolsUsed: result.toolResults.map((t) => t.tool),
        success: !result.error,
        timestamp: Date.now(),
      };
      const patterns: Pattern[] = JSON.parse(
        localStorage.getItem("kranos_patterns") || "[]",
      );
      patterns.push(pattern);
      localStorage.setItem(
        "kranos_patterns",
        JSON.stringify(patterns.slice(-100)),
      );
    }
    return result;
  }

  getIntelligenceReport() {
    const decisions: Decision[] = JSON.parse(
      localStorage.getItem("kranos_decisions") || "[]",
    );
    const patterns: Pattern[] = JSON.parse(
      localStorage.getItem("kranos_patterns") || "[]",
    );
    const feedback: FeedbackEntry[] = JSON.parse(
      localStorage.getItem("kranos_feedback") || "[]",
    );
    const goals: Goal[] = JSON.parse(localStorage.getItem("kranos_goals") || "[]");
    return {
      decisions: decisions.length,
      patterns: patterns.length,
      feedback: feedback.length,
      activeGoals: goals.filter((g) => g.progress < 100).length,
      completedGoals: goals.filter((g) => g.progress === 100).length,
      memorySize: (this.memory as unknown as { episodic: unknown[] }).episodic.length,
      preferences: Object.keys(this.preferences).length,
    };
  }
}

let kranosInstance: Kranos | null = null;
export function getKranos(): Kranos {
  if (!kranosInstance) kranosInstance = new Kranos();
  return kranosInstance;
}