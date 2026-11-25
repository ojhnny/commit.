from fastapi.testclient import TestClient

from .conftest import signup
from .test_api import API, make_habit


def test_note_crud(client: TestClient, auth):
    h = make_habit(client, auth)
    r = client.post(f"{API}/habits/{h['id']}/notes", headers=auth, json={"title": "  Plan ", "body": "# Week 1"})
    assert r.status_code == 201, r.text
    note = r.json()
    assert note["title"] == "Plan" and note["body"] == "# Week 1" and note["habitId"] == h["id"]
    assert set(note) == {"id", "habitId", "title", "body", "createdAt", "updatedAt"}

    blank = client.post(f"{API}/habits/{h['id']}/notes", headers=auth, json={}).json()
    assert blank["title"] == "" and blank["body"] == ""

    r = client.patch(f"{API}/notes/{note['id']}", headers=auth, json={"body": "# Week 2"})
    assert r.status_code == 200 and r.json()["title"] == "Plan" and r.json()["body"] == "# Week 2"
    assert r.json()["updatedAt"] >= note["updatedAt"]

    listed = client.get(f"{API}/habits/{h['id']}/notes", headers=auth).json()
    assert [n["id"] for n in listed] == [note["id"], blank["id"]]  # newest edit first

    assert client.delete(f"{API}/notes/{blank['id']}", headers=auth).status_code == 204
    assert client.get(f"{API}/notes/{blank['id']}", headers=auth).status_code == 404


def test_note_limits(client: TestClient, auth):
    h = make_habit(client, auth)
    assert client.post(f"{API}/habits/{h['id']}/notes", headers=auth, json={"title": "x" * 121}).status_code == 422
    assert client.post(f"{API}/habits/{h['id']}/notes", headers=auth, json={"body": "x" * 100_001}).status_code == 422
    assert client.post(f"{API}/habits/nope/notes", headers=auth, json={}).status_code == 404


def test_cannot_touch_someone_elses_notes(client: TestClient, auth):
    h = make_habit(client, auth)
    note = client.post(f"{API}/habits/{h['id']}/notes", headers=auth, json={"title": "Mine"}).json()
    other = signup(client, "other@example.com")
    assert client.get(f"{API}/notes/{note['id']}", headers=other).status_code == 404
    assert client.patch(f"{API}/notes/{note['id']}", headers=other, json={"title": "x"}).status_code == 404
    assert client.delete(f"{API}/notes/{note['id']}", headers=other).status_code == 404
    assert client.post(f"{API}/habits/{h['id']}/notes", headers=other, json={}).status_code == 404
    assert client.get(f"{API}/notes/{note['id']}", headers=auth).json()["title"] == "Mine"


def test_notes_in_snapshot_and_deleted_with_habit(client: TestClient, auth):
    a = make_habit(client, auth, name="A")
    b = make_habit(client, auth, name="B")
    client.post(f"{API}/habits/{a['id']}/notes", headers=auth, json={"title": "a"})
    client.post(f"{API}/habits/{b['id']}/notes", headers=auth, json={"title": "b"})
    assert sorted(n["title"] for n in client.get(f"{API}/snapshot", headers=auth).json()["notes"]) == ["a", "b"]
    assert client.delete(f"{API}/habits/{a['id']}", headers=auth).status_code == 204
    assert [n["title"] for n in client.get(f"{API}/snapshot", headers=auth).json()["notes"]] == ["b"]


def test_notes_export_import(client: TestClient, auth):
    h = make_habit(client, auth)
    client.post(f"{API}/habits/{h['id']}/notes", headers=auth, json={"title": "Plan", "body": "- [ ] one"})
    backup = client.get(f"{API}/export", headers=auth).json()
    assert len(backup["notes"]) == 1

    other = signup(client, "second@example.com")
    r = client.post(f"{API}/import?mode=merge", headers=other, json=backup)
    assert r.status_code == 200 and r.json()["notes"] == 1
    snap = client.get(f"{API}/snapshot", headers=other).json()
    assert snap["notes"][0]["title"] == "Plan" and snap["notes"][0]["habitId"] == snap["habits"][0]["id"]
    assert snap["notes"][0]["updatedAt"] == backup["notes"][0]["updatedAt"]

    # Old backups without notes still import.
    del backup["notes"]
    assert client.post(f"{API}/import?mode=replace", headers=other, json=backup).json()["notes"] == 0
