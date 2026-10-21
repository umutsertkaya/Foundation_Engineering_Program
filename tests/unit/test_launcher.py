"""The launcher serves the built UI and keeps /api routes intact."""

from fastapi.testclient import TestClient

from geotek.launcher import build_app, pick_port


def test_launcher_serves_spa_and_api(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "index.html").write_text("<html>geotek</html>")
    client = TestClient(build_app(tmp_path))
    assert client.get("/").text == "<html>geotek</html>"
    assert client.get("/soil/boreholes").text == "<html>geotek</html>"
    assert client.get("/assets/app.js").text == "console.log(1)"
    assert client.get("/../pyproject.toml").text == "<html>geotek</html>"
    assert client.get("/api/health").json()["status"] == "ok"


def test_pick_port_returns_usable_port():
    assert 0 < pick_port() < 65536


def test_launcher_shutdown_route_only_when_enabled(tmp_path):
    (tmp_path / "index.html").write_text("<html>geotek</html>")
    plain = TestClient(build_app(tmp_path))
    assert plain.get("/api/launcher").status_code == 404
    calls = []
    client = TestClient(build_app(tmp_path, shutdown=lambda: calls.append(1)))
    assert client.get("/api/launcher").json() == {"shutdown": True}
    assert calls == []
    assert client.post("/api/launcher/shutdown").json() == {"stopping": True}
    assert calls == [1]


def test_already_running_is_false_without_server():
    from geotek.launcher import already_running

    assert already_running(pick_port()) is False
