from fastapi.testclient import TestClient

from .test_api import API, make_habit


def test_color_create_patch_clear_and_validate(client: TestClient, auth):
    h = make_habit(client, auth)
    assert h["color"] is None
    r = client.patch(f"{API}/habits/{h['id']}", headers=auth, json={"color": "teal"})
    assert r.status_code == 200 and r.json()["color"] == "teal"
    # Patching something else leaves the color alone.
    assert client.patch(f"{API}/habits/{h['id']}", headers=auth, json={"name": "Renamed"}).json()["color"] == "teal"
    assert client.patch(f"{API}/habits/{h['id']}", headers=auth, json={"color": None}).json()["color"] is None
    assert client.patch(f"{API}/habits/{h['id']}", headers=auth, json={"color": "#ff0000"}).status_code == 422


def test_color_survives_export_import(client: TestClient, auth):
    h = make_habit(client, auth)
    client.patch(f"{API}/habits/{h['id']}", headers=auth, json={"color": "purple"})
    backup = client.get(f"{API}/export", headers=auth).json()
    assert backup["habits"][0]["color"] == "purple"
    r = client.post(f"{API}/import?mode=replace", headers=auth, json=backup)
    assert r.status_code in (200, 201), r.text
    snap = client.get(f"{API}/snapshot", headers=auth).json()
    assert snap["habits"][0]["color"] == "purple"
