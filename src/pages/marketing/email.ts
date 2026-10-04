import type { EmailSendResult } from "./MarketingPanel.types";

export interface SendArgs {
  to: string;
  from: { name: string; email: string };
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface EmailProvider {
  name: "resend" | "sendgrid" | "mailchimp";
  send(args: SendArgs): Promise<EmailSendResult>;
}

/** Resend — https://resend.com/docs/api-reference/emails/send-email */
function resendProvider(apiKey: string): EmailProvider {
  return {
    name: "resend",
    async send(args) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${args.from.name} <${args.from.email}>`,
          to: [args.to],
          subject: args.subject,
          html: args.html,
          text: args.text,
          reply_to: args.replyTo,
          headers: args.headers,
        }),
      });
      const data = await r.json().catch(() => ({}));
      return r.ok
        ? { ok: true, provider: "resend", messageId: (data as { id?: string }).id }
        : { ok: false, provider: "resend", error: (data as { message?: string }).message ?? `HTTP ${r.status}` };
    },
  };
}

/** SendGrid — https://docs.sendgrid.com/api-reference/mail-send/mail-send */
function sendgridProvider(apiKey: string): EmailProvider {
  return {
    name: "sendgrid",
    async send(args) {
      const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: args.to }] }],
          from: { email: args.from.email, name: args.from.name },
          reply_to: args.replyTo ? { email: args.replyTo } : undefined,
          subject: args.subject,
          content: [
            { type: "text/plain", value: args.text },
            { type: "text/html", value: args.html },
          ],
          headers: args.headers,
        }),
      });
      if (r.status === 202) {
        return { ok: true, provider: "sendgrid", messageId: r.headers.get("x-message-id") ?? undefined };
      }
      const data = await r.json().catch(() => ({}));
      return { ok: false, provider: "sendgrid", error: (data as { errors?: { message: string }[] }).errors?.[0]?.message ?? `HTTP ${r.status}` };
    },
  };
}

/**
 * Provider selection — from env or user config.
 * NEVER ship a hardcoded key. Keys live in a Settings UI → secure backend.
 */
export function getProvider(): EmailProvider | null {
  const key = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_RESEND_KEY;
  if (key) return resendProvider(key);
  const sg = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SENDGRID_KEY;
  if (sg) return sendgridProvider(sg);
  return null;
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

export function addTracking(html: string, campaignId: string, recipientId: string): string {
  const pixel = `<img src="/api/email/open?c=${encodeURIComponent(campaignId)}&r=${encodeURIComponent(recipientId)}" width="1" height="1" alt="" />`;
  const rewriteLinks = html.replace(/href="(https?:[^"]+)"/g, (_m, url: string) =>
    `href="/api/email/click?c=${encodeURIComponent(campaignId)}&r=${encodeURIComponent(recipientId)}&u=${encodeURIComponent(url)}"`
  );
  return rewriteLinks.replace(/<\/body>/i, `${pixel}</body>`) + (rewriteLinks.includes("</body>") ? "" : pixel);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}