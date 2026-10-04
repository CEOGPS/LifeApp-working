"""ClickUp tasks for Erebus. Needs CLICKUP_API_KEY."""
import os
import httpx

KEY = os.getenv("CLICKUP_API_KEY", "")


async def list_tasks(list_id: str = "") -> str:
    if not KEY:
        return "[CLICKUP] CLICKUP_API_KEY is not set"
    list_id = list_id or os.getenv("CLICKUP_LIST_ID", "")
    if not list_id:
        return "[CLICKUP] CLICKUP_LIST_ID is not set"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"https://api.clickup.com/api/v2/list/{list_id}/task",
            headers={"Authorization": KEY},
            params={"page": 0},
        )
        r.raise_for_status()
        tasks = r.json().get("tasks", [])
    names = [t.get("name", "") for t in tasks[:12]]
    return "[CLICKUP] " + (", ".join(names) if names else "no tasks")
