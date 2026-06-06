import os
import sys
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app
from backend.services.auth_service import AuthService
from backend.database.database import SessionLocal
from backend.models import Tenant, Connection, Pipeline

def run_tests():
    print("--- Running Pipeline Refactor Unit Tests ---")
    client = TestClient(app)
    auth_service = AuthService(None)
    token_tenant_a = auth_service.create_token("userA", "usera@tenant.com", "tenant-a-123", "Tenant_Admin", "access", 60)
    token_tenant_b = auth_service.create_token("userB", "userb@tenant.com", "tenant-b-456", "Tenant_Admin", "access", 60)
    
    headers_a = {"Authorization": f"Bearer {token_tenant_a}"}
    headers_b = {"Authorization": f"Bearer {token_tenant_b}"}

    with SessionLocal() as db:
        # Cleanup
        db.query(Pipeline).filter(Pipeline.id.in_(["test-pipe-1", "test-pipe-2"])).delete()
        db.query(Connection).filter(Connection.id.in_(["conn-src-1", "conn-dest-1", "conn-src-2", "conn-dest-2"])).delete()
        db.query(Tenant).filter(Tenant.tenant_id.in_(["tenant-a-123", "tenant-b-456"])).delete()
        
        # Setup tenants
        tenant_a = Tenant(tenant_id="tenant-a-123", tenant_uuid="tenant-a-123", name="Tenant A Workspace", created_at="now")
        tenant_b = Tenant(tenant_id="tenant-b-456", tenant_uuid="tenant-b-456", name="Tenant B Workspace", created_at="now")
        db.add(tenant_a)
        db.add(tenant_b)
        db.commit()

        # Setup connections for Tenant A
        conn_src_1 = Connection(id="conn-src-1", tenant_id="tenant-a-123", data='{"name": "Source A"}', created_at="now")
        conn_dest_1 = Connection(id="conn-dest-1", tenant_id="tenant-a-123", data='{"name": "Dest A"}', created_at="now")
        db.add(conn_src_1)
        db.add(conn_dest_1)

        # Setup connections for Tenant B
        conn_src_2 = Connection(id="conn-src-2", tenant_id="tenant-b-456", data='{"name": "Source B"}', created_at="now")
        conn_dest_2 = Connection(id="conn-dest-2", tenant_id="tenant-b-456", data='{"name": "Dest B"}', created_at="now")
        db.add(conn_src_2)
        db.add(conn_dest_2)
        db.commit()

    print("\n--- 1. Testing POST /pipelines (Successful creation) ---")
    payload = {
        "id": "test-pipe-1",
        "source_connection_id": "conn-src-1",
        "destination_connection_id": "conn-dest-1"
    }
    res = client.post("/api/v1/pipelines/pipelines", json=payload, headers=headers_a)
    print(f"Status: {res.status_code}, Body: {res.json()}")
    assert res.status_code == 201
    assert res.json()["source_connection_id"] == "conn-src-1"
    assert res.json()["destination_connection_id"] == "conn-dest-1"

    print("\n--- 2. Testing POST /pipelines with invalid connection IDs ---")
    payload_invalid = {
        "id": "test-pipe-2",
        "source_connection_id": "non-existent-src",
        "destination_connection_id": "conn-dest-1"
    }
    res = client.post("/api/v1/pipelines/pipelines", json=payload_invalid, headers=headers_a)
    print(f"Status: {res.status_code}, Body: {res.json()}")
    assert res.status_code == 400
    assert "does not exist" in res.json()["detail"]

    print("\n--- 3. Testing POST /pipelines with cross-tenant connection IDs ---")
    payload_cross = {
        "id": "test-pipe-2",
        "source_connection_id": "conn-src-2", # belongs to Tenant B
        "destination_connection_id": "conn-dest-1"
    }
    res = client.post("/api/v1/pipelines/pipelines", json=payload_cross, headers=headers_a)
    print(f"Status: {res.status_code}, Body: {res.json()}")
    assert res.status_code == 400
    assert "does not exist" in res.json()["detail"] # should treat Tenant B's connection as non-existent to Tenant A

    print("\n--- 4. Testing GET /pipelines ---")
    res = client.get("/api/v1/pipelines/pipelines", headers=headers_a)
    print(f"Status: {res.status_code}, Body: {res.json()}")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == "test-pipe-1"

    print("\n--- 5. Testing PUT /pipelines/{id} (Successful update) ---")
    payload_update = {
        "source_connection_id": "conn-dest-1", # swap them for test
        "destination_connection_id": "conn-src-1"
    }
    res = client.put("/api/v1/pipelines/pipelines/test-pipe-1", json=payload_update, headers=headers_a)
    print(f"Status: {res.status_code}, Body: {res.json()}")
    assert res.status_code == 200
    assert res.json()["source_connection_id"] == "conn-dest-1"
    assert res.json()["destination_connection_id"] == "conn-src-1"

    print("\n--- 6. Testing DELETE /pipelines/{id} ---")
    res = client.delete("/api/v1/pipelines/pipelines/test-pipe-1", headers=headers_a)
    print(f"Status: {res.status_code}, Body: {res.json()}")
    assert res.status_code == 200
    assert res.json()["status"] == "deleted"

    with SessionLocal() as db:
        # Cleanup
        db.query(Pipeline).filter(Pipeline.id.in_(["test-pipe-1", "test-pipe-2"])).delete()
        db.query(Connection).filter(Connection.id.in_(["conn-src-1", "conn-dest-1", "conn-src-2", "conn-dest-2"])).delete()
        db.query(Tenant).filter(Tenant.tenant_id.in_(["tenant-a-123", "tenant-b-456"])).delete()
        db.commit()

    print("\n--- ALL PIPELINE REFACTOR TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
