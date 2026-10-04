---
name: connector-github
description: Set up GitHub connector for authenticated git operations using HTTPS token
---

# GitHub Connector

Set up and use the GitHub connector for authenticated git operations.

If a GitHub Connector is available (listed in "Available Connectors" in system prompt), use it. Otherwise, prompt the user to set up a GitHub Connector in Hub (instead of asking for secret directly).

## Setup

No package installation needed — git is built-in.

## Configure Secrets

When adding a git remote, ALWAYS use HTTPS URL with token (never SSH):

1. **Find the connector's secret key**: Check "Available Connectors" in system prompt for the exact secret key name (e.g., `PREFIX_GITHUB_TOKEN`)
2. **Use that exact secret key**: Replace `{GITHUB_CONNECTOR_TOKEN}` with the actual secret key from step 1

## Implementation

```bash
git remote add origin https://{GITHUB_CONNECTOR_TOKEN}@github.com/{REPO-OWNER}/{REPO-NAME}
```
