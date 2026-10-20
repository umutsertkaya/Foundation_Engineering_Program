"""Switch the repo between device mode (local MCP servers) and cloud mode (no MCP).

Usage: python3 tools/set_mode.py device|cloud|status
Copies tools/mode/<mode>/{mcp,settings}.json to .mcp.json and .claude/settings.json
and records the mode in docs/MODE. Does not touch Git.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODES = ("device", "cloud")
MODE_FILE = ROOT / "docs" / "MODE"


def current() -> str:
    return MODE_FILE.read_text(encoding="utf-8").strip() if MODE_FILE.exists() else "device"


def main(argv: list[str]) -> int:
    if len(argv) != 1 or argv[0] not in (*MODES, "status"):
        print(__doc__)
        return 2
    if argv[0] == "status":
        print(current())
        return 0
    mode = argv[0]
    src = ROOT / "tools" / "mode" / mode
    shutil.copyfile(src / "mcp.json", ROOT / ".mcp.json")
    shutil.copyfile(src / "settings.json", ROOT / ".claude" / "settings.json")
    MODE_FILE.write_text(mode + "\n", encoding="utf-8")
    print(f"mode={mode}: .mcp.json, .claude/settings.json, docs/MODE updated (git not touched)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
