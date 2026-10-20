"""Isolated checks of the orchestration entry point; no project checks are launched."""

from __future__ import annotations

import io
from pathlib import Path
import subprocess

import pytest

from tools import project


def configured_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "repository"
    python = project.project_python(root)
    python.parent.mkdir(parents=True)
    python.touch()
    monkeypatch.setattr(project, "ROOT", root)
    monkeypatch.setattr(project.shutil, "which", lambda name: str(tmp_path / name))
    return root


def test_failure_preserves_exit_and_reports_unrun_checks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    root = configured_root(tmp_path, monkeypatch)
    calls: list[list[str]] = []

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        kwargs["stdout"].write("test failure details\n")
        return subprocess.CompletedProcess(command, 7)

    monkeypatch.setattr(project.subprocess, "run", run)
    assert project.main(["check", "quick"]) == 7
    assert len(calls) == 1
    assert calls[0][-2:] == ["tools/gen_module_index.py", "--check"]
    output = capsys.readouterr().out
    assert "FAILED: module-index (exit 7)" in output
    assert "NOT RUN: code-map, python-boundaries, web-typecheck, web-boundaries" in output
    assert "test failure details" in output
    assert "PASS: check" not in output
    assert (root / ".project/logs/quick-module-index.log").read_text() == "test failure details\n"


def test_full_check_uses_root_and_only_existing_check_commands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    root = configured_root(tmp_path, monkeypatch)
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    monkeypatch.chdir(elsewhere)
    calls: list[list[str]] = []

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        assert kwargs["cwd"] == root
        assert kwargs["shell"] is False
        assert kwargs["stderr"] == subprocess.STDOUT
        assert kwargs["env"]["PYTHONUTF8"] == "1"
        assert kwargs["env"]["PYTHONIOENCODING"] == "utf-8"
        kwargs["stdout"].write("check finished\n")
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(project.subprocess, "run", run)
    assert project.main(["check", "full"]) == 0
    assert [call[1:] for call in calls] == [
        ["tools/gen_module_index.py", "--check"],
        ["tools/gen_code_map.py", "--check"],
        ["-m", "pytest", "-q"],
        ["--prefix", str(root / "web"), "run", "typecheck"],
        ["--prefix", str(root / "web"), "run", "test"],
        ["--prefix", str(root / "web"), "run", "build"],
    ]
    assert sorted(path.name for path in (root / ".project/logs").iterdir()) == [
        "full-code-map.log", "full-module-index.log", "full-python-tests.log", "full-web-build.log",
        "full-web-tests.log", "full-web-typecheck.log",
    ]
    assert "PASS: check full completed (6 steps)." in capsys.readouterr().out
    assert not list(elsewhere.iterdir())


def test_command_launch_error_is_blocked_and_current_step_did_not_run(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    root = configured_root(tmp_path, monkeypatch)
    calls: list[list[str]] = []

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        raise PermissionError("Python launcher is blocked")

    monkeypatch.setattr(project.subprocess, "run", run)
    assert project.main(["check", "quick"]) == 2
    assert len(calls) == 1
    output = capsys.readouterr().out
    assert "BLOCKED: module-index could not start; log:" in output
    assert "NOT RUN: module-index, code-map, python-boundaries, web-typecheck, web-boundaries" in output
    assert "Python launcher is blocked" in output
    assert "FAILED:" not in output
    assert "PASS:" not in output
    assert (root / ".project/logs/quick-module-index.log").read_text() == (
        "Cannot start command: Python launcher is blocked\n"
    )


def test_missing_python_blocks_without_creating_logs_or_installing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(project, "ROOT", tmp_path)

    def unexpected(*args: object, **kwargs: object) -> None:
        pytest.fail("No command should run while project Python is missing")

    monkeypatch.setattr(project.subprocess, "run", unexpected)
    assert project.main(["check", "backend"]) == 2
    output = capsys.readouterr().out
    assert "Project Python is missing:" in output
    assert "NOT RUN: python-tests" in output
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize("task", [
    "../secret", r"..\secret", "/absolute", "C:secret", "TASK.md", "two words",
    "task\n", "", ".hidden", "CON", "LPT1",
])
def test_malformed_brief_never_reads_files(
    task: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected(*args: object, **kwargs: object) -> None:
        pytest.fail("Malformed task IDs must be rejected before reading a file")

    monkeypatch.setattr(Path, "read_text", unexpected)
    assert project.task_brief(task, tmp_path) == 2
    assert not list(tmp_path.iterdir())


def test_briefs_are_read_only_and_unknown_id_lists_available_tasks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    tasks = tmp_path / "docs/tasks"
    tasks.mkdir(parents=True)
    source = tasks / "c1-spt.md"
    source.write_text("# SPT\nBir gorev.\n", encoding="utf-8-sig")
    (tasks / "not a task.md").write_text("ignored", encoding="utf-8")
    before = {path: path.read_bytes() for path in tmp_path.rglob("*") if path.is_file()}
    monkeypatch.setattr(project, "ROOT", tmp_path)
    assert project.main(["brief", "c1-spt"]) == 0
    assert "# SPT\nBir gorev." in capsys.readouterr().out
    assert project.main(["brief", "unknown"]) == 2
    assert "Available task IDs: c1-spt" in capsys.readouterr().out
    after = {path: path.read_bytes() for path in tmp_path.rglob("*") if path.is_file()}
    assert after == before


def test_brief_cannot_follow_a_file_outside_tasks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    tasks = tmp_path / "docs/tasks"
    tasks.mkdir(parents=True)
    source = tasks / "escape.md"
    source.touch()
    original_resolve = Path.resolve

    def resolve(path: Path, *args: object, **kwargs: object) -> Path:
        if path == source:
            return tmp_path.parent / "private.md"
        return original_resolve(path, *args, **kwargs)

    monkeypatch.setattr(Path, "resolve", resolve)
    assert project.task_brief("escape", tmp_path) == 2
    assert "resolves outside docs/tasks" in capsys.readouterr().out


def test_log_tail_is_bounded_and_tolerates_non_utf8(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    log = tmp_path / "output.log"
    log.write_bytes(b"SECRET FIRST LINE\n" + b"warning\n" * 100 + b"last \xff\n")
    project.print_log_tail(log, failed=False)
    output = capsys.readouterr().out
    assert "SECRET FIRST LINE" not in output
    assert output.count("warning") == 11
    assert "last \ufffd" in output


def test_console_encoding_preserves_turkish_and_captured_streams(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    buffers = [io.BytesIO(), io.BytesIO()]
    streams = [io.TextIOWrapper(buffer, encoding="ascii") for buffer in buffers]
    message = "Ölçüm: ıİşŞğĞüÜçÇ"
    with monkeypatch.context() as patch:
        patch.setattr(project.sys, "stdout", streams[0])
        patch.setattr(project.sys, "stderr", streams[1])
        project.configure_console_encoding()
        for stream in streams:
            stream.write(message)
            stream.flush()
        assert project.sys.stdout is streams[0]
        assert project.sys.stderr is streams[1]
    assert [buffer.getvalue() for buffer in buffers] == [message.encode("utf-8")] * 2
    captured = io.StringIO()
    with monkeypatch.context() as patch:
        patch.setattr(project.sys, "stdout", captured)
        patch.setattr(project.sys, "stderr", captured)
        project.configure_console_encoding()
        assert project.sys.stdout is captured
        assert project.sys.stderr is captured


def test_status_reads_live_git_without_creating_logs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    modules = tmp_path / "geotek/modules/c1_spt"
    modules.mkdir(parents=True)
    calls: list[list[str]] = []
    monkeypatch.setattr(project, "find_git", lambda: "git")

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        assert kwargs["cwd"] == tmp_path
        assert kwargs["shell"] is False
        return subprocess.CompletedProcess(command, 0, "live-git-output\n")

    monkeypatch.setattr(project.subprocess, "run", run)
    assert project.status(tmp_path) == 0
    assert calls == [
        ["git", "branch", "--show-current"], ["git", "status", "--short", "--branch"],
        ["git", "worktree", "list"],
    ]
    output = capsys.readouterr().out
    assert "c1_spt" in output
    assert "live-git-output" in output
    assert "test results are not inferred" in output
    assert not (tmp_path / ".project").exists()
