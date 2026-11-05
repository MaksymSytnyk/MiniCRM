from fastapi import HTTPException
from sqlalchemy import select


def owned(db, model, record_id, user_id, lock=False):
    statement = select(model).where(model.id == record_id, model.user_id == user_id)
    if lock:
        statement = statement.with_for_update()
    item = db.scalar(statement)
    if item is None:
        raise HTTPException(404, "Record not found.")
    return item
