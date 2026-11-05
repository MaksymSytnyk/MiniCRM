from app.core.database import ServiceRouter
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Response, Request
from sqlalchemy import select, delete
from app.core.config import get_settings
from app.core.security import password_hash, DUMMY_HASH, token, digest, decode_token
from app.dependencies.auth import DB, CurrentUser
from app.models import User, AuthSession, now
from app.schemas import Register, Login, UserOut, Profile, PasswordChange, DeleteAccount

router = ServiceRouter(prefix="/auth", tags=["Authentication"])


def set_cookie(response, value):
    settings = get_settings()
    response.set_cookie(
        "refresh_token",
        value,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/api/auth",
        max_age=settings.refresh_token_days * 86400,
    )


def issue(db, user, response):
    session = AuthSession(
        user_id=user.id,
        token_hash="",
        expires_at=now() + timedelta(days=get_settings().refresh_token_days),
    )
    db.add(session)
    db.flush()
    refresh = token(user.id, session.id, "refresh")
    session.token_hash = digest(refresh)
    set_cookie(response, refresh)
    return {
        "access_token": token(user.id, session.id, "access"),
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
    }


@router.post("/register", status_code=201)
def register(data: Register, db: DB, response: Response):
    email = str(data.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists.")
    user = User(
        email=email,
        full_name=data.full_name,
        password_hash=password_hash.hash(data.password),
    )
    db.add(user)
    db.flush()
    return issue(db, user, response)


@router.post("/login")
def login(data: Login, db: DB, response: Response):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = password_hash.verify(
        data.password, user.password_hash if user else DUMMY_HASH
    )
    if not user or not valid:
        raise HTTPException(401, "Email or password is incorrect.")
    return issue(db, user, response)


@router.post("/refresh")
def refresh(request: Request, response: Response, db: DB):
    origin = request.headers.get("origin")
    if origin and origin != get_settings().frontend_origin:
        raise HTTPException(403, "Origin is not allowed.")
    raw = request.cookies.get("refresh_token")
    if not raw:
        raise HTTPException(401, "Please sign in to continue.")
    claims = decode_token(raw, "refresh")
    session = db.scalar(
        select(AuthSession).where(AuthSession.id == claims["sid"]).with_for_update()
    )
    if (
        not session
        or session.user_id != claims["sub"]
        or session.expires_at <= now()
        or session.token_hash != digest(raw)
    ):
        raise HTTPException(401, "Refresh token is invalid or has already been used.")
    user = db.get(User, claims["sub"])
    new_refresh = token(user.id, session.id, "refresh")
    session.token_hash = digest(new_refresh)
    set_cookie(response, new_refresh)
    return {
        "access_token": token(user.id, session.id, "access"),
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
    }


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    raw = request.cookies.get("refresh_token")
    if raw:
        try:
            claims = decode_token(raw, "refresh")
            db.execute(
                delete(AuthSession).where(
                    AuthSession.id == claims["sid"],
                    AuthSession.token_hash == digest(raw),
                )
            )
        except HTTPException:
            pass
    response.delete_cookie("refresh_token", path="/api/auth")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.put("/me", response_model=UserOut)
def update_profile(data: Profile, db: DB, user: CurrentUser):
    for key, value in data.model_dump().items():
        setattr(user, key, value)
    db.flush()
    return user


@router.post("/password", status_code=204)
def change_password(
    data: PasswordChange, db: DB, user: CurrentUser, response: Response
):
    if not password_hash.verify(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    user.password_hash = password_hash.hash(data.new_password)
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    response.delete_cookie("refresh_token", path="/api/auth")


@router.delete("/me", status_code=204)
def delete_account(data: DeleteAccount, db: DB, user: CurrentUser, response: Response):
    if not password_hash.verify(data.password, user.password_hash):
        raise HTTPException(400, "Password is incorrect.")
    db.delete(user)
    response.delete_cookie("refresh_token", path="/api/auth")
