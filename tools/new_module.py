"""Create matching backend and web module packages without overwriting files."""

from __future__ import annotations

import argparse
import ast
import json
import keyword
import re
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[1]
RESERVED_IDS = frozenset({
    "api", "app", "codes", "common", "components", "config", "constants", "core",
    "data", "engine", "errors", "health", "i18n", "io", "jobs", "launcher", "library",
    "m", "models", "module_state", "modules",
    "pages", "plotting", "project", "registry", "services", "session", "settings",
    "schemas", "shared", "shell", "start", "structures", "test", "tools", "ui", "units",
})


def default_order(root: Path) -> int:
    """Read literal manifest orders without importing or executing module code."""
    orders: list[int] = []
    for path in sorted((root / "geotek/modules").glob("*/__init__.py")):
        if path.parent.name.startswith("_"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in tree.body:
            if not isinstance(node, (ast.Assign, ast.AnnAssign)):
                continue
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            if not any(isinstance(target, ast.Name) and target.id == "MANIFEST"
                       for target in targets):
                continue
            if not isinstance(node.value, ast.Call):
                raise ValueError(f"Cannot read MANIFEST order in {path}")
            order = next((item.value for item in node.value.keywords if item.arg == "order"), None)
            try:
                value = ast.literal_eval(order) if order is not None else None
            except (ValueError, TypeError):
                value = None
            if type(value) is not int:
                raise ValueError(f"MANIFEST order must be a literal integer in {path}")
            orders.append(value)
    return max(orders) + 10 if orders else 10


def scaffold(
    module_id: str,
    root: Path = ROOT,
    *,
    title_tr: str | None = None,
    title_en: str | None = None,
    order: int | None = None,
    icon: str = "tool",
) -> list[Path]:
    """Generate one module; refresh the index only when targeting this repository."""
    if re.fullmatch(r"[a-z][a-z0-9_]*", module_id) is None:
        raise ValueError(f"Invalid module id: {module_id!r}")
    root = Path(root).resolve()
    core_names = {path.stem for path in (root / "geotek/core").glob("*.py")}
    if module_id in RESERVED_IDS or module_id in core_names or keyword.iskeyword(module_id):
        raise ValueError(f"Reserved module id: {module_id!r}")
    backend = root / "geotek/modules" / module_id
    web = root / "web/src/modules" / module_id
    for path in (backend, web):
        if path.exists() or path.is_symlink():
            raise FileExistsError(f"Module path already exists: {path}")
    if re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", icon) is None:
        raise ValueError("Icon must be a Tabler kebab-case name, for example 'tool' or 'chart-bar'")
    if order is None:
        order = default_order(root)
    if type(order) is not int:
        raise ValueError("Order must be an integer")
    title_tr = title_tr if title_tr is not None else module_id.replace("_", " ").title()
    title_en = title_en if title_en is not None else module_id.replace("_", " ").title()
    for title in (title_tr, title_en):
        if not title.strip() or "{{" in title or "}}" in title:
            raise ValueError("Titles must be non-empty and use single-brace interpolation")
    icon_component = "Icon" + "".join(part.capitalize() for part in icon.split("-"))
    files: dict[Path, str] = {}

    def add(base: Path, name: str, source: str) -> None:
        files[base / name] = dedent(source).lstrip("\n")

    add(backend, "__init__.py", f'''
        """Module metadata and router registration."""

        from __future__ import annotations

        from geotek.core.modules import ModuleManifest
        from .api import router

        MANIFEST = ModuleManifest(
            id="{module_id}",
            version="0.1.0",
            title_key="{module_id}.title",
            description_key="{module_id}.description",
            icon="{icon}",
            order={order},
            router=router,
        )
    ''')
    add(backend, "api.py", f'''
        """Module routes mounted by the registry at /api/m/{module_id}."""

        from __future__ import annotations

        from typing import NoReturn

        from fastapi import APIRouter

        from geotek.api import schemas as dto
        from geotek.api.common import ERROR_RESPONSES, not_implemented


        def router() -> APIRouter:
            """Build a fresh router with a placeholder calculation endpoint."""
            api = APIRouter(responses=ERROR_RESPONSES)

            @api.post(
                "/run", response_model=dto.JobRef, status_code=202,
                operation_id="{module_id}_run",
            )
            def run() -> NoReturn:
                """Reserve the workflow until its calculation is implemented."""
                not_implemented()

            return api
    ''')
    for lang, title, description, home in (
        ("tr", title_tr, "Bu modülün hesaplama ekranları hazırlanıyor.", "Ana sayfa"),
        ("en", title_en, "Calculation screens for this module are being prepared.", "Home"),
    ):
        catalog = {
            f"{module_id}.title": title,
            f"{module_id}.description": description,
            f"{module_id}.nav.home": home,
            f"{module_id}.home.heading": title,
        }
        files[backend / f"i18n/{lang}.json"] = (
            json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
        )
    add(web, "manifest.ts", f'''
        import {{ {icon_component} }} from "@tabler/icons-react";
        import type {{ WebModuleManifest }} from "../../shared/moduleTypes";
        import Root from "./Root";

        export const manifest: WebModuleManifest = {{
          id: "{module_id}",
          version: "0.1.0",
          titleKey: "{module_id}.title",
          descriptionKey: "{module_id}.description",
          icon: {icon_component},
          order: {order},
          Root,
          nav: [{{ path: "", labelKey: "{module_id}.nav.home", end: true }}],
        }};
    ''')
    add(web, "Root.tsx", '''
        import { Navigate, Route, Routes } from "react-router-dom";
        import { HomePage } from "./pages/HomePage";

        export default function Root() {
          return (
            <Routes>
              <Route index element={<HomePage />} />
              <Route path="*" element={<Navigate to="" replace />} />
            </Routes>
          );
        }
    ''')
    add(web, "pages/HomePage.tsx", f'''
        import {{ Stack, Text, Title }} from "@mantine/core";
        import {{ useTranslation }} from "react-i18next";

        export function HomePage() {{
          const {{ t }} = useTranslation();
          return (
            <Stack gap="md">
              <Title order={{3}}>{{t("{module_id}.home.heading")}}</Title>
              <Text>{{t("{module_id}.description")}}</Text>
            </Stack>
          );
        }}
    ''')
    add(web, "api.ts", f'''
        import {{ request }} from "../../shared/api/http";
        import type {{ JobRef }} from "../../shared/api/types";

        export function run_{module_id}(): Promise<JobRef> {{
          return request<JobRef>("POST", "/m/{module_id}/run");
        }}
    ''')
    add(web, "mock.ts", f'''
        import {{ NOT_HANDLED, type MockHandler }} from "../../shared/api/mock/dispatcher";

        const PREFIX = "/m/{module_id}";

        const handle: MockHandler = (method, path) => {{
          if (method.toUpperCase() !== "POST" || path.split("?")[0] !== `${{PREFIX}}/run`) {{
            return NOT_HANDLED;
          }}
          return {{
            status: 501,
            data: {{
              code: "not_implemented",
              message: "This operation is not implemented.",
              details: {{}},
              missing_factors: [],
            }},
          }};
        }};

        export const mock = {{ prefix: PREFIX, handle }};
    ''')
    add(web, f"__tests__/{module_id}.test.tsx", f'''
        import {{ MantineProvider }} from "@mantine/core";
        import {{ cleanup, render, screen }} from "@testing-library/react";
        import {{ afterEach, describe, expect, it }} from "vitest";
        import i18n from "../../../app/i18n";
        import {{ HomePage }} from "../pages/HomePage";

        afterEach(cleanup);

        describe("{module_id} home", () => {{
          it("renders the translated placeholder heading", () => {{
            render(<MantineProvider><HomePage /></MantineProvider>);
            expect(screen.getByRole("heading", {{
              name: i18n.t("{module_id}.home.heading"),
            }})).toBeInTheDocument();
          }});
        }});
    ''')
    for path, source in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(source)
    if root == ROOT:
        subprocess.run([sys.executable, str(ROOT / "tools/gen_module_index.py")], check=True)
    return list(files)


def main(argv: list[str] | None = None) -> int:
    """Parse CLI options and print the remaining integration checks."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("id")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--title-tr")
    parser.add_argument("--title-en")
    parser.add_argument("--order", type=int)
    parser.add_argument("--icon", default="tool", help="Tabler kebab-case icon name")
    args = parser.parse_args(argv)
    try:
        paths = scaffold(args.id, args.root, title_tr=args.title_tr, title_en=args.title_en,
                         order=args.order, icon=args.icon)
    except (ValueError, OSError, SyntaxError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Error: {error}\n")
    print(f"Created {len(paths)} files for {args.id} under {args.root.resolve()}")
    print("Next steps (run from the target repository root):")
    if args.root.resolve() != ROOT:
        print("- Regenerate the index: python tools/gen_module_index.py")
    print("- Routes were added: python tools/export_openapi.py; npm --prefix web run gen:api")
    print("- Update the pinned module list in web/src/test/module_paths.test.ts")
    print("- Review tr/en i18n keys, translations and interpolation")
    print("- Run Python tests, npm --prefix web run test, typecheck and build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
