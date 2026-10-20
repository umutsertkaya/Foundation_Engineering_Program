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
