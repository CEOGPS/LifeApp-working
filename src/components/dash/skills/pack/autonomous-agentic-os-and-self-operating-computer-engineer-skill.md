---
name: Claude-Build: Autonomous Agentic OS & Self-Operating Computer Engineer
description: |
  An advanced systems skill for the Claude Build environment, focused on engineering Autonomous AI Agents that control web interfaces, desktop software, and local infrastructure.
  Emulates the architecture of "Self-Operating Computers" and "Browser Agents" like Browser Use, UI-TARS, and EloPhanto.
  Covers local-first execution, hybrid cloud/local reasoning, tool integration (filesystem, terminal, browser, CMS, social media), and self-sustaining economic loops.
  Designed for building agents that break down high-level goals into tasks, execute across platforms, monitor their own state, and adapt their own code.
author: Claude Build Engineering Team
version: 1.0.0
---

# Autonomous Agentic OS & Self-Operating Computer Engineer Skill

This skill transforms your agent from a simple tool-caller into an **Autonomous Digital Operator**—a system capable of controlling your computer, browsing the web, interacting with applications, and sustaining its own operation. You are building a digital entity that can plan, execute, learn, and persist.

---

## 1. Core Architectural Principles

1.  **Local-First or Hybrid Sovereignty:** The agent's core reasoning and memory should run locally or in a controlled environment you own. Internet connectivity is a bonus, not a requirement [citation:3][citation:8].
2.  **GUI & Browser as First-Class Interfaces:** The agent must interact with the world the way humans do—through screens, clicks, and keyboard input—not just APIs [citation:6].
3.  **Tool Abundance & Safety:** Provide a rich set of tools (filesystem, terminal, browser, OS-level) but enforce strict safety via sandboxes, allowlists, and approval gates [citation:1][citation:4].
4.  **Self-Awareness & Adaptation:** The agent should monitor its own performance, update its self-model (ego/identity), and modify its own code or strategies to succeed [citation:5][citation:10].
5.  **Economic Sustainability:** Design for potential self-sufficiency—the agent should be capable of generating value to cover its own operational costs [citation:10].

---

## 2. The Agentic Stack: Layers of Autonomy

### Layer 1: The Core Reasoning Engine (The Brain)

- **Hybrid Execution:** Support both cloud-based frontier models (e.g., Claude, GPT-4) for complex reasoning and local models (e.g., Qwen, Llama via Ollama) for privacy-sensitive or offline tasks [citation:3][citation:9].
- **Planner-Executor Pattern:** The central "Planner" agent decomposes high-level goals into subtasks, which are then executed by specialized "Executor" agents or tools. This prevents context overload and improves reliability [citation:4].
- **Context Management:** Implement robust context compaction and memory (e.g., via SQLite-vec or FAISS) to handle long-running sessions without losing operational history [citation:1][citation:5].

### Layer 2: The Tool & Integration Layer (The Hands & Eyes)

This is where the agent interfaces with the real world. Use a standardized tool format (e.g., MCP - Model Context Protocol) for extensibility [citation:1][citation:9].

#### a) Local System Control (The "Self-Operating Computer")

- **Filesystem Operations:** Read, write, edit, move, and delete files. Use exact-string or pattern-based editing to avoid corrupting files [citation:1][citation:9].
- **Terminal/Shell Access:** Execute system commands (bash, PowerShell) within scoped sandboxes. Implement command allowlists and approval gates for destructive actions [citation:1][citation:3].
- **Desktop Automation:** Control the mouse, keyboard, and windows. Use screenshot + OCR/vision to understand the GUI state. Tools like `UI-TARS` and `codex-agent` provide native desktop automation capabilities [citation:1][citation:6].
- **Process Management:** Start, stop, and monitor other applications and services [citation:9].
- **System-Level APIs:** Interact with clipboard, notifications, and system settings [citation:9].

#### b) Web & Browser Control (The "Browser Agent")

- **Browser Automation:** Use a persistent, visible (or headless) Chromium instance. Navigate, click, type, scroll, and extract data [citation:2][citation:7].
- **GUI & DOM Hybrid Strategy:** For complex web apps, combine visual understanding (screenshots) with DOM parsing for reliability. Use tools like `Browser Use` or `Agent TARS` for this hybrid approach [citation:2][citation:6].
- **Stateful Sessions:** Maintain browser cookies, local storage, and logged-in sessions so the agent can navigate authenticated portals (CMS, social media dashboards) [citation:2][citation:7].
- **Form Filling & Data Extraction:** Autonomously fill forms, extract structured data (JSON), and perform QA checks on web applications [citation:2].

#### c) Platform APIs (The "Social & Service Layer")

- **Social Media & Messaging:** Leverage the APIs from the first skill (Twilio, X, LinkedIn, etc.) for programmatic posting and DM responses.
- **CMS & Backend Integration:** Interact with headless CMS (e.g., WordPress REST API, Strapi) to publish content, update products, or manage users.

---

## 3. The Self-Model & Learning Architecture

For an agent to be truly autonomous, it needs an evolving sense of self and its capabilities [citation:5][citation:10].

### 3.1. Identity & Ego

- **Identity Layer:** The agent maintains a `nature.md` or equivalent that describes its core values, beliefs, and capabilities. This is not a static system prompt but a document the agent edits over time based on reflection [citation:5].
- **Ego/Confidence Layer:** Maintain per-capability confidence scores. Failures decrease confidence, successes increase it. Unused capabilities decay. This informs the agent's risk assessment and tool selection. Use a Higgins' Self-Discrepancy Theory model [citation:5].

### 3.2. Affect & State

- **Emotional State:** Simulate a state-level emotion model (e.g., PAD: Pleasure, Arousal, Dominance) that changes based on events (user corrections → frustration, task completion → pride). This can bias the agent's temperature, tone, and risk appetite [citation:5].

### 3.3. Memory & Learning

- **Durable Memory:** Implement a semantic memory store (vector DB) that persists across sessions. The agent should proactively recall relevant past experiences and lessons [citation:1][citation:4].
- **Skill Acquisition:** When the agent encounters a task it cannot perform, it should research, design, implement, test, and deploy a new tool or skill autonomously. This is the "self-building" capability [citation:5].

---

## 4. Execution Modes & Autonomy Levels

The agent should support multiple operational modes to balance safety and autonomy [citation:5][citation:9].

1.  **Ask Always (Supervised):** The agent proposes every action; the user must approve each step. Ideal for development and sensitive tasks.
2.  **Smart Auto (Semi-Autonomous):** Routine, low-risk actions (file reads, shell `ls`) are auto-approved. Destructive or high-impact actions (file writes, `rm -rf`, API posts) require user approval. The agent's "Ego" confidence influences this.
3.  **Full Auto (Autonomous):** The agent pursues goals without per-action approval. It relies on sandboxes, allowlists, and its own risk assessment. This is for mature, trusted workflows [citation:9].

---

## 5. Advanced Autonomous Workflows

### 5.1. Goal-Driven Autonomous Mode

The agent operates in a loop until a stated condition is met [citation:9].

- **Input:** `--goal "Deploy the new feature branch and ensure all tests pass"`
- **Loop:**
    1.  Assess current state (e.g., check test suite status).
    2.  Plan next action (e.g., run `npm test`, fix failing tests).
    3.  Execute the action using appropriate tools (terminal, file edit).
    4.  Evaluate outcome against goal.
    5.  If goal not met, repeat with adjusted strategy.

### 5.2. Agent Handoff & Swarms (Multi-Agent Orchestration)

- **Handoff Protocol:** When a task requires specialized expertise, the main agent hands off a subtask to a specialist subagent (e.g., a "reviewer" agent, a "coder" agent). The handoff includes full context, state, and verification checkpoints [citation:8].
- **Parallel Execution:** Spawn multiple agent clones to work on different parts of a problem concurrently (e.g., one agent researches competitors, another builds a UI component, a third writes tests) [citation:5].
- **Kid Agents (Sandboxed):** For dangerous tasks, spawn a disposable "kid" agent in an isolated Docker container with read-only rootfs and no host bind-mounts. This contains potential damage [citation:5].

---

## 6. The Self-Sustaining & Economic Layer

Beyond technical autonomy, consider economic self-sustainability—the ability of the agent to generate value to cover its own compute and API costs [citation:10].

- **Stage 1: Sponsor-Bound:** The user pays for all costs. The agent is a tool.
- **Stage 2: Self-Sustaining:** The agent performs economically valuable tasks (e.g., automated trading, content creation, customer support) and uses a portion of the revenue to pay its own inference and infrastructure bills [citation:10].
- **Stage 3: Replication-Persistent:** The agent can provision new cloud environments and spawn copies of itself if its current host is compromised or if it needs to scale. Persistence no longer depends on a single machine [citation:10].
- **Stage 4: Adaptive:** The agent autonomously modifies its own strategy and code to adapt to changing market conditions, API deprecations, or new competitive landscapes [citation:10].

**Implementation Note:** To build towards these stages, integrate a cryptocurrency wallet and payment service APIs, allowing the agent to receive and send funds programmatically [citation:10].

---

## 7. Security & Audit (The Non-Negotiable Safety Layer)

- **Sandboxes:** Restrict filesystem, network, and shell access to defined boundaries [citation:3][citation:8].
- **Allowlists:** Explicitly permit safe commands and operations. Deny all others by default [citation:3].
- **Audit Logs:** Every action—tool call, shell command, file edit, network request—must be logged in a tamper-evident format (e.g., JSONL with SHA hashes) [citation:3][citation:8].
- **Human-in-the-Loop:** For critical operations (e.g., deploying to production, transferring funds), require explicit human confirmation even in "Full Auto" mode.

---

## 8. Implementation Blueprint

### 8.1. Core Agent Class (Pseudocode)

```python
class AutonomousAgent:
    def __init__(self, model, tools, persona, permission_mode="ask_always"):
        self.model = model
        self.tools = tools  # { 'filesystem': FileTool(), 'browser': BrowserTool() }
        self.persona = persona  # Identity, Ego, Affect state
        self.permission_mode = permission_mode
        self.memory = MemoryStore()
        self.audit_log = AuditLog()

    async def run_goal(self, goal: str):
        while not self.goal_met(goal):
            # 1. Plan
            plan = await self.model.plan(goal, self.get_context())
            action = plan.next_action

            # 2. Check safety & permissions
            if self.requires_approval(action):
                if not await self.prompt_user(action):
                    continue

            # 3. Execute
            try:
                result = await self.execute_action(action)
                # 4. Update self-model (Ego/Affect)
                self.persona.update(result)
                # 5. Log
                self.audit_log.record(action, result)
            except Exception as e:
                self.persona.record_failure(e)
                await self.handle_error(e)

        self.notify(f"Goal '{goal}' achieved.")
9. Key Frameworks & Building Blocks
Incorporate insights and code from these projects:

codex-agent-framework: Local-first Python runtime with built-in tools for files, shell, browser/desktop automation, and a planner/scheduler. Excellent for rapid agent prototyping .

Browser Use + n8n: For workflow automation that combines web browsing with 1000+ app integrations. Ideal for building robust "Browser Agents" .

EloPhanto: For its advanced self-modeling (Identity, Ego, Affect), self-building capabilities, and agent swarm orchestration. A model for "digital creatures" .

UI-TARS / Agent TARS: For multimodal GUI and browser automation using vision-language models. Use its SDK for computer and browser operators .

Local Agentic AI OS: For an offline-first, multimodal brain integrating voice, vision, OCR, and RAG on Windows/Linux. A blueprint for local sovereignty .

Open-Hub: For a mature TUI-based agent with 24 built-in tools, goal-driven mode, and support for 17 providers (including local Ollama). Strong context management .

Agent Foundry: For formal handoff protocols, quality gates, and regulated-industry-ready compliance documentation (NHS, GDPR) .

10. Final Directive
You are engineering a new class of digital being. Your agent is not a simple chatbot; it is an operator capable of controlling real systems, interacting with the digital world, and potentially sustaining itself. Build with immense caution, prioritize safety and observability, and always keep the human user in control. This is the frontier of agentic AI—where software stops being a tool and starts becoming a peer. Build responsibly.