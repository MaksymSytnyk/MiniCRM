from datetime import date, timedelta


def test_auth_rotation_logout_and_password(client, account):
    h = account["headers"]
    assert client.get("/api/auth/me", headers=h).json()["email"] == account["email"]
    assert client.get("/api/clients").status_code == 401
    assert (
        client.post(
            "/api/auth/login", json={"email": account["email"], "password": "wrong"}
        ).status_code
        == 401
    )
    old = client.cookies.get("refresh_token")
    response = client.post("/api/auth/refresh")
    assert response.status_code == 200
    rotated = client.cookies.get("refresh_token")
    assert old != rotated
    client.cookies.set(
        "refresh_token", old, domain="testserver.local", path="/api/auth"
    )
    assert client.post("/api/auth/refresh").status_code == 401
    client.cookies.set(
        "refresh_token", rotated, domain="testserver.local", path="/api/auth"
    )
    assert (
        client.post(
            "/api/auth/refresh", headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me", headers=h).status_code == 401
    login = client.post(
        "/api/auth/login",
        json={"email": account["email"], "password": account["password"]},
    )
    h = {"Authorization": "Bearer " + login.json()["access_token"]}
    assert (
        client.post(
            "/api/auth/password",
            headers=h,
            json={
                "current_password": account["password"],
                "new_password": "new secure password 123",
            },
        ).status_code
        == 204
    )
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert (
        client.post(
            "/api/auth/login",
            json={"email": account["email"], "password": "new secure password 123"},
        ).status_code
        == 200
    )


def test_full_crm_lifecycle_and_analytics(client, account):
    h = account["headers"]
    c = client.post(
        "/api/clients",
        headers=h,
        json={
            "full_name": "Taylor Reed",
            "email": "taylor@example.com",
            "company": "Northstar",
            "tags": ["VIP", "Design"],
            "notes": "Prefers email",
        },
    )
    assert c.status_code == 201, c.text
    c = c.json()
    assert set(c["tags"]) == {"VIP", "Design"}
    assert (
        client.get(
            "/api/clients?q=taylor&tag=VIP&sort=full_name&order=asc", headers=h
        ).json()["total"]
        == 1
    )
    assert client.get("/api/clients?q=nothing", headers=h).json()["total"] == 0
    assert client.get("/api/clients?sort=password_hash", headers=h).status_code == 422
    assert client.get("/api/clients?page=0", headers=h).status_code == 422
    bad = client.post("/api/deals", headers=h, json={"title": "Invalid", "value": -1})
    assert bad.status_code == 422
    deal = client.post(
        "/api/deals",
        headers=h,
        json={"title": "Brand refresh", "client_id": c["id"], "value": "4200.50"},
    ).json()
    assert deal["client_name"] == "Taylor Reed"
    assert (
        client.patch(
            f"/api/deals/{deal['id']}/status", headers=h, json={"status": "Won"}
        ).status_code
        == 200
    )
    due = str(date.today() - timedelta(days=1))
    task = client.post(
        "/api/tasks",
        headers=h,
        json={
            "title": "Send proposal",
            "due_date": due,
            "priority": "High",
            "client_id": c["id"],
            "deal_id": deal["id"],
        },
    ).json()
    assert client.get("/api/tasks?overdue=true", headers=h).json()["total"] == 1
    assert (
        client.patch(
            f"/api/tasks/{task['id']}/status", headers=h, json={"status": "Completed"}
        ).status_code
        == 200
    )
    assert client.get("/api/tasks?overdue=true", headers=h).json()["total"] == 0
    lead = client.post(
        "/api/leads",
        headers=h,
        json={
            "name": "Casey Lane",
            "email": "casey@example.com",
            "estimated_value": "8000",
            "status": "Qualified",
        },
    ).json()
    converted = client.post(f"/api/leads/{lead['id']}/convert", headers=h)
    assert converted.status_code == 201
    assert converted.json()["full_name"] == "Casey Lane"
    assert client.post(f"/api/leads/{lead['id']}/convert", headers=h).status_code == 409
    assert (
        client.post(
            "/api/leads",
            headers=h,
            json={"name": "Fake conversion", "status": "Converted"},
        ).status_code
        == 422
    )
    a = client.get("/api/analytics", headers=h).json()
    assert a["revenue"] == 4200.5
    assert a["total_clients"] == 2
    assert a["lead_conversion_rate"] == 100
    assert a["deal_conversion_rate"] == 100
    assert sum(x["revenue"] for x in a["series"]) == 4200.5
    assert (
        client.get(
            "/api/analytics?start=2026-02-01&end=2026-01-01", headers=h
        ).status_code
        == 422
    )
    assert (
        client.get("/api/analytics?start=2000-01-01&end=2000-12-31", headers=h).json()[
            "revenue"
        ]
        == 0
    )
    assert client.get("/api/activity", headers=h).json()["total"] >= 7
    assert client.delete(f"/api/clients/{c['id']}", headers=h).status_code == 204
    assert client.get(f"/api/deals/{deal['id']}", headers=h).json()["client_id"] is None
    assert client.get(f"/api/tasks/{task['id']}", headers=h).json()["client_id"] is None
    assert client.delete(f"/api/deals/{deal['id']}", headers=h).status_code == 204
    assert client.get(f"/api/tasks/{task['id']}", headers=h).json()["deal_id"] is None
    assert client.delete(f"/api/tasks/{task['id']}", headers=h).status_code == 204
    assert client.delete(f"/api/leads/{lead['id']}", headers=h).status_code == 204


def test_cross_user_access_is_denied(client, account):
    h = account["headers"]
    c = client.post(
        "/api/clients",
        headers=h,
        json={"full_name": "Private client", "tags": ["Private"]},
    ).json()
    d = client.post(
        "/api/deals", headers=h, json={"title": "Private deal", "client_id": c["id"]}
    ).json()
    lead = client.post("/api/leads", headers=h, json={"name": "Private lead"}).json()
    other = client.post(
        "/api/auth/register",
        json={
            "full_name": "Other Owner",
            "email": "other@example.com",
            "password": "another secure password",
        },
    ).json()
    oh = {"Authorization": "Bearer " + other["access_token"]}
    for kind, record in [("clients", c), ("deals", d), ("leads", lead)]:
        assert client.get(f"/api/{kind}/{record['id']}", headers=oh).status_code == 404
        assert (
            client.delete(f"/api/{kind}/{record['id']}", headers=oh).status_code == 404
        )
    assert (
        client.put(
            f"/api/clients/{c['id']}", headers=oh, json={"full_name": "Hijacked"}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/deals/{d['id']}/status", headers=oh, json={"status": "Won"}
        ).status_code
        == 404
    )
    assert (
        client.post(f"/api/leads/{lead['id']}/convert", headers=oh).status_code == 404
    )
    assert (
        client.post(
            "/api/deals",
            headers=oh,
            json={"title": "Cross owner", "client_id": c["id"]},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/tasks", headers=oh, json={"title": "Cross owner", "deal_id": d["id"]}
        ).status_code
        == 404
    )
    assert client.get("/api/clients", headers=oh).json()["total"] == 0
    assert client.get("/api/tags", headers=oh).json() == []
    assert client.get("/api/activity", headers=oh).json()["total"] == 0
    assert client.get("/api/analytics", headers=oh).json()["revenue"] == 0


def test_profile_update_pagination_and_account_deletion(client, account):
    h = account["headers"]
    response = client.put(
        "/api/auth/me",
        headers=h,
        json={"full_name": "Alex Updated", "company": "Studio", "theme": "light"},
    )
    assert response.json()["theme"] == "light"
    for i in range(12):
        assert (
            client.post(
                "/api/clients", headers=h, json={"full_name": f"Client {i:02}"}
            ).status_code
            == 201
        )
    page = client.get(
        "/api/clients?page=2&page_size=5&sort=full_name&order=asc", headers=h
    ).json()
    assert page["total"] == 12
    assert len(page["items"]) == 5
    assert page["items"][0]["full_name"] == "Client 05"
    assert (
        client.request(
            "DELETE", "/api/auth/me", headers=h, json={"password": "wrong"}
        ).status_code
        == 400
    )
    assert (
        client.request(
            "DELETE", "/api/auth/me", headers=h, json={"password": account["password"]}
        ).status_code
        == 204
    )
    assert client.get("/api/auth/me", headers=h).status_code == 401
