"""Explicit, optional demonstration workspace. Never runs on application startup."""

import argparse
import asyncio
import getpass
from datetime import timedelta, datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import password_hash
from app.models import User, Client, Lead, Deal, Task, Tag, ActivityLog, now
from app.schemas import Register


async def seed(email, password):
    data = Register(email=email, password=password, full_name="Alex Morgan")
    async with SessionLocal.begin() as session:

        def populate(db):
            if db.scalar(select(User).where(User.email == str(data.email).lower())):
                raise ValueError(
                    "That account already exists. Choose a new demo email; existing workspaces are never overwritten."
                )
            user = User(
                email=str(data.email).lower(),
                full_name=data.full_name,
                company="Forma Studio",
                password_hash=password_hash.hash(data.password),
            )
            db.add(user)
            db.flush()
            tags = [
                Tag(user_id=user.id, name=name)
                for name in ["Design", "Retainer", "VIP"]
            ]
            db.add_all(tags)
            clients = []
            names = [
                ("Olivia Chen", "Northstar Studio"),
                ("James Wilson", "Acme Digital"),
                ("Sofia Martinez", "Bloom & Co."),
                ("Ethan Parker", "Layers"),
                ("Isabella Rossi", "Meridian"),
                ("Noah Kim", "Linear Labs"),
                ("Ava Thompson", "Oakwell"),
                ("Liam Brooks", "Goodspace"),
            ]
            anchor = now()
            for i, (name, company) in enumerate(names):
                client = Client(
                    user_id=user.id,
                    full_name=name,
                    email=name.lower().replace(" ", ".") + "@example.com",
                    company=company,
                    phone=f"+1 202 555 {100 + i:04}",
                    tags=[tags[i % 3]],
                    notes="Demonstration contact. Replace with your own client information.",
                    created_at=anchor - timedelta(days=12 + i * 19),
                    last_interaction_at=anchor - timedelta(days=i + 1),
                )
                db.add(client)
                clients.append(client)
            db.flush()
            deal_titles = [
                "Brand identity",
                "Website redesign",
                "Monthly creative retainer",
                "Product launch",
                "Content strategy",
                "Design system",
            ]
            deals = []
            for i in range(24):
                status = ["Won", "Won", "Open", "In Progress", "Lost", "Won"][i % 6]
                created = anchor - timedelta(days=3 + i * 7)
                deal = Deal(
                    user_id=user.id,
                    title=f"{deal_titles[i % 6]} · {clients[i % 8].company}",
                    client_id=clients[i % 8].id,
                    value=Decimal(str(1800 + (i % 7) * 650)),
                    status=status,
                    created_at=created,
                    closed_at=created + timedelta(days=2) if status == "Won" else None,
                    expected_close_date=(anchor + timedelta(days=5 + i)).date(),
                    description="A sample project for exploring your pipeline.",
                )
                db.add(deal)
                deals.append(deal)
            db.flush()
            for i, name in enumerate(
                [
                    "Maya Patel",
                    "Lucas Anderson",
                    "Amelia Wright",
                    "Leo Nguyen",
                    "Grace Taylor",
                    "Oscar Davies",
                ]
            ):
                db.add(
                    Lead(
                        user_id=user.id,
                        name=name,
                        email=name.lower().replace(" ", ".") + "@example.com",
                        company=["Arc Studio", "Wonder Co.", "Fieldwork"][i % 3],
                        source=["Referral", "Website", "LinkedIn"][i % 3],
                        status=["New", "Contacted", "Qualified"][i % 3],
                        estimated_value=2500 + i * 1000,
                        notes="Demonstration lead.",
                        created_at=anchor - timedelta(days=i * 5),
                    )
                )
            for i, title in enumerate(
                [
                    "Send Northstar proposal",
                    "Follow up with James",
                    "Review brand direction",
                    "Prepare project kickoff",
                    "Share design concepts",
                    "Send monthly invoice",
                    "Schedule discovery call",
                    "Update project timeline",
                ]
            ):
                task = Task(
                    user_id=user.id,
                    title=title,
                    client_id=clients[i].id,
                    deal_id=deals[i].id,
                    due_date=(anchor + timedelta(days=i - 2)).date(),
                    priority=["High", "Medium", "Low"][i % 3],
                    status="In Progress" if i == 3 else "Pending",
                    description="A sample next step. Edit or complete it to explore your workspace.",
                )
                db.add(task)
            for i, client in enumerate(clients[:5]):
                db.add(
                    ActivityLog(
                        user_id=user.id,
                        action="Created",
                        entity_type="clients",
                        entity_id=client.id,
                        description=f"Created {client.full_name}",
                        created_at=anchor - timedelta(hours=i * 3),
                    )
                )

        await session.run_sync(populate)
    print(
        f"Demo workspace created for {email}: 8 clients, 6 leads, 24 deals, and 8 tasks."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    try:
        asyncio.run(
            seed(
                args.email,
                getpass.getpass("Choose a demo password (at least 10 characters): "),
            )
        )
    except ValueError as exc:
        raise SystemExit(str(exc))
