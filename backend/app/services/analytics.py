from datetime import date, datetime, time, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import select, func
from app.models import Client, Lead, Deal, Task


def analytics(db, user_id, start, end):
    today = date.today()
    end = end or today
    start = start or (end.replace(day=1) - timedelta(days=150)).replace(day=1)
    if start > end or (end - start).days > 3660:
        raise HTTPException(422, "Choose an ordered date range of up to ten years.")
    lower = datetime.combine(start, time.min, timezone.utc)
    upper = datetime.combine(end + timedelta(days=1), time.min, timezone.utc)

    def count(model, *conditions):
        return (
            db.scalar(
                select(func.count())
                .select_from(model)
                .where(model.user_id == user_id, *conditions)
            )
            or 0
        )

    def amount(*conditions):
        return float(
            db.scalar(
                select(func.coalesce(func.sum(Deal.value), 0)).where(
                    Deal.user_id == user_id, *conditions
                )
            )
        )

    def in_range(column):
        return (column >= lower, column < upper)

    total_deals = count(Deal, *in_range(Deal.created_at))
    total_leads = count(Lead, *in_range(Lead.created_at))
    won = count(Deal, Deal.status == "Won", *in_range(Deal.created_at))
    lost = count(Deal, Deal.status == "Lost", *in_range(Deal.created_at))
    converted = count(Lead, Lead.converted_at.is_not(None), *in_range(Lead.created_at))
    months = {}
    cursor = start.replace(day=1)
    while cursor <= end:
        key = cursor.strftime("%Y-%m")
        months[key] = {
            "month": key,
            "label": cursor.strftime("%b %Y"),
            "revenue": 0,
            "clients": 0,
        }
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
    for model, column, measure, key in [
        (Deal, Deal.closed_at, func.sum(Deal.value), "revenue"),
        (Client, Client.created_at, func.count(Client.id), "clients"),
    ]:
        bucket = func.to_char(func.timezone("UTC", column), "YYYY-MM")
        stmt = select(bucket, measure).where(
            model.user_id == user_id, *in_range(column)
        )
        if model is Deal:
            stmt = stmt.where(Deal.status == "Won")
        for month, value in db.execute(stmt.group_by(bucket)):
            if month in months:
                months[month][key] = float(value)
    by_status = []
    for status in ["Open", "In Progress", "Won", "Lost"]:
        by_status.append(
            {
                "name": status,
                "count": count(Deal, Deal.status == status, *in_range(Deal.created_at)),
                "value": amount(Deal.status == status, *in_range(Deal.created_at)),
            }
        )
    return {
        "start": start,
        "end": end,
        "total_clients": count(Client),
        "new_clients": count(Client, *in_range(Client.created_at)),
        "active_leads": count(Lead, Lead.status.in_(["New", "Contacted", "Qualified"])),
        "total_deals": total_deals,
        "revenue": amount(Deal.status == "Won", *in_range(Deal.closed_at)),
        "pipeline_value": amount(Deal.status.in_(["Open", "In Progress"])),
        "pending_tasks": count(Task, Task.status != "Completed"),
        "overdue_tasks": count(Task, Task.status != "Completed", Task.due_date < today),
        "deal_conversion_rate": round(won / (won + lost) * 100, 1) if won + lost else 0,
        "lead_conversion_rate": round(converted / total_leads * 100, 1)
        if total_leads
        else 0,
        "converted_leads": converted,
        "won_deals": won,
        "total_leads": total_leads,
        "series": list(months.values()),
        "deals_by_status": by_status,
    }
