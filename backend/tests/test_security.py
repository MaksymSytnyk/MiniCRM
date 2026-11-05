import os
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

os.environ.setdefault(
    "JWT_SECRET", "test-only-secret-with-at-least-thirty-two-characters"
)
from app.core.security import password_hash, token, decode_token
from app.schemas import Register, ClientIn, DealIn, TaskIn, LeadIn


def test_password_hash_is_salted_and_verifies():
    a = password_hash.hash("a sufficiently long password 🔑")
    b = password_hash.hash("a sufficiently long password 🔑")
    assert a != b
    assert "password" not in a
    assert password_hash.verify("a sufficiently long password 🔑", a)
    assert not password_hash.verify("wrong password", a)
    assert not password_hash.verify("wrong password", "malformed")


def test_token_types_and_tampering():
    access = token("user-id", "session-id", "access")
    assert decode_token(access, "access")["sid"] == "session-id"
    with pytest.raises(HTTPException):
        decode_token(access, "refresh")
    with pytest.raises(HTTPException):
        decode_token(access[:-8] + "tampered", "access")


@pytest.mark.parametrize(
    "model,values",
    [
        (Register, {"full_name": "Alex", "email": "invalid", "password": "short"}),
        (ClientIn, {"full_name": "   "}),
        (ClientIn, {"full_name": "Alex", "user_id": "another-owner"}),
        (ClientIn, {"full_name": "Alex", "last_interaction_at": "2026-01-01T12:00:00"}),
        (DealIn, {"title": "Valid", "value": "-10"}),
        (DealIn, {"title": "Valid", "value": "1.001"}),
        (TaskIn, {"title": "Valid", "priority": "Critical"}),
        (LeadIn, {"name": "Valid", "status": "Unsupported"}),
    ],
)
def test_invalid_input_is_rejected(model, values):
    with pytest.raises(ValidationError):
        model.model_validate(values)


def test_password_spaces_are_preserved():
    data = Register(
        full_name="Alex", email="alex@example.com", password="  a secure password  "
    )
    assert data.password == "  a secure password  "


async def test_protected_routes_and_api_validation():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        for endpoint in [
            "/api/clients",
            "/api/leads",
            "/api/deals",
            "/api/tasks",
            "/api/activity",
            "/api/analytics",
            "/api/auth/me",
        ]:
            response = await client.get(endpoint)
            assert response.status_code == 401
            assert "detail" in response.json()
        assert (
            await client.post(
                "/api/auth/register",
                json={"full_name": "", "email": "invalid", "password": "short"},
            )
        ).status_code == 422
        spec = (await client.get("/openapi.json")).json()
        assert "/api/leads/{record_id}/convert" in spec["paths"]
        assert "/api/tasks/{record_id}/status" in spec["paths"]
