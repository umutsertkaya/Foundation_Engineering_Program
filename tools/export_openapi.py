"""Export the deterministic GeoTek contract, runnable from any working directory."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from geotek.api.app import create_app  # noqa: E402

OUTPUT = ROOT / "docs" / "contracts" / "openapi.json"


def export_openapi(path: Path = OUTPUT) -> dict:
    """Write UTF-8 JSON with two-space indentation, LF newlines and no timestamps."""
    spec = create_app().openapi()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(spec, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
                    encoding="utf-8", newline="\n")
    return spec


if __name__ == "__main__":
    export_openapi()
    print(OUTPUT)
