// src/lib/agents/UnifiedAgentCore.ts
// ============================================================
// UnifiedAgentCore.ts — The foundation for Erebus & Kranos
// ============================================================

interface AgentConfig {
  worker: string;
  fallbackWorkers: (string | null)[];
  browserAgent: string;
  mediaEndpoints: {
    image: string[];
    video: string[];
    audio: string[];
  };
  cloudflare: {
    apiToken: string | null;
    accountId: string;
    projectName: string;
  };
  bd: {
    siteUrl: string;
    adminPath: string;
  };
}

const config: AgentConfig = {
  worker: import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev",
  fallbackWorkers: [
    import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev",
    null,
  ],
  browserAgent: "http://localhost:8100",
  mediaEndpoints: {
    image: ["http://localhost:8000", "https://api.replicate.com/v1"],
    video: ["http://localhost:8001", "https://api.runwayml.com/v1"],
    audio: ["http://localhost:8002", "https://api.elevenlabs.io/v1"],
  },
  cloudflare: {
    apiToken: null,
    accountId: "4cb5c0d8553b8c0c9156ee4f2bad9e6f",
    projectName: "lifeos1",
  },
  bd: {
    siteUrl: "https://ceogps.com",
    adminPath: "/admin",
  },
};

// === Tool Definition System ===
interface ToolSpec {
  name: string;
  description: string;
  parameters: {
    required?: string[];
    [key: string]: any;
  };
  permission: string;
  handler: (args: any, context: any) => Promise<any>;
  requiresBrowser?: boolean;
}

class Tool {
  public name: string;
  public description: string;
  public parameters: ToolSpec["parameters"];
  public permission: string;
  public handler: ToolSpec["handler"];
  public requiresBrowser: boolean;

  constructor(spec: ToolSpec) {
    this.name = spec.name;
    this.description = spec.description;
    this.parameters = spec.parameters;
    this.permission = spec.permission;
    this.handler = spec.handler;
    this.requiresBrowser = spec.requiresBrowser || false;
  }

  validate(args: any): boolean {
    const required = this.parameters.required || [];
    for (const req of required) {
      if (args[req] === undefined) {
        throw new Error(`Missing required parameter: ${req}`);
      }
    }
    return true;
  }

  async execute(args: any, context: any): Promise<any> {
    this.validate(args);
    return this.handler(args, context);
  }
}

// === Memory System ===
interface MemoryEntry {
  role: string;
  content: string;
  metadata: any;
  timestamp: number;
  id: string;
}

class MemorySystem {
  private episodic: MemoryEntry[] = [];
  private semantic: Map<string, any> = new Map();
  private procedural: any[] = [];

  constructor() {
    this.load();
  }

  add(role: string, content: string, metadata: any = {}) {
    this.episodic.push({
      role,
      content,
      metadata,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    });
    if (this.episodic.length > 100) this.episodic.shift();
    this.persist();
  }

  async search(query: string, limit = 5): Promise<MemoryEntry[]> {
    const terms = query.toLowerCase().split(/\s+/);
    const scored = this.episodic.map((ep) => {
      let score = 0;
      const content = ep.content.toLowerCase();
      for (const term of terms) {
        if (content.includes(term)) score++;
      }
      const age = Date.now() - ep.timestamp;
      const recency = Math.max(0, 1 - age / (24 * 60 * 60 * 1000));
      return { ep, score: score * 0.7 + recency * 0.3 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.ep);
  }

  persist() {
    localStorage.setItem(
      "agent_memory",
      JSON.stringify({
        episodic: this.episodic,
        procedural: this.procedural.slice(-50),
      }),
    );
  }

  load() {
    const saved = localStorage.getItem("agent_memory");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.episodic = data.episodic || [];
        this.procedural = data.procedural || [];
      } catch (e) {
        console.error("Failed to load agent memory", e);
      }
    }
  }

  getEpisodic() {
    return this.episodic;
  }
}

// === Browser Session Manager (Real Takeover) ===
interface BrowserSession {
  id: string;
  wsUrl: string;
  createdAt: number;
}

class BrowserSessionManager {
  private agentUrl: string;
  private activeSessions: Map<string, BrowserSession> = new Map();
  private userTakeoverMode: boolean = false;

  constructor(agentUrl: string) {
    this.agentUrl = agentUrl;
  }

  async createSession(sessionId = crypto.randomUUID()): Promise<string> {
    const response = await fetch(`${this.agentUrl}/session/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (response.ok) {
      const data = await response.json();
      this.activeSessions.set(sessionId, {
        id: sessionId,
        wsUrl: data.wsUrl,
        createdAt: Date.now(),
      });
      return sessionId;
    }
    throw new Error("Failed to create browser session");
  }

  async navigate(sessionId: string, url: string): Promise<any> {
    return this.exec(sessionId, "navigate", { url });
  }

  async click(sessionId: string, selector: string): Promise<any> {
    return this.exec(sessionId, "click", { selector });
  }

  async type(sessionId: string, selector: string, text: string): Promise<any> {
    return this.exec(sessionId, "type", { selector, text });
  }

  async screenshot(sessionId: string): Promise<any> {
    return this.exec(sessionId, "screenshot", {});
  }

  async takeover(sessionId: string): Promise<{ message: string; sessionId: string }> {
    this.userTakeoverMode = true;
    await this.exec(sessionId, "takeover", {});
    return {
      message:
        "Browser control handed to user. Say 'take back control' to resume.",
      sessionId,
    };
  }

  async release(sessionId: string): Promise<void> {
    this.userTakeoverMode = false;
    await this.exec(sessionId, "release", {});
  }

  async exec(sessionId: string, action: string, params: any): Promise<any> {
    const response = await fetch(
      `${this.agentUrl}/session/${sessionId}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );
    if (!response.ok) {
      throw new Error(`Browser agent request failed: ${response.statusText}`);
    }
    return response.json();
  }
}

// === LLM Router (Multi-provider with fallback) ===
interface LLMResponse {
  text: string;
  provider: string;
  model: string;
}

interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

class LLMRouter {
  private primary: string;
  private fallbacks: (string | null)[];

  constructor(workerUrl: string, fallbacks: (string | null)[]) {
    this.primary = workerUrl;
    this.fallbacks = fallbacks.filter((f) => f !== workerUrl);
  }

  async invoke(messages: any[], options: LLMOptions = {}): Promise<LLMResponse> {
    const providers = [this.primary, ...this.fallbacks];

    for (const url of providers) {
      if (!url) continue;
      try {
        const response = await fetch(`${url}/api/llm/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            model: options.model || "auto",
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
          }),
          signal: AbortSignal.timeout(options.timeout || 30000),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            text: data.text || data.response,
            provider: url,
            model: data.model_used || "unknown",
          };
        }
      } catch (e: any) {
        console.warn(`Provider ${url} failed:`, e.message);
      }
    }
    throw new Error("All LLM providers failed");
  }
}

// === Media Generation ===
interface MediaResult {
  url: string;
  provider: string;
  prompt: string;
}

class MediaGenerator {
  private endpoints: AgentConfig["mediaEndpoints"];

  constructor(endpoints: AgentConfig["mediaEndpoints"]) {
    this.endpoints = endpoints;
  }

  async generateImage(prompt: string, options: any = {}): Promise<MediaResult> {
    for (const endpoint of this.endpoints.image) {
      try {
        const response = await fetch(`${endpoint}/generate/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, ...options }),
        });
        if (response.ok) {
          const data = await response.json();
          return {
            url: data.url || data.image_url,
            provider: endpoint,
            prompt,
          };
        }
      } catch (e) {
        continue;
      }
    }
    throw new Error("All image providers failed");
  }

  async generateVideo(prompt: string, options: any = {}): Promise<any> {
    for (const endpoint of this.endpoints.video) {
      try {
        const response = await fetch(`${endpoint}/generate/video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, ...options }),
        });
        if (response.ok) return await response.json();
      } catch (e) {
        continue;
      }
    }
    throw new Error("All video providers failed");
  }

  async generateAudio(prompt: string, options: any = {}): Promise<any> {
    for (const endpoint of this.endpoints.audio) {
      try {
        const response = await fetch(`${endpoint}/generate/audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: prompt, ...options }),
        });
        if (response.ok) return await response.json();
      } catch (e) {
        continue;
      }
    }
    throw new Error("All audio providers failed");
  }
}

// === Cloudflare Pages Deployer ===
class CloudflareDeployer {
  private apiToken: string;
  private accountId: string;
  private projectName: string;

  constructor(apiToken: string, accountId: string, projectName: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.projectName = projectName;
  }

  async deploy(files: Record<string, string>): Promise<any> {
    const formData = new FormData();
    formData.append("project", this.projectName);
    for (const [path, content] of Object.entries(files)) {
      const blob = new Blob([content], { type: "application/octet-stream" });
      formData.append("files", blob, path);
    }
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.projectName}/deployments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiToken}` },
        body: formData,
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Cloudflare deploy failed: ${errorData.errors?.[0]?.message || response.statusText}`);
    }
    return response.json();
  }
}

// === Main Agent Class ===
interface AgentThinkResult {
  response: string;
  toolResults: any[];
  model: string;
  provider: string;
  error?: string;
}

interface ToolCall {
  tool: string;
  args: any;
}

class UnifiedAgent {
  public config: AgentConfig;
  public memory: MemorySystem;
  public browser: BrowserSessionManager;
  public llm: LLMRouter;
  public media: MediaGenerator;
  public cloudflare: CloudflareDeployer | null;
  public tools: Map<string, Tool>;
  public isThinking: boolean = false;
  public identity: string = "an autonomous agent";

  constructor(customConfig: Partial<AgentConfig> = {}) {
    this.config = { ...config, ...customConfig };
    this.memory = new MemorySystem();
    this.browser = new BrowserSessionManager(this.config.browserAgent);
    this.llm = new LLMRouter(this.config.worker, this.config.fallbackWorkers);
    this.media = new MediaGenerator(this.config.mediaEndpoints);
    this.cloudflare = this.config.cloudflare.apiToken
      ? new CloudflareDeployer(
          this.config.cloudflare.apiToken,
          this.config.cloudflare.accountId,
          this.config.cloudflare.projectName,
        )
      : null;
    this.tools = new Map();
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  async think(userMessage: string, context: any = {}): Promise<AgentThinkResult> {
    this.isThinking = true;
    try {
      this.memory.add("user", userMessage, context);
      const relevantMemories = await this.memory.search(userMessage);
      const systemPrompt = this.buildSystemPrompt(relevantMemories);

      const messages = [
        { role: "system", content: systemPrompt },
        ...this.memory.getEpisodic()
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage },
      ];

      const llmResponse = await this.llm.invoke(messages);
      const toolCalls = this.parseToolCalls(llmResponse.text);
      const toolResults: any[] = [];

      for (const call of toolCalls) {
        const tool = this.tools.get(call.tool);
        if (tool) {
          try {
            const result = await tool.execute(call.args, {
              agent: this,
              context,
            });
            toolResults.push({ tool: call.tool, result });
          } catch (e: any) {
            toolResults.push({ tool: call.tool, error: e.message });
          }
        }
      }

      let finalResponse = llmResponse.text;
      if (toolResults.length > 0) {
        finalResponse = await this.synthesize(
          userMessage,
          llmResponse.text,
          toolResults,
        );
      }

      this.memory.add("assistant", finalResponse);
      this.isThinking = false;
      return {
        response: finalResponse,
        toolResults,
        model: llmResponse.model,
        provider: llmResponse.provider,
      };
    } catch (error: any) {
      this.isThinking = false;
      return { response: `Error: ${error.message}`, toolResults: [], model: "unknown", provider: "unknown", error: error.message };
    }
  }

  buildSystemPrompt(memories: MemoryEntry[]) {
    const toolsList = Array.from(this.tools.values())
      .map((t) => `- ${t.name}: ${t.description} (${t.permission})`)
      .join("\n");

    const recentMemories = memories
      .map((m) => `[${m.role}]: ${m.content.slice(0, 100)}`)
      .join("\n");

    return `You are ${this.identity} with these capabilities:

## Available Tools
${toolsList}

## Recent Relevant Memories
${recentMemories || "No relevant memories."}

## Response Format
When you need to use a tool, output:
<tool_call>
{"tool": "tool_name", "args": {"arg1": "value1"}}
</tool_call>

## Instructions
- Think step by step
- Use tools when needed
- Be concise but thorough
- For browser takeover, use browser_takeover
- For media generation, use generate_image/video/audio
- For deployment, use cloudflare_deploy

Proceed.`;
  }

  parseToolCalls(text: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const regex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.tool && parsed.args) calls.push(parsed);
      } catch (e) {}
    }
    return calls;
  }

  async synthesize(originalQuery: string, llmResponse: string, toolResults: any[]): Promise<string> {
    const synthesisPrompt = `Original: ${originalQuery}

Initial response: ${llmResponse}

Tool results:
${toolResults.map((r) => `${r.tool}: ${JSON.stringify(r.result).slice(0, 200)}`).join("\n")}

Provide final answer incorporating tool results. Be concise.`;

    const response = await this.llm.invoke(
      [{ role: "user", content: synthesisPrompt }],
      { maxTokens: 500 },
    );
    return response.text;
  }
}

export {
  UnifiedAgent,
  Tool,
  config,
  BrowserSessionManager,
  MediaGenerator,
  CloudflareDeployer,
};
export type { AgentThinkResult };
