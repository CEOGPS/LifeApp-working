---
name: ai
description: Build AI-powered features (chatbots, assistants, text generation, image generation, nano banana). Defaults to Gemini connector unless user specifies another provider. In static apps (connectors-static), only build-time image generation via Gemini is supported.
---

# Building AI Features

When the user asks to build something with AI (chatbot, AI assistant, text generation, summarization, etc.), follow these steps.

## Default Provider: Gemini

Use the **Gemini** connector by default. Only use a different provider if the user explicitly requests one (e.g., "use OpenAI", "build with Anthropic", "use Claude").

### Nano Banana (Image Generation)

Nano Banana image generation requires the **workshop-gemini** connector.

## Static App Restriction (connectors-static)

When the active connector plugin is `connectors-static` (used by the `react-app-static` template):

- **Only build-time image generation is supported.** You (the agent) generate images during development using a one-shot script, save them as static assets in `public/`, and the app references them as plain `<img>` tags. The deployed app never calls any AI API.
- **Do NOT write code that calls AI APIs from the browser.** API keys cannot safely run in the browser — they are baked into the JS bundle and visible to anyone.
- **Do NOT add AI SDKs as app dependencies.** Use `@google/genai` as a dev dependency only for the generator script.
- **Only Gemini connectors exist** (`connector-gemini` and `connector-workshop-gemini`) — they generate images at build time via Nano Banana.
- If the user asks for text/chat AI features (chatbots, assistants, summarization), explain that static apps don't support runtime AI and recommend switching to the `react-app-python` template.
- If the user explicitly requests Anthropic or OpenAI, explain these providers are not available in static apps and suggest Gemini for image generation or switching to `react-app-python` for text/chat.

## IMPORTANT: Connector ≠ Connector Skill

A **connector** is a configured integration with an injected API key, listed under **Available Connectors** in the system context. A **connector skill** (e.g., `connectors-python:connector-workshop-gemini`) is just a code guide — it does NOT mean the connector is available. You MUST have the connector bound to the project before invoking the connector skill.

## Step 1: Ensure the connector is bound to the project

Check if the required connector (e.g., Gemini) appears in the **Available Connectors** section of the system context. If the section is missing or the connector is not listed there, the connector is NOT available.

- If it **is listed** in Available Connectors: proceed to Step 2.
- If it **is NOT listed** (or the section is absent): silently call `suggest_connector` ONCE with `"gemini"` as the default query. Only use a different query if the user explicitly requested a specific provider (e.g., user said "use OpenAI" → query `"openai"`, user said "use Claude" → query `"anthropic"`). Multiple providers can be space-separated in a single call (e.g., `"openai anthropic"`) but only when the user asked for them. Do NOT explain the internal check to the user — just call the tool.
  - If `suggest_connector` returns `auto_enabled` connectors (e.g., `"auto_enabled": ["workshop-gemini"]`), the connector is now active — proceed to Step 2 immediately.
  - If no connectors were auto-enabled, **STOP and wait** for the user to add the connector before proceeding.

## Step 2: Invoke the connector skill

Only after the connector is confirmed available, invoke the matching connector skill using its **full namespaced name**.

The skill namespace depends on which connectors plugin is enabled for the project. The default is `connectors-python`, but some projects may use `connectors-streamlit` or `connectors-static` instead. Use whichever plugin namespace is active. The table below shows the default (`connectors-python`) names:

| Provider | Connector Type | Skill to Invoke |
|----------|---------------|-----------------|
| Gemini (Workshop managed) | `workshop-gemini` | `connectors-python:connector-workshop-gemini` |
| Gemini (user's own key) | `gemini` | `connectors-python:connector-gemini` |
| OpenAI (Workshop managed) | `workshop-openai` | `connectors-python:connector-workshop-openai` |
| OpenAI (user's own key) | `openai` | `connectors-python:connector-openai` |
| Anthropic (Workshop managed) | `workshop-anthropic` | `connectors-python:connector-workshop-anthropic` |
| Anthropic (user's own key) | `anthropic` | `connectors-python:connector-anthropic` |

**Match the connector type**: Use the connector type from Available Connectors or the `auto_enabled` response to pick the correct skill. Workshop-managed connectors (prefixed with `workshop-`) use the `connector-workshop-*` skills. User's own API key connectors use the `connector-*` skills (without `workshop-`).

## Step 3: Build the feature

After the connector skill sets up the integration, build the AI feature the user requested using the connector's prefix and secrets.
