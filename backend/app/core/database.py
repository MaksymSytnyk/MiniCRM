from functools import wraps
from inspect import signature
from fastapi import APIRouter
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as db:
        try:
            yield db
            await db.commit()
        except Exception:
            await db.rollback()
            raise


class ServiceRouter(APIRouter):
    """Run synchronous ORM services within SQLAlchemy's supported async bridge.

    One async session and transaction per request. ORM services retain simple,
    testable Session APIs; driver I/O yields through run_sync, never blocking.
    """

    def add_api_route(self, path, endpoint, **kwargs):
        if "db" in signature(endpoint).parameters:
            original = endpoint

            @wraps(original)
            async def bridged(*args, **values):
                session = values["db"]
                return await session.run_sync(
                    lambda sync_db: original(*args, **(values | {"db": sync_db}))
                )

            endpoint = bridged
        return super().add_api_route(path, endpoint, **kwargs)
