from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from app.models import Client, Lead, Deal, Task, Tag, ActivityLog, now
from app.repositories.records import owned

MODELS = {"clients": Client, "leads": Lead, "deals": Deal, "tasks": Task}


def serialize(item):
    result = {}
    for col in item.__table__.columns:
        if col.name == "user_id":
            continue
        value = getattr(item, col.name)
        result[col.name] = float(value) if isinstance(value, Decimal) else value
    if isinstance(item, Client):
        result["tags"] = sorted(tag.name for tag in item.tags)
    if isinstance(item, (Deal, Task)):
        result["client_name"] = item.client.full_name if item.client else None
    if isinstance(item, Task):
        result["deal_title"] = item.deal.title if item.deal else None
    return result


def log(db, user_id, action, kind, item):
    label = (
        getattr(item, "full_name", None)
        or getattr(item, "name", None)
        or getattr(item, "title", "")
    )
    db.add(
        ActivityLog(
            user_id=user_id,
            action=action,
            entity_type=kind,
            entity_id=item.id,
            description=f"{action} {label}"[:300],
        )
    )


def save(db, user, kind, data, item=None):
    model = MODELS[kind]
    values = data.model_dump()
    for key, related in [("client_id", Client), ("deal_id", Deal)]:
        if values.get(key):
            owned(db, related, values[key], user.id)
    if kind == "leads":
        if values["status"] == "Converted" and (item is None or not item.converted_at):
            raise HTTPException(422, "Use Convert to client to convert a lead.")
        if item and item.converted_at and values["status"] != "Converted":
            raise HTTPException(
                422, "A converted lead must retain its conversion status."
            )
    if kind == "deals":
        values["closed_at"] = (
            (item.closed_at if item and item.status == "Won" else now())
            if values["status"] == "Won"
            else None
        )
    tags = values.pop("tags", None)
    created = item is None
    if created:
        item = model(user_id=user.id)
        db.add(item)
    for key, value in values.items():
        setattr(item, key, value)
    if tags is not None:
        item.tags = []
        for name in dict.fromkeys(t.strip() for t in tags if t.strip()):
            tag = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.name == name))
            if tag is None:
                tag = Tag(user_id=user.id, name=name)
                db.add(tag)
                db.flush()
            item.tags.append(tag)
    db.flush()
    db.refresh(item)
    log(db, user.id, "Created" if created else "Updated", kind, item)
    return item


def convert_lead(db, user, lead_id):
    lead = owned(db, Lead, lead_id, user.id, lock=True)
    if lead.converted_at:
        raise HTTPException(409, "This lead has already been converted.")
    client = Client(
        user_id=user.id,
        full_name=lead.name,
        email=lead.email,
        phone=lead.phone,
        company=lead.company,
        notes=lead.notes,
        last_interaction_at=now(),
    )
    db.add(client)
    db.flush()
    lead.status = "Converted"
    lead.converted_client_id = client.id
    lead.converted_at = now()
    log(db, user.id, "Converted", "leads", lead)
    log(db, user.id, "Created", "clients", client)
    db.flush()
    return client
