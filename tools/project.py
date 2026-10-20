"""Small, dependency-free entry point for repository status, task briefs and checks."""

from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TASK_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*\Z")
RESERVED_NAMES = {"CON", "PRN", "AUX", "NUL"} | {
    f"{prefix}{number}" for prefix in ("COM", "LPT") for number in range(1, 10)
}
QUICK_TESTS = (
    "tests/unit/test_module_boundaries.py",
    "tests/unit/test_module_manifests.py",
    "tests/unit/test_module_registry.py",
    "tests/unit/test_new_module.py",
    "tests/unit/test_project_tools.py",
    "tests/unit/test_code_map.py",
    "tests/unit/test_code_map_view.py",
)


@dataclass(frozen=True)
class Step:
    name: str
    tool: str
    args: tuple[str, ...]


def check_steps(profile: str, root: Path) -> list[Step]:
    """Describe only the checks requested; never generate files or install dependencies."""
    index = Step("module-index", "python", ("tools/gen_module_index.py", "--check"))
    code_map = Step("code-map", "python", ("tools/gen_code_map.py", "--check"))
    quick_python = Step("python-boundaries", "python", ("-m", "pytest", "-q", *QUICK_TESTS))
    python = Step("python-tests", "python", ("-m", "pytest", "-q"))
    prefix = ("--prefix", str(root / "web"), "run")
    typecheck = Step("web-typecheck", "npm", (*prefix, "typecheck"))
    web_tests = Step("web-tests", "npm", (*prefix, "test"))
    build = Step("web-build", "npm", (*prefix, "build"))
    profiles = {
        "quick": [
            index, code_map, quick_python, typecheck,
            Step("web-boundaries", "npm", (
                *prefix, "test", "--", "src/test/boundaries.test.ts",
                "src/test/module_paths.test.ts",
            )),
        ],
        "backend": [python],
        "web": [typecheck, web_tests, build],
        "full": [index, code_map, python, typecheck, web_tests, build],
    }
    return profiles[profile]


def project_python(root: Path) -> Path:
    return root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def find_git() -> str | None:
    found = shutil.which("git")
    if found:
        return found
    for directory in (
        os.environ.get("ProgramFiles", r"C:\Program Files"),
        os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
    ):
        for executable in ("cmd/git.exe", "bin/git.exe"):
            candidate = Path(directory) / "Git" / executable
            if candidate.is_file():
                return str(candidate)
    return None


def status(root: Path) -> int:
    print(f"Repository: {root}")
    print("Start: CLAUDE.md | docs/STATUS.md | docs/WORKFLOW.md")
    for label, relative in (("Backend", "geotek/modules"), ("Web", "web/src/modules")):
        directory = root / relative
        names = sorted(
            path.name for path in directory.iterdir()
            if path.is_dir() and not path.name.startswith(("_", "."))
        ) if directory.is_dir() else []
        print(f"{label} module directories ({relative}): {', '.join(names) or '(none)'}")
    git = find_git()
    if git is None:
        print("BLOCKED: Git was not found on PATH or in Program Files/Git.")
        return 2
    failed = False
    for label, args in (
        ("Branch", ("branch", "--show-current")),
        ("Working tree", ("status", "--short", "--branch")),
        ("Worktrees", ("worktree", "list")),
    ):
        print(f"\n{label}:", flush=True)
        try:
            result = subprocess.run(
                [git, *args], cwd=root, shell=False, stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
            )
        except OSError as error:
            print(f"FAILED: {error}")
            failed = True
            continue
        print(result.stdout.strip() or "(detached HEAD or no output)")
        if result.returncode:
            print(f"FAILED: git {' '.join(args)} (exit {result.returncode})")
            failed = True
    print("\nStatus does not run checks; test results are not inferred from Git state.")
    return int(failed)


def safe_task_id(task: str) -> bool:
    return bool(TASK_ID.fullmatch(task)) and task.upper() not in RESERVED_NAMES


def task_brief(task: str, root: Path) -> int:
    if not safe_task_id(task):
        print("Invalid task ID. Use only letters, digits, '-' and '_'; omit the .md suffix.")
        return 2
    directory = (root / "docs/tasks").resolve()
    if not directory.is_relative_to(root.resolve()):
        print("BLOCKED: docs/tasks resolves outside the repository.")
        return 2
    path = directory / f"{task}.md"
    if path.resolve().parent != directory:
        print("BLOCKED: task brief resolves outside docs/tasks.")
        return 2
    if not path.is_file():
        available = sorted(
            item.stem for item in directory.glob("*.md")
            if item.is_file() and safe_task_id(item.stem) and item.resolve().parent == directory
        )
        print(f"Unknown task: {task}")
        print(f"Available task IDs: {', '.join(available) or '(none)'}")
        return 2
    try:
        print(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError) as error:
        print(f"Cannot read {path}: {error}")
        return 2
    return 0


def print_log_tail(path: Path, *, failed: bool) -> None:
    with path.open(encoding="utf-8", errors="replace") as stream:
        lines = deque(stream, maxlen=40 if failed else 12)
    tail = "".join(lines).strip()
    if tail:
        limit = 6000 if failed else 2400
        print(tail[-limit:])


def configure_console_encoding() -> None:
    """Keep Turkish briefs and log tails readable through Windows shell pipes."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (AttributeError, OSError, TypeError, ValueError):
                # Captured or embedded streams may not support reconfiguration.
                pass


def run_checks(profile: str, root: Path) -> int:
    steps = check_steps(profile, root)
    executables: dict[str, str] = {}
    missing: list[str] = []
    if any(step.tool == "python" for step in steps):
        python = project_python(root)
        if python.is_file():
            executables["python"] = str(python)
        else:
            missing.append(f"Project Python is missing: {python}")
    if any(step.tool == "npm" for step in steps):
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if npm:
            executables["npm"] = npm
        else:
            missing.append("npm.cmd was not found on PATH." if os.name == "nt"
                           else "npm was not found on PATH.")
    if missing:
        for message in missing:
            print(f"BLOCKED: {message}")
        print(f"NOT RUN: {', '.join(step.name for step in steps)}")
        return 2
    log_directory = root / ".project/logs"
    environment = os.environ.copy()
    environment.update(PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    try:
        log_directory.mkdir(parents=True, exist_ok=True)
        for number, step in enumerate(steps):
            log = log_directory / f"{profile}-{step.name}.log"
            command = [executables[step.tool], *step.args]
            print(f"[{number + 1}/{len(steps)}] {step.name} ...", flush=True)
            code: int | None = None
            with log.open("w", encoding="utf-8", errors="replace") as stream:
                try:
                    result = subprocess.run(
                        command, cwd=root, shell=False, stdout=stream,
                        stderr=subprocess.STDOUT, env=environment,
                    )
                    code = result.returncode
                except OSError as error:
                    stream.write(f"Cannot start command: {error}\n")
            if code is None:
                print(f"BLOCKED: {step.name} could not start; log: {log}")
                print_log_tail(log, failed=True)
                print(f"NOT RUN: {', '.join(item.name for item in steps[number:])}")
                return 2
            print(f"{'FAILED' if code else 'PASS'}: {step.name} (exit {code}); log: {log}")
            print_log_tail(log, failed=bool(code))
            if code:
                remaining = steps[number + 1:]
                if remaining:
                    print(f"NOT RUN: {', '.join(item.name for item in remaining)}")
                return code if code > 0 else 1
    except OSError as error:
        print(f"BLOCKED: cannot write/read check logs: {error}")
        print("The requested check profile did not complete.")
        return 2
    print(f"PASS: check {profile} completed ({len(steps)} steps).")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="Read live Git state and list module directories")
    brief = commands.add_parser("brief", help="Read one docs/tasks/TASK.md brief")
    brief.add_argument("task", metavar="TASK")
    check = commands.add_parser("check", help="Run existing checks; never install dependencies")
    check.add_argument("profile", choices=("quick", "backend", "web", "full"))
    args = parser.parse_args(argv)
    if args.command == "status":
        return status(ROOT)
    if args.command == "brief":
        return task_brief(args.task, ROOT)
    return run_checks(args.profile, ROOT)


if __name__ == "__main__":
    configure_console_encoding()
    sys.exit(main())
