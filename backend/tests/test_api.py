from datetime import timedelta

from fastapi.testclient import TestClient

from app import domain

from .conftest import signup

API = "/api/v1"


def today():
    return domain.today_in("UTC")


def make_habit(client, auth, start=None, target=60, unit="minutes", days=(0, 1, 2, 3, 4, 5, 6), name="Read"):
    start = start or today() - timedelta(days=9)
    r = client.post(
        f"{API}/habits",
        headers=auth,
        json={
            "name": name,
            "startDate": start.isoformat(),
            "goal": {"targetValue": target, "unit": unit, "schedule": {"preset": "custom", "days": list(days)}},
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------- auth


def test_signup_login_logout(client: TestClient):
    auth = signup(client, "Me@Example.com", "America/Detroit")
    me = client.get(f"{API}/auth/me", headers=auth).json()
    assert me["email"] == "me@example.com" and me["timezone"] == "America/Detroit"

    assert client.post(f"{API}/auth/signup", json={"email": "me@example.com", "password": "another one"}).status_code == 409
    assert client.post(f"{API}/auth/login", json={"email": "me@example.com", "password": "wrong pass"}).status_code == 401
    r = client.post(f"{API}/auth/login", json={"email": "ME@example.com", "password": "correct horse"})
    assert r.status_code == 200
    second = {"Authorization": f"Bearer {r.json()['token']}"}

    assert client.post(f"{API}/auth/logout", headers=auth).status_code == 204
    assert client.get(f"{API}/auth/me", headers=auth).status_code == 401
    assert client.get(f"{API}/auth/me", headers=second).status_code == 200


def test_requires_auth(client: TestClient):
    assert client.get(f"{API}/habits").status_code == 401
    assert client.get(f"{API}/habits", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_bad_timezone_falls_back_and_patch_validates(client: TestClient):
    auth = signup(client, tz="Mars/Olympus")
    assert client.get(f"{API}/auth/me", headers=auth).json()["timezone"] == "UTC"
    assert client.patch(f"{API}/auth/me", headers=auth, json={"timezone": "Nope/Zone"}).status_code == 422
    assert client.patch(f"{API}/auth/me", headers=auth, json={"timezone": "Asia/Tokyo"}).json()["timezone"] == "Asia/Tokyo"


def test_signup_can_be_closed(client: TestClient, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "allow_signup", False)
    r = client.post(f"{API}/auth/signup", json={"email": "x@example.com", "password": "12345678"})
    assert r.status_code == 403


# ---------------------------------------------------------------- habits


def test_habit_crud_and_camel_case(client: TestClient, auth):
    h = make_habit(client, auth, days=(1, 2, 3, 4, 5))
    assert set(h) >= {"id", "name", "startDate", "goalVersions", "order", "createdAt", "archivedAt", "isSample"}
    assert h["goalVersions"][0]["schedule"] == {"preset": "weekdays", "days": [1, 2, 3, 4, 5]}

    r = client.patch(f"{API}/habits/{h['id']}", headers=auth, json={"name": "Read papers", "description": "  "})
    assert r.json()["name"] == "Read papers" and r.json()["description"] is None

    assert client.post(f"{API}/habits/{h['id']}/archive", headers=auth).json()["archivedAt"]
    assert client.get(f"{API}/habits?includeArchived=false", headers=auth).json() == []
    assert client.post(f"{API}/habits/{h['id']}/restore", headers=auth).json()["archivedAt"] is None

    assert client.delete(f"{API}/habits/{h['id']}", headers=auth).status_code == 204
    assert client.get(f"{API}/habits/{h['id']}", headers=auth).status_code == 404


def test_completion_unit_forces_target_one(client: TestClient, auth):
    h = make_habit(client, auth, unit="completion", target=5)
    assert h["goalVersions"][0]["targetValue"] == 1


def test_goal_change_applies_from_today(client: TestClient, auth):
    h = make_habit(client, auth, target=60)
    r = client.patch(
        f"{API}/habits/{h['id']}",
        headers=auth,
        json={"goal": {"targetValue": 90, "unit": "minutes", "schedule": {"preset": "daily", "days": [0, 1, 2, 3, 4, 5, 6]}}},
    )
    versions = r.json()["goalVersions"]
    assert [v["targetValue"] for v in versions] == [60, 90]
    assert versions[1]["effectiveDate"] == today().isoformat()


def test_cannot_touch_someone_elses_habit(client: TestClient, auth):
    h = make_habit(client, auth)
    other = signup(client, "other@example.com")
    assert client.get(f"{API}/habits/{h['id']}", headers=other).status_code == 404
    assert client.put(f"{API}/habits/{h['id']}/logs/{today()}", headers=other, json={"value": 5}).status_code == 404
    assert client.get(f"{API}/habits", headers=other).json() == []


def test_reorder(client: TestClient, auth):
    a = make_habit(client, auth, name="A")
    b = make_habit(client, auth, name="B")
    c = make_habit(client, auth, name="C")
    assert client.put(f"{API}/habits/order", headers=auth, json={"orderedIds": [c["id"], a["id"]]}).status_code == 204
    names = [h["name"] for h in client.get(f"{API}/habits", headers=auth).json()]
    assert names == ["C", "A", "B"]
    assert b  # B keeps its place after the listed ones


# ---------------------------------------------------------------- logs and stats


def test_one_log_per_day_upsert(client: TestClient, auth):
    h = make_habit(client, auth)
    day = (today() - timedelta(days=1)).isoformat()
    first = client.put(f"{API}/habits/{h['id']}/logs/{day}", headers=auth, json={"value": 30, "note": "  "}).json()
    second = client.put(f"{API}/habits/{h['id']}/logs/{day}", headers=auth, json={"value": 75.5, "note": "ch 3"}).json()
    assert first["id"] == second["id"] and second["value"] == 75.5 and second["note"] == "ch 3" and first["note"] is None
    assert len(client.get(f"{API}/habits/{h['id']}/logs", headers=auth).json()) == 1
    assert client.get(f"{API}/habits/{h['id']}/logs/{day}", headers=auth).json()["value"] == 75.5
    assert client.delete(f"{API}/habits/{h['id']}/logs/{day}", headers=auth).status_code == 204
    assert client.get(f"{API}/habits/{h['id']}/logs/{day}", headers=auth).status_code == 404


def test_log_date_rules(client: TestClient, auth):
    h = make_habit(client, auth, start=today() - timedelta(days=2))
    future = (today() + timedelta(days=2)).isoformat()
    before = (today() - timedelta(days=5)).isoformat()
    assert client.put(f"{API}/habits/{h['id']}/logs/{future}", headers=auth, json={"value": 1}).status_code == 422
    assert client.put(f"{API}/habits/{h['id']}/logs/{before}", headers=auth, json={"value": 1}).status_code == 422
    assert client.put(f"{API}/habits/{h['id']}/logs/{today()}", headers=auth, json={"value": -1}).status_code == 422


def test_logs_range_filter(client: TestClient, auth):
    h = make_habit(client, auth)
    for i in range(5):
        client.put(f"{API}/habits/{h['id']}/logs/{today() - timedelta(days=i)}", headers=auth, json={"value": 10})
    r = client.get(
        f"{API}/habits/{h['id']}/logs",
        headers=auth,
        params={"from": (today() - timedelta(days=3)).isoformat(), "to": (today() - timedelta(days=1)).isoformat()},
    )
    assert len(r.json()) == 3


def test_stats(client: TestClient, auth):
    h = make_habit(client, auth, start=today() - timedelta(days=4), target=60)
    for i, v in [(4, 60), (3, 30), (1, 90)]:
        client.put(f"{API}/habits/{h['id']}/logs/{today() - timedelta(days=i)}", headers=auth, json={"value": v})
    s = client.get(f"{API}/habits/{h['id']}/stats", headers=auth).json()
    assert (s["eligibleDays"], s["completedDays"], s["partialDays"], s["missedDays"]) == (4, 2, 1, 1)
    assert s["consistency"] == 50 and s["currentStreak"] == 1 and s["todayStatus"] == "pending"


# ---------------------------------------------------------------- data


def test_export_import_round_trip(client: TestClient, auth):
    h = make_habit(client, auth)
    client.put(f"{API}/habits/{h['id']}/logs/{today()}", headers=auth, json={"value": 60, "note": "done"})
    backup = client.get(f"{API}/export", headers=auth).json()
    assert backup["app"] == "commit" and backup["version"] == 1 and len(backup["logs"]) == 1

    other = signup(client, "other@example.com")
    r = client.post(f"{API}/import", headers=other, json=backup)
    assert r.json() == {"habits": 1, "logs": 1}
    snap = client.get(f"{API}/snapshot", headers=other).json()
    assert snap["habits"][0]["id"] != h["id"] and snap["logs"][0]["note"] == "done"
    assert snap["logs"][0]["habitId"] == snap["habits"][0]["id"]

    # Merge adds, replace swaps.
    client.post(f"{API}/import", headers=other, json=backup)
    assert len(client.get(f"{API}/habits", headers=other).json()) == 2
    client.post(f"{API}/import?mode=replace", headers=other, json=backup)
    assert len(client.get(f"{API}/habits", headers=other).json()) == 1


def test_import_rejects_junk(client: TestClient, auth):
    assert (
        client.post(f"{API}/import", headers=auth, json={"app": "other", "version": 1, "habits": [], "logs": []}).status_code
        == 422
    )


def test_sample_data_and_reset(client: TestClient, auth):
    make_habit(client, auth, name="Mine")
    backup = {
        "app": "commit",
        "version": 1,
        "habits": [
            {
                "id": "sample-x",
                "name": "Sample",
                "startDate": today().isoformat(),
                "isSample": True,
                "goalVersions": [
                    {
                        "effectiveDate": today().isoformat(),
                        "targetValue": 1,
                        "unit": "completion",
                        "schedule": {"preset": "daily", "days": [0, 1, 2, 3, 4, 5, 6]},
                    }
                ],
            }
        ],
        "logs": [{"habitId": "sample-x", "date": today().isoformat(), "value": 1}],
    }
    assert client.post(f"{API}/import", headers=auth, json=backup).json() == {"habits": 1, "logs": 1}
    assert client.delete(f"{API}/sample-data", headers=auth).status_code == 204
    assert [h["name"] for h in client.get(f"{API}/habits", headers=auth).json()] == ["Mine"]
    assert client.delete(f"{API}/data", headers=auth).status_code == 204
    assert client.get(f"{API}/snapshot", headers=auth).json() == {"habits": [], "logs": []}


def test_health(client: TestClient):
    assert client.get("/health").json() == {"status": "ok"}
