"""AST-based import boundaries for the modular backend."""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEOTEK = ROOT / "geotek"

# Non-module files allowed to import geotek.modules (relative to ROOT, posix).
# Anything under tools/ is allowed too (generators, scaffolding).
MODULES_IMPORTERS_ALLOWLIST = {
    "geotek/api/registry.py",  # discovery: iter_modules + import_module + _index fallback
}


def _dotted(path: Path) -> tuple[str, bool]:
    """Return the dotted module name of a file and whether it is a package __init__."""
    parts = list(path.relative_to(ROOT).with_suffix("").parts)
    is_pkg = parts[-1] == "__init__"
    if is_pkg:
        parts.pop()
    return ".".join(parts), is_pkg


def imported_modules(source: str, module: str, is_pkg: bool) -> set[str]:
    """Absolute dotted names imported by a source text (relative imports resolved)."""
    found: set[str] = set()
    package = module.split(".") if is_pkg else module.split(".")[:-1]
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                base = package[: len(package) - (node.level - 1)]
                if node.module:
                    base = [*base, *node.module.split(".")]
                name = ".".join(base)
            else:
                name = node.module or ""
            found.add(name)
            # "from geotek.modules import soil" imports the submodule geotek.modules.soil.
            found.update(f"{name}.{alias.name}" for alias in node.names)
    return found


def _under(name: str, prefix: str) -> bool:
    return name == prefix or name.startswith(prefix + ".")


def module_violations(source: str, module: str, is_pkg: bool, owner: str | None) -> list[str]:
    """Rule check for one file; owner is the module id the file belongs to, or None."""
    problems = []
    for name in sorted(imported_modules(source, module, is_pkg)):
        if owner is not None:
            if _under(name, "geotek.ui"):
                problems.append(f"imports {name} (modules must not import geotek.ui)")
            elif _under(name, "geotek.modules"):
                parts = name.split(".")
                if len(parts) > 2 and parts[2] != owner:
                    problems.append(f"imports {name} (another module)")
    return problems


def _py_files() -> list[Path]:
    return sorted(p for p in GEOTEK.rglob("*.py") if "__pycache__" not in p.parts)


def _owner(path: Path) -> str | None:
    rel = path.relative_to(GEOTEK).parts
    return rel[1] if len(rel) > 2 and rel[0] == "modules" else None


def test_modules_do_not_import_other_modules_or_ui():
    problems = []
    for path in _py_files():
        owner = _owner(path)
        if owner is None:
            continue
        name, is_pkg = _dotted(path)
        for problem in module_violations(path.read_text(encoding="utf-8"), name, is_pkg, owner):
            problems.append(f"{path.relative_to(ROOT).as_posix()}: {problem}")
    assert not problems, "\n".join(problems)


def test_geotek_modules_imported_only_from_allowed_places():
    problems = []
    for path in _py_files():
        rel = path.relative_to(ROOT).as_posix()
        if _owner(path) is not None or rel.startswith("geotek/modules/"):
            continue
        if rel in MODULES_IMPORTERS_ALLOWLIST:
            continue
        name, is_pkg = _dotted(path)
        hits = [n for n in imported_modules(path.read_text(encoding="utf-8"), name, is_pkg)
                if _under(n, "geotek.modules")]
        if hits:
            problems.append(f"{rel}: imports {sorted(hits)}")
    assert not problems, "\n".join(problems)


def test_allowlist_has_no_stale_entries():
    for rel in MODULES_IMPORTERS_ALLOWLIST:
        path = ROOT / rel
        assert path.is_file(), rel
        name, is_pkg = _dotted(path)
        assert any(_under(n, "geotek.modules")
                   for n in imported_modules(path.read_text(encoding="utf-8"), name, is_pkg)), rel


def test_rules_detect_violations():
    check = lambda src, mod="geotek.modules.soil.api", pkg=False, owner="soil": module_violations(src, mod, pkg, owner)  # noqa: E731
    assert check("import geotek.modules.walls.api")
    assert check("from geotek.modules.walls import api")
    assert check("from geotek.modules import walls")
    assert check("from ..walls import api")
    assert check("from ...ui import main")
    assert check("import geotek.ui.app")
    assert check("from geotek import ui")
    assert not check("from geotek.modules.soil import schemas")
    assert not check("from . import schemas")
    assert not check("from geotek.core import errors")
    # package __init__ resolves relative imports against itself
    assert check("from ..sheet_pile import x", "geotek.modules.soil", True)
