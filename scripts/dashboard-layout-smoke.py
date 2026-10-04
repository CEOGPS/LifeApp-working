#!/usr/bin/env python3
"""Smoke-check dashboard layout files exist and key exports."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
checks = [
    ROOT / "src/components/lifeos/panels/DashboardPanel.jsx",
    ROOT / "src/components/lifeos/dashboard/DashboardWidgets.jsx",
    ROOT / "src/lib/GlobalPlaybackContext.jsx",
    ROOT / "src/lib/dashboard/financeDashSync.js",
]
text = (ROOT / "src/components/lifeos/panels/DashboardPanel.jsx").read_text(encoding="utf-8")
needles = ["RailColumn", "YouTubeDashboard", "Calendar7Day", "AIMonitorPanel", "AIInsightsPanel", "MusicPlaylistMini"]
missing = [n for n in needles if n not in text]
for p in checks:
    assert p.exists(), p
assert not missing, f"DashboardPanel missing: {missing}"
assert "YouTubePlayer />" not in text, "duplicate YouTubePlayer still in grid"
print("dashboard-layout-smoke: PASS")