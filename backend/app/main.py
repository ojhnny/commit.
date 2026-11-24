from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import get_settings
from .db import engine
from .routers import auth, data, habits

app = FastAPI(title="commit. API", version="1.0.0", description="Habits, daily logs and statistics for commit.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

API = "/api/v1"
app.include_router(auth.router, prefix=API)
app.include_router(habits.router, prefix=API)
app.include_router(data.router, prefix=API)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Used by the host's health check (and to wake a sleeping free instance)."""
    with engine.connect() as conn:
        conn.execute(text("select 1"))
    return {"status": "ok"}
