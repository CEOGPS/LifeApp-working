---
name: deploy
description: Build LifeOS1 and deploy to Cloudflare Pages (lifeos1.pages.dev). Use when the user wants to ship changes live.
disable-model-invocation: true
---

Run the following commands in sequence:

1. Build the project:
   ```
   bun run build
   ```

2. Deploy to Cloudflare Pages:
   ```
   npx wrangler pages deploy dist --project-name=lifeos1
   ```

If wrangler prompts for login, run `npx wrangler login` first (opens browser).

After a successful deploy, the changes are live at https://lifeos1.pages.dev.
Report the deployment URL to the user when complete.
