from app.core.database import ServiceRouter
from datetime import date
from typing import Literal
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func, or_, case
from app.dependencies.auth import DB, CurrentUser
from app.models import Client, Lead, Deal, Task, Tag, ActivityLog
from app.schemas import ClientIn, LeadIn, DealIn, TaskIn, StatusIn
from app.services.records import MODELS, serialize, save, log, convert_lead
from app.repositories.records import owned

router = ServiceRouter(tags=["CRM"])


@router.get("/activity")
def activity(
    db: DB,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
):
    query = select(ActivityLog).where(ActivityLog.user_id == user.id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(ActivityLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [serialize(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/tags")
def tags(db: DB, user: CurrentUser):
    return [
        {"id": tag.id, "name": tag.name}
        for tag in db.scalars(
            select(Tag).where(Tag.user_id == user.id).order_by(Tag.name)
        )
    ]


def register_resource(kind, schema):
    model = MODELS[kind]
    sort_fields = {"created_at", "updated_at"} | (
        {"full_name", "company", "last_interaction_at"}
        if kind == "clients"
        else {"name", "company", "status", "estimated_value"}
        if kind == "leads"
        else {"title", "value", "status", "expected_close_date"}
        if kind == "deals"
        else {"title", "due_date", "priority", "status"}
    )

    def listing(
        db: DB,
        user: CurrentUser,
        q: str = Query("", max_length=200),
        status: str | None = None,
        priority: str | None = None,
        client_id: str | None = None,
        deal_id: str | None = None,
        tag: str | None = None,
        overdue: bool = False,
        exclude_completed: bool = False,
        sort: str = "created_at",
        order: Literal["asc", "desc"] = "desc",
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
    ):
        query = select(model).where(model.user_id == user.id)
        if q:
            fields = [
                getattr(model, name)
                for name in (
                    "full_name",
                    "name",
                    "title",
                    "email",
                    "company",
                    "description",
                    "notes",
                )
                if hasattr(model, name)
            ]
            pattern = (
                "%"
                + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                + "%"
            )
            query = query.where(or_(*(f.ilike(pattern, escape="\\") for f in fields)))
        for name, value in [
            ("status", status),
            ("priority", priority),
            ("client_id", client_id),
            ("deal_id", deal_id),
        ]:
            if value is not None:
                if not hasattr(model, name):
                    raise HTTPException(
                        422, f"{name} filter is not available for {kind}."
                    )
                query = query.where(getattr(model, name) == value)
        if tag:
            if kind != "clients":
                raise HTTPException(422, "Tags are available on clients.")
            query = query.where(Client.tags.any(Tag.name == tag))
        if exclude_completed and kind == "tasks":
            query = query.where(Task.status != "Completed")
        if overdue:
            if kind != "tasks":
                raise HTTPException(422, "Overdue filter is available on tasks.")
            query = query.where(
                Task.due_date < date.today(), Task.status != "Completed"
            )
        if sort not in sort_fields:
            raise HTTPException(422, "Invalid sort field.")
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        column = (
            case((Task.priority == "High", 3), (Task.priority == "Medium", 2), else_=1)
            if kind == "tasks" and sort == "priority"
            else getattr(model, sort)
        )
        items = (
            db.scalars(
                query.order_by(
                    (column.asc() if order == "asc" else column.desc()).nulls_last(),
                    model.id,
                )
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            .unique()
            .all()
        )
        return {
            "items": [serialize(i) for i in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def detail(record_id: str, db: DB, user: CurrentUser):
        return serialize(owned(db, model, record_id, user.id))

    def create(data, db: DB, user: CurrentUser):
        return serialize(save(db, user, kind, data))

    create.__annotations__["data"] = schema

    def update(record_id: str, data, db: DB, user: CurrentUser):
        return serialize(
            save(db, user, kind, data, owned(db, model, record_id, user.id))
        )

    update.__annotations__["data"] = schema

    def remove(record_id: str, db: DB, user: CurrentUser):
        item = owned(db, model, record_id, user.id)
        log(db, user.id, "Deleted", kind, item)
        db.delete(item)
        db.flush()

    router.add_api_route(f"/{kind}", listing, methods=["GET"], name=f"list_{kind}")
    router.add_api_route(
        f"/{kind}", create, methods=["POST"], status_code=201, name=f"create_{kind}"
    )
    router.add_api_route(
        f"/{kind}/{{record_id}}", detail, methods=["GET"], name=f"get_{kind}"
    )
    router.add_api_route(
        f"/{kind}/{{record_id}}", update, methods=["PUT"], name=f"update_{kind}"
    )
    router.add_api_route(
        f"/{kind}/{{record_id}}",
        remove,
        methods=["DELETE"],
        status_code=204,
        name=f"delete_{kind}",
    )


for kind, schema in [
    ("clients", ClientIn),
    ("leads", LeadIn),
    ("deals", DealIn),
    ("tasks", TaskIn),
]:
    register_resource(kind, schema)


@router.post("/leads/{record_id}/convert", status_code=201)
def convert(record_id: str, db: DB, user: CurrentUser):
    return serialize(convert_lead(db, user, record_id))


@router.patch("/deals/{record_id}/status")
def deal_status(record_id: str, data: StatusIn, db: DB, user: CurrentUser):
    item = owned(db, Deal, record_id, user.id)
    values = DealIn.model_validate(
        {key: getattr(item, key) for key in DealIn.model_fields}
        | {"status": data.status}
    )
    return serialize(save(db, user, "deals", values, item))


@router.patch("/tasks/{record_id}/status")
def task_status(record_id: str, data: StatusIn, db: DB, user: CurrentUser):
    item = owned(db, Task, record_id, user.id)
    values = TaskIn.model_validate(
        {key: getattr(item, key) for key in TaskIn.model_fields}
        | {"status": data.status}
    )
    return serialize(save(db, user, "tasks", values, item))
