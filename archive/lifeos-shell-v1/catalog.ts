export const PROVIDERS = [
  { id: "google", name: "Google", detail: "Mail and calendar" },
  { id: "microsoft", name: "Microsoft", detail: "Mail and calendar" },
  { id: "slack", name: "Slack", detail: "Workspace" },
  { id: "notion", name: "Notion", detail: "Docs" },
  { id: "github", name: "GitHub", detail: "Code" },
  { id: "spotify", name: "Spotify", detail: "Listening" },
  { id: "meta", name: "Meta", detail: "Pages" },
  { id: "x", name: "X", detail: "Timeline" },
  { id: "stripe", name: "Stripe", detail: "Payments" },
  { id: "calendar", name: "Calendar", detail: "Schedule" },
] as const;

export const CHANNELS = ["Search", "Social", "Email", "Outreach"] as const;
export const MOODS = ["Focus", "Night", "Drive", "Quiet"] as const;

export type ModuleId = "pulse" | "nexus" | "lucid" | "veriton" | "search";
