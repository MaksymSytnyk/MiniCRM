from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_token
from app.models import User, AuthSession, now

DB = Annotated[AsyncSession, Depends(get_db, scope="function")]
bearer = HTTPBearer(auto_error=False)


async def current_user(
    db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
):
    if not credentials:
        raise HTTPException(401, "Please sign in to continue.")
    claims = decode_token(credentials.credentials, "access")
    session = await db.get(AuthSession, claims["sid"])
    user = await db.get(User, claims["sub"])
    if (
        not user
        or not session
        or session.user_id != user.id
        or session.expires_at <= now()
    ):
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
