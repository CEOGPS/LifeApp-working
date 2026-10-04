/**
 * OAuth Provider Presets — LifeOS1
 * Migrated from Nexus-Connect, Base44-free.
 * Auto-fills configuration fields for common OAuth providers.
 */

export interface OAuthPreset {
  key: string;
  label: string;
  authorization_url: string;
  token_url: string;
  api_base_url: string;
  scopes: string;
  icon_color: string;
}

export const OAUTH_PRESETS: OAuthPreset[] = [
  {
    key: "google",
    label: "Google",
    authorization_url: "https://accounts.google.com/o/oauth2/v2/auth",
    token_url: "https://oauth2.googleapis.com/token",
    api_base_url: "https://www.googleapis.com",
    scopes: "openid, email, profile",
    icon_color: "from-blue-500 to-red-500",
  },
  {
    key: "github",
    label: "GitHub",
    authorization_url: "https://github.com/login/oauth/authorize",
    token_url: "https://github.com/login/oauth/access_token",
    api_base_url: "https://api.github.com",
    scopes: "repo, read:user",
    icon_color: "from-slate-600 to-slate-900",
  },
  {
    key: "microsoft",
    label: "Microsoft",
    authorization_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    api_base_url: "https://graph.microsoft.com/v1.0",
    scopes: "User.Read, Mail.ReadWrite",
    icon_color: "from-blue-600 to-sky-800",
  },
  {
    key: "facebook",
    label: "Facebook",
    authorization_url: "https://www.facebook.com/v18.0/dialog/oauth",
    token_url: "https://graph.facebook.com/v18.0/oauth/access_token",
    api_base_url: "https://graph.facebook.com/v18.0",
    scopes: "email, public_profile",
    icon_color: "from-blue-500 to-indigo-700",
  },
  {
    key: "apple",
    label: "Apple",
    authorization_url: "https://appleid.apple.com/auth/authorize",
    token_url: "https://appleid.apple.com/auth/token",
    api_base_url: "https://appleid.apple.com",
    scopes: "name, email",
    icon_color: "from-slate-700 to-black",
  },
  {
    key: "slack",
    label: "Slack",
    authorization_url: "https://slack.com/oauth/v2/authorize",
    token_url: "https://slack.com/api/oauth.v2.access",
    api_base_url: "https://slack.com/api",
    scopes: "chat:write, channels:read",
    icon_color: "from-purple-500 to-fuchsia-700",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    authorization_url: "https://www.linkedin.com/oauth/v2/authorization",
    token_url: "https://www.linkedin.com/oauth/v2/accessToken",
    api_base_url: "https://api.linkedin.com/v2",
    scopes: "r_liteprofile, w_member_social",
    icon_color: "from-blue-600 to-sky-800",
  },
  {
    key: "discord",
    label: "Discord",
    authorization_url: "https://discord.com/api/oauth2/authorize",
    token_url: "https://discord.com/api/oauth2/token",
    api_base_url: "https://discord.com/api/v10",
    scopes: "identify, bot",
    icon_color: "from-indigo-500 to-violet-700",
  },
  {
    key: "twitter",
    label: "X (Twitter)",
    authorization_url: "https://twitter.com/i/oauth2/authorize",
    token_url: "https://api.twitter.com/2/oauth2/token",
    api_base_url: "https://api.twitter.com/2",
    scopes: "tweet.read, tweet.write",
    icon_color: "from-slate-800 to-black",
  },
  {
    key: "custom",
    label: "Custom Provider",
    authorization_url: "",
    token_url: "",
    api_base_url: "",
    scopes: "",
    icon_color: "from-slate-500 to-slate-700",
  },
];

export function getOAuthPreset(key: string): OAuthPreset | undefined {
  return OAUTH_PRESETS.find(p => p.key === key);
}