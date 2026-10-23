

def test_pick_folder_route_returns_chosen_path(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from geotek import launcher

    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html></html>")
    monkeypatch.setattr(launcher, "choose_path", lambda kind, initial="": f"{kind}:{initial}")
    client = TestClient(launcher.build_app(dist, shutdown=lambda: None))
    reply = client.post("/api/launcher/pick/open", json={"initial": "X"})
    assert reply.json() == {"path": "open:X"}
    assert client.post("/api/launcher/pick/other").status_code == 404
