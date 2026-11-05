"""Integration tests use a temporary schema; existing database tables are never touched."""

import asyncio
import os
import uuid
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

os.environ.setdefault(
    "JWT_SECRET", "test-only-secret-with-at-least-thirty-two-characters"
)
if os.getenv("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"].replace(
        "postgresql+psycopg://", "postgresql+asyncpg://"
    )


@pytest.fixture(scope="session")
def client():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        from tests_portable import portable_client

        with portable_client() as local_client:
            yield local_client
        return
    from app.core import database
    from app.models import Base
    import app.main

    schema = "minicrm_test_" + uuid.uuid4().hex
    admin = create_async_engine(url, poolclass=NullPool)

    async def create_schema():
        async with admin.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))

    asyncio.run(create_schema())
    engine = create_async_engine(
        url,
        poolclass=NullPool,
        connect_args={"server_settings": {"search_path": schema, "timezone": "UTC"}},
    )
    database.SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    app.main.engine = engine

    async def migrate():
        # Exercise the actual versioned migration, not metadata.create_all.
        from alembic.config import Config
        from alembic import command

        def upgrade(connection):
            config = Config("backend/alembic.ini")
            config.attributes["connection"] = connection
            command.upgrade(config, "head")

        async with engine.begin() as connection:
            await connection.run_sync(upgrade)

    try:
        asyncio.run(migrate())
        from fastapi.testclient import TestClient

        with TestClient(app.main.app) as test_client:
            yield test_client
    finally:

        async def cleanup():
            await engine.dispose()
            async with admin.begin() as connection:
                await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await admin.dispose()

        asyncio.run(cleanup())


@pytest.fixture
def account(client):
    email = f"{uuid.uuid4().hex}@example.com"
    password = "correct horse battery staple"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Alex Morgan"},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return {
        "headers": {"Authorization": "Bearer " + data["access_token"]},
        "user": data["user"],
        "email": email,
        "password": password,
    }
