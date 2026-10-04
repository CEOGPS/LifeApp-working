/**
 * Integration Catalog — LifeOS1
 * Migrated from Nexus-Connect, Base44-free.
 * Single source of truth for all integration templates.
 */

export interface IntegrationTemplate {
  name: string;
  category: string;
  description: string;
  connection_type: "api_key" | "oauth_pkce";
  base_url: string;
  icon_color: string;
  rotation_frequency_days: number;
  popular?: boolean;
  tags?: string[];
  scopes?: string;
}

export const CATALOG: IntegrationTemplate[] = [
  // ───────────────────────── LLMs ─────────────────────────
  { name: "OpenAI", category: "LLMs", description: "GPT models, embeddings, Assistants, and realtime audio.", connection_type: "api_key", base_url: "https://api.openai.com/v1", icon_color: "from-emerald-500 to-teal-700", rotation_frequency_days: 30, popular: true, tags: ["chat", "embeddings", "vision"] },
  { name: "Anthropic", category: "LLMs", description: "Claude family of conversational and reasoning models.", connection_type: "api_key", base_url: "https://api.anthropic.com/v1", icon_color: "from-orange-500 to-amber-700", rotation_frequency_days: 30, popular: true, tags: ["chat", "reasoning"] },
  { name: "Google Gemini", category: "LLMs", description: "Gemini multimodal models via Google AI Studio.", connection_type: "api_key", base_url: "https://generativelanguage.googleapis.com/v1", icon_color: "from-blue-500 to-indigo-700", rotation_frequency_days: 30, popular: true, tags: ["multimodal", "vision"] },
  { name: "Mistral AI", category: "LLMs", description: "Open-weight and commercial Mistral models.", connection_type: "api_key", base_url: "https://api.mistral.ai/v1", icon_color: "from-rose-500 to-red-700", rotation_frequency_days: 30, tags: ["chat", "open-source"] },
  { name: "Cohere", category: "LLMs", description: "Command models, embeddings, and reranking.", connection_type: "api_key", base_url: "https://api.cohere.ai/v1", icon_color: "from-violet-500 to-purple-700", rotation_frequency_days: 30, tags: ["embeddings", "rerank"] },
  { name: "Groq", category: "LLMs", description: "Ultra-low-latency inference for open models.", connection_type: "api_key", base_url: "https://api.groq.com/openai/v1", icon_color: "from-orange-500 to-red-700", rotation_frequency_days: 30, tags: ["fast-inference"] },
  { name: "Together AI", category: "LLMs", description: "Hosted open-source model inference platform.", connection_type: "api_key", base_url: "https://api.together.xyz/v1", icon_color: "from-slate-500 to-slate-800", rotation_frequency_days: 30, tags: ["inference"] },
  { name: "Perplexity", category: "LLMs", description: "Online LLMs with built-in web search.", connection_type: "api_key", base_url: "https://api.perplexity.ai", icon_color: "from-teal-500 to-cyan-700", rotation_frequency_days: 30, tags: ["search", "chat"] },
  { name: "Hugging Face", category: "LLMs", description: "Inference endpoints for thousands of models.", connection_type: "api_key", base_url: "https://api-inference.huggingface.co", icon_color: "from-yellow-500 to-amber-700", rotation_frequency_days: 45, tags: ["models", "inference"] },
  { name: "Hermes", category: "LLMs", description: "Nous Research Hermes fine-tuned chat models.", connection_type: "api_key", base_url: "https://api.nousresearch.com/v1", icon_color: "from-amber-500 to-orange-700", rotation_frequency_days: 30, tags: ["chat", "fine-tuned"] },
  { name: "NVIDIA", category: "LLMs", description: "NIM API for GPU-accelerated AI model inference.", connection_type: "api_key", base_url: "https://integrate.api.nvidia.com/v1", icon_color: "from-green-500 to-lime-700", rotation_frequency_days: 30, tags: ["inference", "gpu"] },
  { name: "Ollama", category: "LLMs", description: "Run open-source LLMs locally with a simple API.", connection_type: "api_key", base_url: "http://localhost:11434/api", icon_color: "from-slate-500 to-slate-800", rotation_frequency_days: 30, tags: ["local", "open-source"] },

  // ───────────────────────── Emails ─────────────────────────
  { name: "Resend", category: "Emails", description: "Developer-first transactional email API.", connection_type: "api_key", base_url: "https://api.resend.com", icon_color: "from-sky-500 to-blue-700", rotation_frequency_days: 60, popular: true, tags: ["transactional"] },
  { name: "SendGrid", category: "Emails", description: "Email delivery and marketing automation.", connection_type: "api_key", base_url: "https://api.sendgrid.com/v3", icon_color: "from-cyan-500 to-blue-700", rotation_frequency_days: 60, popular: true, tags: ["transactional", "marketing"] },
  { name: "Postmark", category: "Emails", description: "Reliable transactional email delivery.", connection_type: "api_key", base_url: "https://api.postmarkapp.com", icon_color: "from-yellow-500 to-orange-700", rotation_frequency_days: 60, tags: ["transactional"] },
  { name: "Proton Mail", category: "Emails", description: "Encrypted, privacy-first email service.", connection_type: "api_key", base_url: "https://api.proton.me", icon_color: "from-violet-500 to-purple-700", rotation_frequency_days: 60, tags: ["encrypted", "privacy"] },
  { name: "Mailgun", category: "Emails", description: "Powerful email API for developers.", connection_type: "api_key", base_url: "https://api.mailgun.net/v3", icon_color: "from-red-500 to-rose-700", rotation_frequency_days: 60, tags: ["transactional"] },
  { name: "Amazon SES", category: "Emails", description: "Scalable cloud email sending service.", connection_type: "api_key", base_url: "https://email.us-east-1.amazonaws.com", icon_color: "from-orange-500 to-amber-800", rotation_frequency_days: 60, tags: ["transactional", "aws"] },
  { name: "Gmail", category: "Emails", description: "Send and read Gmail via OAuth PKCE.", connection_type: "oauth_pkce", base_url: "https://gmail.googleapis.com", scopes: "https://mail.google.com/", icon_color: "from-red-500 to-rose-700", rotation_frequency_days: 90, popular: true, tags: ["oauth", "inbox"] },
  { name: "Outlook", category: "Emails", description: "Microsoft 365 mail via Graph API.", connection_type: "oauth_pkce", base_url: "https://graph.microsoft.com/v1.0", scopes: "Mail.ReadWrite", icon_color: "from-blue-500 to-sky-700", rotation_frequency_days: 90, tags: ["oauth", "inbox"] },

  // ───────────────────────── Texts ─────────────────────────
  { name: "Twilio", category: "Texts", description: "Programmable SMS, voice, and messaging.", connection_type: "api_key", base_url: "https://api.twilio.com", icon_color: "from-red-500 to-rose-700", rotation_frequency_days: 45, popular: true, tags: ["sms", "voice"] },
  { name: "Vonage", category: "Texts", description: "SMS, voice, and communications APIs.", connection_type: "api_key", base_url: "https://api.nexmo.com", icon_color: "from-violet-500 to-purple-700", rotation_frequency_days: 45, tags: ["sms", "voice"] },
  { name: "MessageBird", category: "Texts", description: "Omnichannel messaging and notifications.", connection_type: "api_key", base_url: "https://rest.messagebird.com", icon_color: "from-blue-500 to-cyan-700", rotation_frequency_days: 45, tags: ["sms", "omnichannel"] },
  { name: "Bandwidth", category: "Texts", description: "Carrier-grade messaging and voice APIs.", connection_type: "api_key", base_url: "https://messaging.bandwidth.com/api/v2", icon_color: "from-emerald-500 to-green-700", rotation_frequency_days: 45, tags: ["sms", "voice"] },
  { name: "Sinch", category: "Texts", description: "Messaging, verification, and voice.", connection_type: "api_key", base_url: "https://api.sinch.com", icon_color: "from-indigo-500 to-blue-700", rotation_frequency_days: 45, tags: ["sms", "verification"] },

  // ───────────────────────── Financial ─────────────────────────
  { name: "Stripe", category: "Financial", description: "Payments, subscriptions, and billing.", connection_type: "api_key", base_url: "https://api.stripe.com/v1", icon_color: "from-indigo-500 to-purple-700", rotation_frequency_days: 30, popular: true, tags: ["payments", "billing"] },
  { name: "Plaid", category: "Financial", description: "Bank account linking and financial data.", connection_type: "api_key", base_url: "https://production.plaid.com", icon_color: "from-green-500 to-emerald-700", rotation_frequency_days: 30, popular: true, tags: ["banking", "data"] },
  { name: "PayPal", category: "Financial", description: "Payments and payouts via PayPal API.", connection_type: "oauth_pkce", base_url: "https://api.paypal.com", scopes: "payments", icon_color: "from-blue-500 to-indigo-700", rotation_frequency_days: 60, popular: true, tags: ["payments", "oauth"] },
  { name: "Coinbase", category: "Financial", description: "Crypto trading and wallet access.", connection_type: "oauth_pkce", base_url: "https://api.coinbase.com", scopes: "wallet:accounts:read", icon_color: "from-blue-600 to-sky-800", rotation_frequency_days: 45, tags: ["crypto", "oauth"] },
  { name: "Square", category: "Financial", description: "Payments, POS, and commerce APIs.", connection_type: "oauth_pkce", base_url: "https://connect.squareup.com/v2", scopes: "PAYMENTS_WRITE", icon_color: "from-slate-700 to-black", rotation_frequency_days: 45, tags: ["payments", "pos"] },
  { name: "QuickBooks", category: "Financial", description: "Accounting and bookkeeping integration.", connection_type: "oauth_pkce", base_url: "https://quickbooks.api.intuit.com", scopes: "com.intuit.quickbooks.accounting", icon_color: "from-green-600 to-emerald-800", rotation_frequency_days: 60, tags: ["accounting", "oauth"] },
  { name: "Wise", category: "Financial", description: "Multi-currency transfers and payouts.", connection_type: "api_key", base_url: "https://api.wise.com", icon_color: "from-teal-500 to-cyan-700", rotation_frequency_days: 45, tags: ["transfers"] },
  { name: "Lemon Squeezy", category: "Financial", description: "Merchant of record for digital products.", connection_type: "api_key", base_url: "https://api.lemonsqueezy.com/v1", icon_color: "from-yellow-400 to-amber-600", rotation_frequency_days: 45, tags: ["payments", "saas"] },

  // ───────────────────────── Browsers ─────────────────────────
  { name: "Puppeteer Cloud", category: "Browsers", description: "Headless browser automation at scale.", connection_type: "api_key", base_url: "https://api.browserless.io", icon_color: "from-amber-500 to-yellow-700", rotation_frequency_days: 60, tags: ["automation", "scraping"] },
  { name: "Browserbase", category: "Browsers", description: "Managed headless browser sessions.", connection_type: "api_key", base_url: "https://api.browserbase.com", icon_color: "from-zinc-500 to-slate-700", rotation_frequency_days: 60, tags: ["automation"] },
  { name: "ScraperAPI", category: "Browsers", description: "Web scraping proxy and rendering API.", connection_type: "api_key", base_url: "https://api.scraperapi.com", icon_color: "from-teal-500 to-cyan-700", rotation_frequency_days: 60, tags: ["scraping", "proxy"] },
  { name: "Bright Data", category: "Browsers", description: "Residential proxies and web unlocker.", connection_type: "api_key", base_url: "https://api.brightdata.com", icon_color: "from-orange-500 to-red-700", rotation_frequency_days: 60, tags: ["proxy", "scraping"] },
  { name: "Apify", category: "Browsers", description: "Actors and scrapers marketplace.", connection_type: "api_key", base_url: "https://api.apify.com/v2", icon_color: "from-green-500 to-emerald-700", rotation_frequency_days: 60, tags: ["scraping", "automation"] },
  { name: "Playwright Cloud", category: "Browsers", description: "Cloud-hosted Playwright test runs.", connection_type: "api_key", base_url: "https://api.playwright.dev", icon_color: "from-slate-500 to-slate-800", rotation_frequency_days: 60, tags: ["testing", "automation"] },

  // ───────────────────────── Creative ─────────────────────────
  { name: "Figma", category: "Creative", description: "Design files, components, and assets.", connection_type: "oauth_pkce", base_url: "https://api.figma.com", scopes: "file_read", icon_color: "from-fuchsia-500 to-pink-700", rotation_frequency_days: 90, popular: true, tags: ["design", "oauth"] },
  { name: "Adobe Firefly", category: "Creative", description: "Generative image and design APIs.", connection_type: "api_key", base_url: "https://firefly-api.adobe.io", icon_color: "from-red-500 to-rose-700", rotation_frequency_days: 45, tags: ["generative", "image"] },
  { name: "Canva", category: "Creative", description: "Design automation and export.", connection_type: "oauth_pkce", base_url: "https://api.canva.com", scopes: "design:content:read", icon_color: "from-cyan-500 to-blue-700", rotation_frequency_days: 90, tags: ["design", "oauth"] },
  { name: "Stability AI", category: "Creative", description: "Stable Diffusion image generation.", connection_type: "api_key", base_url: "https://api.stability.ai/v1", icon_color: "from-purple-500 to-fuchsia-700", rotation_frequency_days: 45, popular: true, tags: ["generative", "image"] },
  { name: "Replicate", category: "Creative", description: "Run and deploy open-source models.", connection_type: "api_key", base_url: "https://api.replicate.com/v1", icon_color: "from-slate-600 to-slate-900", rotation_frequency_days: 45, tags: ["generative", "models"] },
  { name: "Leonardo AI", category: "Creative", description: "AI art and asset generation platform.", connection_type: "api_key", base_url: "https://cloud.leonardo.ai/api", icon_color: "from-indigo-500 to-violet-700", rotation_frequency_days: 45, tags: ["generative", "image"] },
  { name: "Unsplash", category: "Creative", description: "Free high-resolution stock photography API.", connection_type: "api_key", base_url: "https://api.unsplash.com", icon_color: "from-slate-700 to-black", rotation_frequency_days: 90, tags: ["stock", "image"] },

  // ───────────────────────── Development ─────────────────────────
  { name: "GitHub", category: "Development", description: "Repositories, issues, and CI/CD.", connection_type: "oauth_pkce", base_url: "https://api.github.com", scopes: "repo, read:user", icon_color: "from-slate-600 to-slate-800", rotation_frequency_days: 90, popular: true, tags: ["git", "oauth"] },
  { name: "GitLab", category: "Development", description: "Source control and DevOps platform.", connection_type: "oauth_pkce", base_url: "https://gitlab.com/api/v4", scopes: "api", icon_color: "from-orange-500 to-red-700", rotation_frequency_days: 90, tags: ["git", "oauth"] },
  { name: "Bitbucket", category: "Development", description: "Atlassian Git repository hosting.", connection_type: "oauth_pkce", base_url: "https://api.bitbucket.org/2.0", scopes: "repository", icon_color: "from-blue-500 to-sky-700", rotation_frequency_days: 90, tags: ["git", "oauth"] },
  { name: "Vercel", category: "Development", description: "Deployments and project management.", connection_type: "api_key", base_url: "https://api.vercel.com", icon_color: "from-zinc-700 to-black", rotation_frequency_days: 45, popular: true, tags: ["hosting", "deploy"] },
  { name: "Netlify", category: "Development", description: "Build, deploy, and scale web apps.", connection_type: "api_key", base_url: "https://api.netlify.com/api/v1", icon_color: "from-teal-500 to-cyan-700", rotation_frequency_days: 45, tags: ["hosting", "deploy"] },
  { name: "Linear", category: "Development", description: "Issue tracking and project planning.", connection_type: "oauth_pkce", base_url: "https://api.linear.app", scopes: "read, write", icon_color: "from-indigo-500 to-violet-700", rotation_frequency_days: 90, popular: true, tags: ["issues", "oauth"] },
  { name: "Jira", category: "Development", description: "Atlassian project and issue tracking.", connection_type: "oauth_pkce", base_url: "https://api.atlassian.com", scopes: "read:jira-work", icon_color: "from-blue-600 to-indigo-800", rotation_frequency_days: 90, tags: ["issues", "oauth"] },
  { name: "Sentry", category: "Development", description: "Error monitoring and performance tracing.", connection_type: "api_key", base_url: "https://sentry.io/api/0", icon_color: "from-purple-500 to-fuchsia-700", rotation_frequency_days: 60, tags: ["monitoring"] },
  { name: "PostHog", category: "Development", description: "Product analytics and feature flags.", connection_type: "api_key", base_url: "https://app.posthog.com/api", icon_color: "from-blue-500 to-indigo-700", rotation_frequency_days: 60, tags: ["analytics"] },
  { name: "Supabase", category: "Development", description: "Postgres, auth, and storage backend.", connection_type: "api_key", base_url: "https://api.supabase.com/v1", icon_color: "from-emerald-500 to-green-700", rotation_frequency_days: 45, popular: true, tags: ["backend", "database"] },

  // ───────────────────────── Social Media ─────────────────────────
  { name: "X (Twitter)", category: "Social Media", description: "Post and read tweets via API v2.", connection_type: "oauth_pkce", base_url: "https://api.twitter.com/2", scopes: "tweet.read, tweet.write", icon_color: "from-slate-700 to-black", rotation_frequency_days: 60, popular: true, tags: ["social", "oauth"] },
  { name: "LinkedIn", category: "Social Media", description: "Professional posting and profile data.", connection_type: "oauth_pkce", base_url: "https://api.linkedin.com/v2", scopes: "w_member_social", icon_color: "from-blue-600 to-sky-800", rotation_frequency_days: 60, popular: true, tags: ["social", "oauth"] },
  { name: "Meta Graph", category: "Social Media", description: "Facebook and Instagram graph API.", connection_type: "oauth_pkce", base_url: "https://graph.facebook.com/v18.0", scopes: "pages_manage_posts", icon_color: "from-blue-500 to-indigo-700", rotation_frequency_days: 60, popular: true, tags: ["social", "oauth"] },
  { name: "TikTok", category: "Social Media", description: "Content posting and creator insights.", connection_type: "oauth_pkce", base_url: "https://open.tiktokapis.com/v2", scopes: "video.publish", icon_color: "from-slate-800 to-black", rotation_frequency_days: 60, popular: true, tags: ["social", "oauth"] },
  { name: "Instagram", category: "Social Media", description: "Business content and media publishing.", connection_type: "oauth_pkce", base_url: "https://graph.instagram.com", scopes: "instagram_content_publish", icon_color: "from-fuchsia-500 to-purple-700", rotation_frequency_days: 60, tags: ["social", "oauth"] },
  { name: "YouTube", category: "Social Media", description: "Upload and manage video content.", connection_type: "oauth_pkce", base_url: "https://www.googleapis.com/youtube/v3", scopes: "youtube.upload", icon_color: "from-red-500 to-rose-700", rotation_frequency_days: 60, popular: true, tags: ["social", "video"] },
  { name: "Discord", category: "Social Media", description: "Bot and user messaging for communities.", connection_type: "oauth_pkce", base_url: "https://discord.com/api/v10", scopes: "bot, applications.commands", icon_color: "from-indigo-500 to-violet-700", rotation_frequency_days: 90, popular: true, tags: ["community", "oauth"] },
  { name: "Reddit", category: "Social Media", description: "Programmatic posting and moderation.", connection_type: "oauth_pkce", base_url: "https://oauth.reddit.com", scopes: "submit", icon_color: "from-orange-500 to-red-700", rotation_frequency_days: 60, tags: ["social", "oauth"] },

  // ───────────────────────── Marketing ─────────────────────────
  { name: "HubSpot", category: "Marketing", description: "Marketing automation and CRM.", connection_type: "oauth_pkce", base_url: "https://api.hubapi.com", scopes: "contacts", icon_color: "from-orange-500 to-amber-700", rotation_frequency_days: 90, popular: true, tags: ["automation", "oauth"] },
  { name: "Mailchimp", category: "Marketing", description: "Email marketing and audience management.", connection_type: "oauth_pkce", base_url: "https://api.mailchimp.com/3.0", scopes: "campaigns", icon_color: "from-yellow-500 to-amber-700", rotation_frequency_days: 90, popular: true, tags: ["email", "oauth"] },
  { name: "Klaviyo", category: "Marketing", description: "SMS and email marketing automation.", connection_type: "api_key", base_url: "https://a.klaviyo.com/api", icon_color: "from-green-600 to-emerald-800", rotation_frequency_days: 60, tags: ["email", "sms"] },
  { name: "Brevo", category: "Marketing", description: "All-in-one marketing and SMS platform.", connection_type: "api_key", base_url: "https://api.brevo.com/v3", icon_color: "from-rose-500 to-pink-700", rotation_frequency_days: 60, tags: ["email", "sms"] },
  { name: "ActiveCampaign", category: "Marketing", description: "Email and marketing automation.", connection_type: "api_key", base_url: "https://youraccount.api-us1.com/api/3", icon_color: "from-blue-500 to-cyan-700", rotation_frequency_days: 60, tags: ["automation"] },
  { name: "Meta Ads", category: "Marketing", description: "Facebook and Instagram ad management.", connection_type: "oauth_pkce", base_url: "https://graph.facebook.com/v18.0", scopes: "ads_management", icon_color: "from-blue-600 to-indigo-800", rotation_frequency_days: 60, tags: ["ads", "oauth"] },
  { name: "Google Ads", category: "Marketing", description: "Search and display ad campaigns.", connection_type: "oauth_pkce", base_url: "https://googleads.googleapis.com/v15", scopes: "https://www.googleapis.com/auth/adwords", icon_color: "from-amber-500 to-yellow-700", rotation_frequency_days: 60, tags: ["ads", "oauth"] },
  { name: "Buffer", category: "Marketing", description: "Social media scheduling and analytics.", connection_type: "oauth_pkce", base_url: "https://api.bufferapp.com/1", scopes: "update", icon_color: "from-slate-500 to-slate-800", rotation_frequency_days: 90, tags: ["scheduling", "oauth"] },

  // ───────────────────────── CRMs ─────────────────────────
  { name: "Salesforce", category: "CRMs", description: "Customer relationship management cloud.", connection_type: "oauth_pkce", base_url: "https://api.salesforce.com", scopes: "api", icon_color: "from-sky-500 to-blue-700", rotation_frequency_days: 90, popular: true, tags: ["crm", "oauth"] },
  { name: "Zoho CRM", category: "CRMs", description: "Sales and contact management.", connection_type: "oauth_pkce", base_url: "https://www.zohoapis.com/crm/v2", scopes: "ZohoCRM.modules.ALL", icon_color: "from-red-500 to-rose-700", rotation_frequency_days: 90, tags: ["crm", "oauth"] },
  { name: "Pipedrive", category: "CRMs", description: "Sales pipeline and deal tracking.", connection_type: "api_key", base_url: "https://api.pipedrive.com/v1", icon_color: "from-emerald-500 to-green-700", rotation_frequency_days: 60, tags: ["crm", "sales"] },
  { name: "HubSpot CRM", category: "CRMs", description: "Free CRM with contacts and deals.", connection_type: "oauth_pkce", base_url: "https://api.hubapi.com/crm/v3", scopes: "crm.objects.contacts.read", icon_color: "from-orange-500 to-amber-700", rotation_frequency_days: 90, tags: ["crm", "oauth"] },
  { name: "Attio", category: "CRMs", description: "Modern flexible CRM and records.", connection_type: "api_key", base_url: "https://api.attio.com/v2", icon_color: "from-violet-500 to-purple-700", rotation_frequency_days: 60, tags: ["crm"] },
  { name: "Freshsales", category: "CRMs", description: "Freshworks CRM for sales teams.", connection_type: "api_key", base_url: "https://api.freshsales.io/v2", icon_color: "from-rose-500 to-red-700", rotation_frequency_days: 60, tags: ["crm"] },
  { name: "Close", category: "CRMs", description: "Inside sales CRM with calling.", connection_type: "api_key", base_url: "https://api.close.com/api/v1", icon_color: "from-slate-700 to-slate-900", rotation_frequency_days: 60, tags: ["crm", "sales"] },

  // ───────────────────────── PC (Productivity/Cloud) ─────────────────────────
  { name: "Notion", category: "PC", description: "Notes, docs, and databases workspace.", connection_type: "oauth_pkce", base_url: "https://api.notion.com/v1", scopes: "read", icon_color: "from-slate-500 to-slate-800", rotation_frequency_days: 90, popular: true, tags: ["notes", "oauth"] },
  { name: "Dropbox", category: "PC", description: "File storage and sharing.", connection_type: "oauth_pkce", base_url: "https://api.dropboxapi.com/2", scopes: "files.content.read", icon_color: "from-blue-500 to-sky-700", rotation_frequency_days: 90, tags: ["storage", "oauth"] },
  { name: "OneDrive", category: "PC", description: "Microsoft cloud file storage.", connection_type: "oauth_pkce", base_url: "https://graph.microsoft.com/v1.0", scopes: "Files.Read", icon_color: "from-blue-600 to-indigo-800", rotation_frequency_days: 90, tags: ["storage", "oauth"] },
  { name: "Google Drive", category: "PC", description: "Cloud file storage and documents.", connection_type: "oauth_pkce", base_url: "https://www.googleapis.com/drive/v3", scopes: "https://www.googleapis.com/auth/drive", icon_color: "from-emerald-500 to-green-700", rotation_frequency_days: 90, popular: true, tags: ["storage", "oauth"] },
  { name: "Slack", category: "PC", description: "Team messaging and notifications.", connection_type: "oauth_pkce", base_url: "https://slack.com/api", scopes: "chat:write", icon_color: "from-purple-500 to-fuchsia-700", rotation_frequency_days: 90, popular: true, tags: ["messaging", "oauth"] },
  { name: "Microsoft Teams", category: "PC", description: "Chat and collaboration for work.", connection_type: "oauth_pkce", base_url: "https://graph.microsoft.com/v1.0", scopes: "ChannelMessage.ReadWrite", icon_color: "from-indigo-500 to-violet-700", rotation_frequency_days: 90, tags: ["messaging", "oauth"] },
  { name: "Asana", category: "PC", description: "Work and project management.", connection_type: "oauth_pkce", base_url: "https://app.asana.com/api/1.0", scopes: "default", icon_color: "from-rose-500 to-pink-700", rotation_frequency_days: 90, tags: ["tasks", "oauth"] },
  { name: "Trello", category: "PC", description: "Boards, lists, and cards.", connection_type: "oauth_pkce", base_url: "https://api.trello.com/1", scopes: "read, write", icon_color: "from-blue-500 to-sky-700", rotation_frequency_days: 90, tags: ["tasks", "oauth"] },
  { name: "Todoist", category: "PC", description: "Personal task management.", connection_type: "oauth_pkce", base_url: "https://api.todoist.com/rest/v2", scopes: "task:add", icon_color: "from-red-500 to-rose-700", rotation_frequency_days: 90, tags: ["tasks", "oauth"] },
  { name: "ClickUp", category: "PC", description: "All-in-one productivity platform.", connection_type: "oauth_pkce", base_url: "https://api.clickup.com/v2", scopes: "view", icon_color: "from-fuchsia-500 to-purple-700", rotation_frequency_days: 90, tags: ["tasks", "oauth"] },
  { name: "Airtable", category: "PC", description: "Database-spreadsheet hybrid.", connection_type: "oauth_pkce", base_url: "https://api.airtable.com/v0", scopes: "records:read", icon_color: "from-amber-500 to-orange-700", rotation_frequency_days: 90, tags: ["database", "oauth"] },
  { name: "Box", category: "PC", description: "Enterprise cloud content management.", connection_type: "oauth_pkce", base_url: "https://api.box.com/2.0", scopes: "root_readwrite", icon_color: "from-sky-500 to-blue-700", rotation_frequency_days: 90, tags: ["storage", "oauth"] },

  // ───────────────────────── Search Engines ─────────────────────────
  { name: "AOL", category: "Search Engines", description: "Web search and content portal.", connection_type: "api_key", base_url: "https://api.aol.com", icon_color: "from-blue-500 to-indigo-700", rotation_frequency_days: 60, tags: ["search", "portal"] },
  { name: "Brave Browser", category: "Search Engines", description: "Privacy browser with Brave Search API.", connection_type: "api_key", base_url: "https://api.search.brave.com", icon_color: "from-orange-600 to-red-700", rotation_frequency_days: 60, tags: ["search", "browser", "privacy"] },
  { name: "DuckDuckGo", category: "Search Engines", description: "Privacy-focused web search engine.", connection_type: "api_key", base_url: "https://api.duckduckgo.com", icon_color: "from-orange-500 to-amber-700", rotation_frequency_days: 60, tags: ["search", "privacy"] },
  { name: "Google", category: "Search Engines", description: "Search the web via Google Custom Search API.", connection_type: "api_key", base_url: "https://www.googleapis.com/customsearch/v1", icon_color: "from-blue-500 to-red-700", rotation_frequency_days: 60, popular: true, tags: ["search"] },
  { name: "Yahoo", category: "Search Engines", description: "Web search and content portal API.", connection_type: "api_key", base_url: "https://api.yahoo.com", icon_color: "from-purple-600 to-fuchsia-800", rotation_frequency_days: 60, tags: ["search", "portal"] },

  // ───────────────────────── Directories ─────────────────────────
  { name: "Brilliant Directories", category: "Directories", description: "Directory website builder and membership platform.", connection_type: "api_key", base_url: "https://www.brilliantdirectories.com/api", icon_color: "from-cyan-500 to-blue-700", rotation_frequency_days: 60, tags: ["directory", "membership"] },
];

export const CATEGORIES = [
  "All", "LLMs", "Emails", "Texts", "Financial", "Browsers", "Creative",
  "Development", "Social Media", "Marketing", "CRMs", "PC", "Search Engines", "Directories"
];

export const CATEGORY_ICONS: Record<string, string> = {
  "LLMs": "Sparkles",
  "Emails": "Mail",
  "Texts": "MessageSquare",
  "Financial": "CreditCard",
  "Browsers": "Globe",
  "Creative": "Palette",
  "Development": "Code2",
  "Social Media": "Share2",
  "Marketing": "Megaphone",
  "CRMs": "Users",
  "PC": "Monitor",
  "Search Engines": "Search",
  "Directories": "FolderTree",
};