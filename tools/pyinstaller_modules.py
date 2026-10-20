"""List what PyInstaller must bundle so every module under geotek/modules is found.

Frozen builds cannot scan the package directory, so the registry falls back to the
generated ``geotek/modules/_index.py``. PyInstaller only follows static imports, hence
each module package and its submodules are passed as hidden imports and the i18n
catalogs as data files. A new module needs no spec edit: run this helper in the build.

    python tools/pyinstaller_modules.py            # one PyInstaller option per line
    python tools/pyinstaller_modules.py --check    # fail if the module index is stale
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from geotek.api.registry import module_ids  # noqa: E402


def hidden_imports() -> list[str]:
    """Every module package plus all of its submodules, sorted."""
    from pkgutil import walk_packages

    names = {"geotek.modules._index"}
    for id in module_ids():
        package = __import__(f"geotek.modules.{id}", fromlist=["__path__"])
        names.add(package.__name__)
        names.update(info.name for info in walk_packages(package.__path__, f"{package.__name__}."))
    return sorted(names)


def data_options() -> list[str]:
    """``--add-data`` pairs for module catalogs (source;destination, Windows separator)."""
    sep = ";" if sys.platform == "win32" else ":"
    options = []
    for id in module_ids():
        folder = ROOT / "geotek" / "modules" / id / "i18n"
        if folder.is_dir():
            options.append(f"{folder}{sep}geotek/modules/{id}/i18n")
    return options


def main(argv: list[str]) -> int:
    if "--check" in argv:
        return subprocess.call([sys.executable, str(ROOT / "tools" / "gen_module_index.py"), "--check"])
    for name in hidden_imports():
        print(f"--hidden-import={name}")
    for pair in data_options():
        print(f"--add-data={pair}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
