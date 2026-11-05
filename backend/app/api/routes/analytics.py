from app.core.database import ServiceRouter
from datetime import date
from fastapi import APIRouter
from app.dependencies.auth import DB, CurrentUser
from app.services.analytics import analytics

router = ServiceRouter(tags=["Analytics"])


@router.get("/analytics")
def report(
    db: DB, user: CurrentUser, start: date | None = None, end: date | None = None
):
    return analytics(db, user.id, start, end)
