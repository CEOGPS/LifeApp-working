---
name: connector-oauth
description: Set up OAuth connector infrastructure. Creates secrets_utils.py with get_oauth_access_token() for fetching OAuth tokens from the backend.
---

# OAuth Connector Setup

OAuth connectors (e.g., Google Drive) require fetching a fresh access token from the backend. The token has ~1 hour lifetime and should be fetched fresh before each use.

## Required Environment Variables

Auto-injected when deployment includes OAuth connectors:
- `WORKSHOP_BACKEND_URL` — Backend API base URL
- `WORKSHOP_DEPLOYMENT_TOKEN` — Authentication token for the backend
- `PREFIX_CONNECTOR_ID` — The OAuth connector's ID (PREFIX = connector's 6-char prefix from Available Connectors)

## Token Endpoint

```
GET {WORKSHOP_BACKEND_URL}/deployments/connectors/{connector_id}/access_token
Authorization: Bearer {WORKSHOP_DEPLOYMENT_TOKEN}
```

Response: `{"access_token": "ya29.a0AfH6SMB..."}`

## Setup: Create `secrets_utils.py`

If `secrets_utils.py` does not exist in the project root, create it:

```python
"""Utility for OAuth access token retrieval."""
import os
import httpx


def get_oauth_access_token(connector_id: str) -> str:
    """Fetch fresh OAuth access token from Modal backend."""
    token = os.environ.get("WORKSHOP_DEPLOYMENT_TOKEN")
    backend_url = os.environ.get("WORKSHOP_BACKEND_URL")

    if not token:
        raise ValueError(
            "WORKSHOP_DEPLOYMENT_TOKEN not set. "
            "Ensure OAuth connectors are included in the deployment."
        )
    if not backend_url:
        raise ValueError(
            "WORKSHOP_BACKEND_URL not set. "
            "Ensure OAuth connectors are included in the deployment."
        )

    response = httpx.get(
        f"{backend_url}/deployments/connectors/{connector_id}/access_token",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()["access_token"]
```

For non-Python applications, implement the same HTTP GET request in your language.
