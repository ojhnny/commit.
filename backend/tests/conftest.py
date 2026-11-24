import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://postgres@127.0.0.1:5432/commit_test")
os.environ["ALLOW_SIGNUP"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, sessions, habits, habit_goal_versions, habit_logs CASCADE"))
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def signup(client: TestClient, email: str = "me@example.com", tz: str = "UTC") -> dict[str, str]:
    r = client.post("/api/v1/auth/signup", json={"email": email, "password": "correct horse", "timezone": tz})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def auth(client: TestClient) -> dict[str, str]:
    return signup(client)
