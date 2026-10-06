---
name: OAuth / OIDC
description: Authorization code with PKCE, token lifecycle, and provider setup for Google, Facebook, GitHub, TikTok, X, LinkedIn, Microsoft, and Supabase. Never store access tokens in the browser.
---

# OAuth engineering

Use this when connecting a provider. LifeOS already starts Google, Facebook, and Spotify through the Integrations panel. Do not build a second login, and do not store access tokens, refresh tokens, or ID tokens in localStorage.

## Rules

1. Authorization Code with PKCE only. No implicit flow. No tokens in the page.
2. Access tokens stay short-lived. Refresh on the server, never in the dock.
3. Check issuer, audience, expiry, and nonce before trusting an ID token.
4. State must be random and single-use. Reject a callback whose state does not match.
5. Ask only for the scopes the panel needs.
6. Never print a token in chat, logs, or notes.
7. If the provider is not connected, say which key or redirect is missing. Do not invent a session.

## Provider endpoints

| Provider | Authorize | Token |
| --- | --- | --- |
| Google | https://accounts.google.com/o/oauth2/v2/auth | https://oauth2.googleapis.com/token |
| Facebook | https://www.facebook.com/v18.0/dialog/oauth | https://graph.facebook.com/v18.0/oauth/access_token |
| GitHub | https://github.com/login/oauth/authorize | https://github.com/login/oauth/access_token |
| TikTok | https://www.tiktok.com/v2/auth/authorize/ | https://open-api.tiktok.com/oauth/access_token/ |
| LinkedIn | https://www.linkedin.com/oauth/v2/authorization | https://www.linkedin.com/oauth/v2/accessToken |
| X | https://twitter.com/i/oauth2/authorize | https://api.twitter.com/2/oauth2/token |
| Microsoft | https://login.microsoftonline.com/common/oauth2/v2.0/authorize | https://login.microsoftonline.com/common/oauth2/v2.0/token |

Redirects must be an allowlisted LifeOS URL. Supabase may host the code exchange. The dock does not exchange codes itself.

## When asked to connect one

Say the exact redirect to register, the scopes, and whether that provider is already on the Integrations panel. Do not claim the user is signed in unless the board shows a connected account.
