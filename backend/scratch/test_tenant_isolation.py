import os
import sys
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.main import app
from backend.services.auth_service import AuthService
from backend.database.database import SessionLocal
from backend.models import Tenant, Source, Connection

def run_tests():
    """Executes multi-tenant data isolation integration tests."""
    client = TestClient(app)
    auth_service = AuthService()
    token_tenant_a = auth_service.create_token("userA", "usera@tenant.com", "tenant-a-123", "Tenant_User", "access", 60)
    token_tenant_b = auth_service.create_token("userB", "userb@tenant.com", "tenant-b-456", "Tenant_User", "access", 60)
    token_no_tenant = auth_service.create_token("userC", "userc@tenant.com", "", "Tenant_User", "access", 60)
    
    headers_a = {"Authorization": f"Bearer {token_tenant_a}"}
    headers_b = {"Authorization": f"Bearer {token_tenant_b}"}
    headers_no_tenant = {"Authorization": f"Bearer {token_no_tenant}"}
    
    with SessionLocal() as db:
        db.query(Source).filter(Source.id == "test-src-123").delete()
        db.query(Connection).filter(Connection.id == "test-conn-123").delete()
        db.query(Tenant).filter(Tenant.tenant_id.in_(["tenant-a-123", "tenant-b-456"])).delete()
        
        tenant_a = Tenant(tenant_id="tenant-a-123", tenant_uuid="tenant-a-123", name="Tenant A Workspace", created_at="now")
        tenant_b = Tenant(tenant_id="tenant-b-456", tenant_uuid="tenant-b-456", name="Tenant B Workspace", created_at="now")
        db.add(tenant_a)
        db.add(tenant_b)
        db.commit()

    print("\n--- 1. Testing GET /sources without tenant_id in JWT ---")
    res = client.get("/api/v1/pipelines/sources", headers=headers_no_tenant)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 401
    
    print("\n--- 2. Testing GET /sources without Authorization header ---")
    res = client.get("/api/v1/pipelines/sources")
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code in (401, 403)

    print("\n--- 3. Testing POST /sources for Tenant A ---")
    payload = {
        "id": "test-src-123",
        "name": "Tenant A Source",
        "type": "api",
        "url": "http://api.tenant-a.com"
    }
    res = client.post("/api/v1/pipelines/sources", json=payload, headers=headers_a)
    print(f"Status: {res.status_code}, Body: {res.json()}")
    assert res.status_code == 201
    assert res.json()["tenant_id"] == "tenant-a-123"

    print("\n--- 4. Testing GET /sources for Tenant A and Tenant B ---")
    res_a = client.get("/api/v1/pipelines/sources", headers=headers_a)
    print(f"Tenant A sources count: {len(res_a.json())}")
    assert len(res_a.json()) >= 1
    assert any(s["id"] == "test-src-123" for s in res_a.json())

    res_b = client.get("/api/v1/pipelines/sources", headers=headers_b)
    print(f"Tenant B sources count: {len(res_b.json())}")
    assert not any(s["id"] == "test-src-123" for s in res_b.json())

    print("\n--- 5. Testing GET /sources/test-src-123 for Tenant B ---")
    res = client.get("/api/v1/pipelines/sources/test-src-123", headers=headers_b)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 404

    print("\n--- 6. Testing PUT /sources/test-src-123 for Tenant B ---")
    res = client.put("/api/v1/pipelines/sources/test-src-123", json={"name": "Hacked Source", "type": "api"}, headers=headers_b)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 404

    print("\n--- 7. Testing DELETE /sources/test-src-123 for Tenant B ---")
    res = client.delete("/api/v1/pipelines/sources/test-src-123", headers=headers_b)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 404

    print("\n--- 8. Testing POST /sources to hijack ID test-src-123 by Tenant B ---")
    hijack_payload = {
        "id": "test-src-123",
        "name": "Hijacked Name",
        "type": "api"
    }
    res = client.post("/api/v1/pipelines/sources", json=hijack_payload, headers=headers_b)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 403

    print("\n--- 9. Testing trigger sync cross-tenant hijack for Tenant B ---")
    with SessionLocal() as db:
        new_conn = Connection(id="test-conn-123", tenant_id="tenant-a-123", data="{}", created_at="now", updated_at="now")
        db.add(new_conn)
        db.commit()

    res = client.post("/api/v1/pipelines/test-conn-123/sync", json={}, headers=headers_b)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 403

    with SessionLocal() as db:
        db.query(Source).filter(Source.id == "test-src-123").delete()
        db.query(Connection).filter(Connection.id == "test-conn-123").delete()
        db.query(Tenant).filter(Tenant.tenant_id.in_(["tenant-a-123", "tenant-b-456"])).delete()
        db.commit()
    
    print("\n--- ALL ISOLATION TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
