"""Portable HTTP contract tests; PostgreSQL-specific tests use TEST_DATABASE_URL.

This replaces only the test database dependency with a real relational SQLite
session. The actual API, auth, validation, ORM services and analytics execute.
No test adapter or SQLite configuration is part of the application runtime.
"""

import asyncio
from contextlib import contextmanager
from datetime import datetime, timezone
import httpx
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, attributes
from sqlalchemy.pool import StaticPool


@contextmanager
def portable_client():
    from app.main import app
    from app.core.database import get_db
    from app.models import Base, AuthSession

    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine, "connect")
    def configure(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.create_function("timezone", 2, lambda zone, value: value)
        connection.create_function(
            "to_char",
            2,
            lambda value, fmt: (
                datetime.fromisoformat(value).strftime("%Y-%m") if value else None
            ),
        )

    # SQLite does not retain tzinfo; PG timestamptz does.
    def timezone_on_load(target, context):
        if target.expires_at.tzinfo is None:
            attributes.set_committed_value(
                target, "expires_at", target.expires_at.replace(tzinfo=timezone.utc)
            )

    event.listen(AuthSession, "load", timezone_on_load)
    Base.metadata.create_all(engine)

    class AsyncAdapter:
        def __init__(self, sync):
            self.sync = sync

        async def get(self, *args):
            return self.sync.get(*args)

        async def run_sync(self, callback):
            return callback(self.sync)

    async def database_dependency():
        with Session(engine, expire_on_commit=False) as sync:
            try:
                yield AsyncAdapter(sync)
                sync.commit()
            except Exception:
                sync.rollback()
                raise

    app.dependency_overrides[get_db] = database_dependency
    transport = httpx.ASGITransport(app=app)
    async_client = httpx.AsyncClient(transport=transport, base_url="http://testserver")

    class Client:
        cookies = async_client.cookies

        def request(self, method, path, **kwargs):
            return asyncio.run(async_client.request(method, path, **kwargs))

        def get(self, path, **kwargs):
            return self.request("GET", path, **kwargs)

        def post(self, path, **kwargs):
            return self.request("POST", path, **kwargs)

        def put(self, path, **kwargs):
            return self.request("PUT", path, **kwargs)

        def patch(self, path, **kwargs):
            return self.request("PATCH", path, **kwargs)

        def delete(self, path, **kwargs):
            return self.request("DELETE", path, **kwargs)

    try:
        yield Client()
    finally:
        asyncio.run(async_client.aclose())
        app.dependency_overrides.pop(get_db, None)
        event.remove(AuthSession, "load", timezone_on_load)
        engine.dispose()
