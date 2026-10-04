// src/pages/aihub/AIHubPage.tsx
// ============================================================================
// AI Hub — shell
//
// Tab router for the nine sections. Lazy-loads each section on first visit.
// Only state here is the active tab. No storage reads, no side effects.
// Sections are self-contained; they each own their persistence.
// ============================================================================

import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Zap,
  Users,
  MessageSquare,
  Cloud,
  Cpu,
  Sparkles,
  Network,
  ClipboardList,
} from "lucide-react";
import { C } from "@/lib/palette";
import type { HubSection } from "./types";
import { loadAgents } from "./storage";

// ── Lazy sections ────────────────────────────────────────────────────────────

const ErebusSection = lazy(() => import("./ErebusSection"));
const KranosSection = lazy(() => import("./KranosSection"));
const AgentsSection = lazy(() => import("./AgentsSection"));
const MessagingSection = lazy(() => import("./MessagingSection"));
const WorkersSection = lazy(() => import("./WorkersSection"));
const HermesSection = lazy(() => import("./HermesSection"));
const QwenSection = lazy(() => import("./QwenSection"));
const HierarchySection = lazy(() => import("./HierarchySection"));
const AssignmentMonitorSection = lazy(
  () => import("./AssignmentMonitorSection"),
);

// ── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  id: HubSection;
  label: string;
  icon: React.ReactNode;
  group: "primary" | "models" | "ops";
}

const TABS: TabDef[] = [
  { id: "erebus", label: "Erebus", icon: <Zap size={13} />, group: "primary" },
  { id: "kranos", label: "Kranos", icon: <Zap size={13} />, group: "primary" },
  { id: "agents", label: "Agents", icon: <Bot size={13} />, group: "primary" },
  { id: "hierarchy", label: "Hierarchy", icon: <Network size={13} />, group: "primary" },
  { id: "hermes", label: "Hermes", icon: <Cpu size={13} />, group: "models" },
  { id: "qwen", label: "Qwen", icon: <Sparkles size={13} />, group: "models" },
  { id: "messaging", label: "Messaging", icon: <MessageSquare size={13} />, group: "ops" },
  { id: "workers", label: "Workers", icon: <Cloud size={13} />, group: "ops" },
  { id: "assignments", label: "Assignments", icon: <ClipboardList size={13} />, group: "ops" },
];

// ── Loading fallback ─────────────────────────────────────────────────────────

function SectionFallback() {
  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        color: C.muted,
        fontSize: 12,
      }}
    >
      Loading section…
    </div>
  );
}

// ── Error fallback ───────────────────────────────────────────────────────────

interface BoundaryState {
  hasError: boolean;
  message: string;
}

class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): BoundaryState {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }

  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error("[AIHub] Section crashed:", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            margin: 20,
            background: "rgba(255,79,94,0.06)",
            border: `1px solid ${C.red}44`,
            borderRadius: 12,
            color: C.red,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            This section crashed.
          </div>
          <div style={{ color: C.t2 }}>{this.state.message}</div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{
              marginTop: 12,
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(255,79,94,0.15)",
              border: `1px solid ${C.red}66`,
              color: C.red,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AIHubPage() {
  const [active, setActive] = useState<HubSection>("erebus");
  const [agentCount, setAgentCount] = useState<number>(0);

  // Read agent count once for the header. Not reactive on purpose — the
  // header is a summary, not a live monitor. Refreshing requires a tab switch
  // or page reload.
  useEffect(() => {
    try {
      const map = loadAgents();
      setAgentCount(Object.keys(map).length);
    } catch {
      setAgentCount(0);
    }
  }, []);

  // Recompute agent count when switching tabs so it stays roughly in sync
  // after edits in the Agents section.
  useEffect(() => {
    try {
      const map = loadAgents();
      setAgentCount(Object.keys(map).length);
    } catch {
      // ignore
    }
  }, [active]);

  const groups = useMemo(
    () => ({
      primary: TABS.filter((t) => t.group === "primary"),
      models: TABS.filter((t) => t.group === "models"),
      ops: TABS.filter((t) => t.group === "ops"),
    }),
    [],
  );

  return (
    <div
      style={{
        height: "100%",
        minHeight: "100vh",
        background: "#050505",
        color: C.text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "14px 20px 0 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          background: "#07080f",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <Bot size={18} style={{ color: "#9b72cf" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              AI Hub
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {agentCount} agent{agentCount === 1 ? "" : "s"} · skins, voice,
              knowledge, hierarchy, assignments, bridges, workers
            </div>
          </div>
          <a
            href="/dashboard"
            style={{
              fontSize: 11,
              color: C.t2,
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            ← Back to app
          </a>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            paddingBottom: 12,
          }}
        >
          <TabGroup
            label="Primary"
            tabs={groups.primary}
            active={active}
            onSelect={setActive}
          />
          <TabGroup
            label="Models"
            tabs={groups.models}
            active={active}
            onSelect={setActive}
          />
          <TabGroup
            label="Ops"
            tabs={groups.ops}
            active={active}
            onSelect={setActive}
          />
        </div>
      </header>

      {/* Body */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        <SectionErrorBoundary>
          <Suspense fallback={<SectionFallback />}>
            {active === "erebus" && <ErebusSection />}
            {active === "kranos" && <KranosSection />}
            {active === "agents" && <AgentsSection />}
            {active === "hierarchy" && <HierarchySection />}
            {active === "hermes" && <HermesSection />}
            {active === "qwen" && <QwenSection />}
            {active === "messaging" && <MessagingSection />}
            {active === "workers" && <WorkersSection />}
            {active === "assignments" && <AssignmentMonitorSection />}
          </Suspense>
        </SectionErrorBoundary>
      </main>
    </div>
  );
}

// ── Tab group ────────────────────────────────────────────────────────────────

interface TabGroupProps {
  label: string;
  tabs: TabDef[];
  active: HubSection;
  onSelect: (id: HubSection) => void;
}

function TabGroup({ label, tabs, active, onSelect }: TabGroupProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.dim,
          marginRight: 2,
        }}
      >
        {label}
      </span>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 11px",
              borderRadius: 8,
              border: `1px solid ${isActive ? "#9b72cf" : "rgba(255,255,255,0.08)"}`,
              background: isActive
                ? "rgba(155,114,207,0.15)"
                : "rgba(255,255,255,0.03)",
              color: isActive ? "#c4a2f5" : C.t2,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .12s",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}