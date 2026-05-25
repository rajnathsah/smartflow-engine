# synq.to Frontend Source Code 💻

This directory houses the React, TypeScript, and Tailwind CSS frontend application for **synq.to**. It contains the complete client-side dashboard interfaces, multi-tenant authentication portal, drag-and-drop workspace connection flows, and live Celery task metrics polling.

---

## 📂 Directory Structure

*   [**`components/`**](components/): Reusable UI layouts and primary view modules:
    *   `Login.tsx`: Stark monochromatic entry page containing mock Google OAuth logic, tenant onboarding registration, and the first-login force password reset view.
    *   `CreatePipelineForm.tsx`: Multi-step wizard to register sources, choose database targets, map schemas, and schedule sync cycles.
    *   `PipelinesTable.tsx`: Connection monitor displaying pipeline details, last sync state, and inline controls to trigger sync execution.
    *   `LiveDashboard.tsx`: Monochromatic logs streaming panel and task progress tracker for active ETL processes.
    *   `UsersTable.tsx`: RBAC directory listing teammate invitations, registration status, and workspace role assignments.
*   [**`store/`**](store/): Zustand global state management:
    *   `authStore.ts`: Coordinates JWT tokens, tenant details, password reset states, and user sessions.
    *   `pipelineStore.ts`: Standardizes connection status tracking and stores loaded configuration profiles.
*   [**`types/`**](types/): TypeScript interface definitions:
    *   `index.ts`: Strong typing specifications for `Pipeline`, `Source`, `Destination`, `User`, `Tenant`, and JWT payload claims.
*   [**`lib/`**](lib/): Shared library initializations and API integration layer.
*   [**`assets/`**](assets/): Icons, styles, brand watermarks, and favicon vector assets.

---

## ⚙️ Key Architectures

### 1. Multi-Tenant Onboarding & RBAC
The frontend is deeply integrated with role-based restrictions. Access to team directory management and connection modifications is strictly guarded on the client-side based on JWT payloads indicating a role of `Tenant_Admin` or `Super_Admin` versus `Tenant_User`.

### 2. Live Task Telemetry Polling
When a connection is triggered, the client executes an active polling loop against the FastAPI `/api/v1/pipelines/tasks/{task_id}` worker endpoint every 2 seconds, reactively committing pipeline record counts and execution state changes to the local state.

### 3. Client-Side PEM Parsing
SSH private keys drop-zones serialize file text contents in-memory via browser `FileReader` API rather than uploading raw credential streams, enabling secure transfer payloads directly to the backend AES-256 vault.
