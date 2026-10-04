import type { CSSProperties } from "react";

export type Priority = "critical" | "high" | "medium" | "low";
export type Severity = "Critical" | "High" | "Medium" | "Low";
export type ListingStatus = "Unclaimed" | "Claimed" | "Active" | "Needs Update";
export type CampaignStatus = "Draft" | "Scheduled" | "Sending" | "Sent" | "Paused" | "Failed";
export type NudgeKind = "message" | "birthday" | "reconnect" | "referral" | "voicenote";
export type PersonType = "Family" | "Business" | "Personal";

export interface BusinessInfo {
  businessName: string;
  category: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  hours: string;
  email: string;
  description: string;
  tagline: string;
}

export interface ListingDef {
  name: string;
  icon: string;
  url: string;
  color: string;
  priority: Priority;
}

export interface ListingSnapshot {
  listingName: string;
  capturedAt: number;
  name?: string;
  phone?: string;
  address?: string;
  website?: string;
  hours?: string;
  rawSnippet?: string;
}

export interface ListingRecord {
  name: string;
  status: ListingStatus;
  snapshots: ListingSnapshot[];
  lastPushedAt?: number;
  lastGuideAt?: number;
}

export interface OpportunityItem {
  name: string;
  url: string;
  da?: number;
  priority: Priority;
  reason: string;
  icon?: string;
  claimed?: boolean;
}

export interface OpportunityRun {
  id: string;
  company: string;
  scannedAt: number;
  items: OpportunityItem[];
}

export interface NapIssue {
  severity: Severity;
  field: string;
  issue: string;
  fix: string;
  icon?: string;
}

export interface NapScanResult {
  id: string;
  scannedAt: number;
  score: number;
  grade: string;
  issues: NapIssue[];
  strengths: string[];
  napRisks: string[];
  fieldDiffs: NapFieldDiff[];
}

export interface NapFieldDiff {
  field: string;
  canonical: string;
  seen: string;
  listing: string;
  severity: Severity;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  createdAt: number;
  scheduledAt?: number;
  sentAt?: number;
  audience: CampaignAudience;
  stats: CampaignStats;
  provider?: "resend" | "sendgrid" | "mailchimp";
  previewText?: string;
  fromName?: string;
  fromEmail?: string;
}

export interface CampaignAudience {
  kinds: PersonType[];
  tags: string[];
  minScore: number;
  maxScore: number;
  emailOnly: boolean;
}

export interface CampaignStats {
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
}

export interface Person {
  id: string;
  name: string;
  type: PersonType;
  subtype: string;
  email?: string;
  phone?: string;
  company?: string;
  lastContact?: string;
  tags: string[];
  notes?: string;
  birthday?: string;
  photo?: string;
  kpi?: { connect?: number; support?: number; milestone?: string };
  stage?: string;
  value?: string;
  favorites?: { food?: string; [k: string]: string | undefined };
  _raw?: unknown;
}

export interface ScoredPerson extends Person {
  capitalScore: number;
  scoreReason: string;
  scoreBreakdown: { label: string; delta: number }[];
}

export interface ScoreOverride {
  personId: string;
  score: number;
  reason?: string;
  at: number;
}

export interface ActivityEntry {
  id: string;
  at: number;
  icon: string;
  label: string;
  color: string;
  meta?: Record<string, unknown>;
}

export interface SeoTarget {
  company: string;
  website: string;
  industry: string;
  location: string;
}

export interface EmailSendResult {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

export interface CardStyle extends CSSProperties {}