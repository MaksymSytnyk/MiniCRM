"""Relational service checks using disposable SQLite, independent of live PG tests."""

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from app.models import Base, User, Client, Lead, Deal, Task, ActivityLog
from app.schemas import ClientIn, DealIn, LeadIn, TaskIn
from app.services.records import save, convert_lead, serialize
from app.repositories.records import owned


@pytest.fixture
def workspace():
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(
            email="owner@example.com",
            full_name="Owner",
            password_hash="not-used-in-service-tests",
        )
        other = User(
            email="other@example.com",
            full_name="Other",
            password_hash="not-used-in-service-tests",
        )
        db.add_all([owner, other])
        db.flush()
        yield db, owner, other
    engine.dispose()


def test_service_ownership_including_associations(workspace):
    db, owner, other = workspace
    client = save(
        db, owner, "clients", ClientIn(full_name="Private client", tags=["VIP", "VIP"])
    )
    assert serialize(client)["tags"] == ["VIP"]
    with pytest.raises(HTTPException) as denied:
        owned(db, Client, client.id, other.id)
    assert denied.value.status_code == 404
    with pytest.raises(HTTPException):
        save(db, other, "deals", DealIn(title="Unauthorized", client_id=client.id))
    deal = save(
        db,
        owner,
        "deals",
        DealIn(title="Private deal", client_id=client.id, value="1234.50"),
    )
    with pytest.raises(HTTPException):
        save(db, other, "tasks", TaskIn(title="Unauthorized task", deal_id=deal.id))
    assert serialize(deal)["value"] == 1234.5
    assert serialize(deal)["client_name"] == "Private client"


def test_conversion_is_tracked_once_and_rolls_back(workspace):
    db, owner, _ = workspace
    lead = save(
        db,
        owner,
        "leads",
        LeadIn(name="New relationship", email="new@example.com", notes="Context"),
    )
    db.commit()
    lead_id, owner_id = lead.id, owner.id
    client = convert_lead(db, owner, lead_id)
    assert lead.status == "Converted"
    assert lead.converted_client_id == client.id
    assert client.notes == "Context"
    with pytest.raises(HTTPException) as conflict:
        convert_lead(db, owner, lead_id)
    assert conflict.value.status_code == 409
    db.rollback()
    db.expire_all()
    assert db.get(Lead, lead_id).status == "New"
    assert db.scalars(select(Client).where(Client.user_id == owner_id)).all() == []
    assert (
        len(
            db.scalars(select(ActivityLog).where(ActivityLog.user_id == owner_id)).all()
        )
        == 1
    )


def test_relationship_cleanup_and_revenue_lifecycle(workspace):
    db, owner, _ = workspace
    client = save(db, owner, "clients", ClientIn(full_name="Client"))
    deal = save(
        db,
        owner,
        "deals",
        DealIn(title="Project", value="5000", client_id=client.id, status="Won"),
    )
    first_won_at = deal.closed_at
    assert first_won_at is not None
    save(
        db,
        owner,
        "deals",
        DealIn(
            title="Project amended", value="5500", client_id=client.id, status="Won"
        ),
        deal,
    )
    assert deal.closed_at == first_won_at
    save(
        db,
        owner,
        "deals",
        DealIn(
            title="Project amended", value="5500", client_id=client.id, status="Open"
        ),
        deal,
    )
    assert deal.closed_at is None
    task = save(
        db,
        owner,
        "tasks",
        TaskIn(title="Follow up", client_id=client.id, deal_id=deal.id),
    )
    task_id, deal_id = task.id, deal.id
    db.delete(client)
    db.flush()
    db.expire_all()
    assert db.get(Deal, deal_id).client_id is None
    assert db.get(Task, task_id).client_id is None
    db.delete(db.get(Deal, deal_id))
    db.flush()
    db.expire_all()
    assert db.get(Task, task_id).deal_id is None
