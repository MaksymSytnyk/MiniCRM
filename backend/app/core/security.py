from datetime import timedelta
from hashlib import sha256
from uuid import uuid4
import jwt
import base64
import hashlib
import hmac
import secrets
from fastapi import HTTPException
from app.core.config import get_settings
from app.models import now


class PasswordHash:
    @staticmethod
    def hash(password: str):
        salt = secrets.token_bytes(16)
        key = hashlib.scrypt(
            password.encode(), salt=salt, n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024
        )
        return (
            "scrypt$"
            + base64.b64encode(salt).decode()
            + "$"
            + base64.b64encode(key).decode()
        )

    @staticmethod
    def verify(password: str, stored: str):
        try:
            scheme, salt, expected = stored.split("$")
            if scheme != "scrypt":
                return False
            key = hashlib.scrypt(
                password.encode(),
                salt=base64.b64decode(salt),
                n=2**17,
                r=8,
                p=1,
                maxmem=256 * 1024 * 1024,
            )
            return hmac.compare_digest(key, base64.b64decode(expected))
        except (ValueError, TypeError):
            return False


password_hash = PasswordHash()
DUMMY_HASH = password_hash.hash("dummy-password-for-timing")


def digest(value: str):
    return sha256(value.encode()).hexdigest()


def token(user_id: str, session_id: str, kind: str):
    settings = get_settings()
    expires = now() + (
        timedelta(minutes=settings.access_token_minutes)
        if kind == "access"
        else timedelta(days=settings.refresh_token_days)
    )
    return jwt.encode(
        {
            "sub": user_id,
            "sid": session_id,
            "type": kind,
            "jti": str(uuid4()),
            "iat": now(),
            "exp": expires,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_token(value: str, kind: str):
    try:
        claims = jwt.decode(
            value,
            get_settings().jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "sid", "type", "exp", "iat", "jti"]},
        )
        if claims["type"] != kind:
            raise ValueError()
        return claims
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(401, "Your session has expired. Please sign in again.")
