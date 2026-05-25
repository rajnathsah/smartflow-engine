# API Module 🛡️

This directory manages the FastAPI routing layer, request filters, rate limits, and authentication guards for **synq.to**.

---

## 📂 Components

### 1. [**`auth.py`**](auth.py)
Manages workspaces (tenants) onboarding, team invitation distribution, and session credentials.
*   **Context Isolation:** Declares the `tenant_uuid_context` thread context variable using `contextvars.ContextVar`. This ensures that all downstream SQLAlchemy query operations automatically inherit the tenant ID of the authenticated requester.
*   **JWT Security Guard:** Implements the `get_tenant_uuid` dependency. It extracts and decodes authorization headers containing JWT payloads to verify `email`, `role`, and `tenant_uuid`.
*   **Onboarding Flow:**
    *   `POST /api/v1/auth/register`: Creates a new tenant workspace and seeds the user as `Tenant_Admin`.
    *   `POST /api/v1/auth/invite`: Dispatches temporary access credentials to newly invited members.
    *   `POST /api/v1/auth/reset-password`: Processes first-time force resets and clears password constraints.
    *   `POST /api/v1/auth/login`: Handles standard password checks and issues bearer tokens.

### 2. [**`pipelines.py`**](pipelines.py)
Orchestrates connections validation and task delegation.
*   **Synchronous Checks:**
    *   `POST /api/v1/pipelines/verify-source`: Evaluates source connectivity.
    *   `POST /api/v1/pipelines/verify-destination`: Assesses target database availability.
*   **ETL Dispatcher:**
    *   `POST /api/v1/pipelines/sync/{pipeline_id}`: Initiates an asynchronous Celery ETL task.
    *   `GET /api/v1/pipelines/tasks/{task_id}`: Standardized endpoint to check active records count and sync states from the Celery Redis backend.

