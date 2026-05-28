import os
import sys
from fastapi.testclient import TestClient

# Ensure backend can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "OneDrive", "Desktop", "smartflow")))

from backend.main import app
from backend.api.auth import create_token, get_conn

def run_tests():
    client = TestClient(app)
    
    # 1. Generate test tokens with purpose="access"
    token_tenant_a = create_token("userA", "usera@tenant.com", "tenant-a-123", "Tenant_User", "access", 60)
    token_tenant_b = create_token("userB", "userb@tenant.com", "tenant-b-456", "Tenant_User", "access", 60)
    token_no_tenant = create_token("userC", "userc@tenant.com", "", "Tenant_User", "access", 60) # Empty/missing tenant_id
    
    headers_a = {"Authorization": f"Bearer {token_tenant_a}"}
    headers_b = {"Authorization": f"Bearer {token_tenant_b}"}
    headers_no_tenant = {"Authorization": f"Bearer {token_no_tenant}"}
    
    # Clean up any residual test data from previous runs
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sources WHERE id = 'test-src-123'")
    cursor.execute("DELETE FROM connections WHERE id = 'test-conn-123'")
    conn.commit()
    conn.close()

    print("\n--- 1. Testing GET /sources without tenant_id in JWT ---")
    res = client.get("/api/v1/pipelines/sources", headers=headers_no_tenant)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 401
    
    print("\n--- 2. Testing GET /sources without Authorization header ---")
    res = client.get("/api/v1/pipelines/sources")
    print(f"Status: {res.status_code}")
    assert res.status_code == 403 # FastAPI HTTPBearer returns 403 on missing authorization header

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
    res = client.put("/api/v1/pipelines/sources/test-src-123", json={"name": "Hacked Source"}, headers=headers_b)
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
    # Provision a connection for Tenant A
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO connections (id, tenant_id, data, created_at) VALUES ('test-conn-123', 'tenant-a-123', '{}', 'now')")
    conn.commit()
    conn.close()

    res = client.post("/api/v1/pipelines/test-conn-123/sync", json={}, headers=headers_b)
    print(f"Status: {res.status_code}, Detail: {res.json()}")
    assert res.status_code == 403

    # Clean up test database entries
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sources WHERE id = 'test-src-123'")
    cursor.execute("DELETE FROM connections WHERE id = 'test-conn-123'")
    conn.commit()
    conn.close()
    
    print("\n--- ALL ISOLATION TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
