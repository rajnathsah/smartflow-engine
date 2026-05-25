# synq.to Core Backend Engine 🐍

This directory houses the Python-based backend engine for **synq.to**. It orchestrates user authentication, JWT-based RBAC, multi-tenant database thread-isolation, SSH Bastion tunnel configuration, secure AES-256-GCM credential encryption, and asynchronous ETL operations via Celery.

---

## 📂 Directory Structure

*   [**`api/`**](api/): FastAPI route registrations:
    *   `auth.py`: Onboarding, user invitation flow, login endpoints, forced password reset, and SQLite multi-tenant workspace schema mappings. Holds thread-local context management (`contextvars`).
    *   `pipelines.py`: Endpoint to trigger and check Celery ETL pipeline progress/results.
*   [**`database/`**](database/): Database connection factory:
    *   `factory.py`: Generates SQL dialect drivers (`postgresql+asyncpg` / `mysql+asyncmy`) with dynamic database credential decryption and client connection pooling.
*   [**`utils/`**](utils/): Security and infrastructure helpers:
    *   `encryption.py`: AES-256-GCM encryption vault powered by `cryptography.hazmat`.
    *   `tunneling.py`: Context-managed SSH Bastion tunnel generator via `sshtunnel` and `paramiko`.
    *   `logging.py` & `limiter.py`: Structured JSON logger and client request rate-limiting utilities.
*   [**`workers/`**](workers/): Asynchronous ETL tasks:
    *   `celery_app.py`: Celery instance configuration backed by Redis.
    *   `tasks.py`: Standardized extract-transform-load tasks buffering up to 5,000 items per bulk query insert.
    *   `extractors.py`: Stream-oriented paging connectors yielding results using Python generators.

---

## ⚙️ Configuration & Environment

The backend relies on the following environment variables:
*   `MASTER_VAULT_KEY`: A 32-byte key (or string hashed to 32 bytes) used as the AES-256 encryption key to safeguard database passwords.
*   `JWT_SECRET_KEY`: Standard secret phrase to sign and verify authorization tokens.
*   `RESEND_API_KEY`: API token used by the Resend SDK to dispatch workspace team invitations (falls back to local logs when missing).

---

## 🚀 Running the Backend locally

### 1. Python Virtual Environment
Navigate to the root directory, create a virtual environment, and install dependencies:
```bash
# Navigate to project root
cd C:\Users\ADITYA SHAH\OneDrive\Desktop\smartflow

# Create environment
python -m venv venv
venv\Scripts\activate

# Install requirements
pip install -r backend/requirements.txt
```

### 2. Startup FastAPI Server
Launch the HTTP endpoint API using `uvicorn`:
```bash
uvicorn backend.main:app --reload --port 8000
```
API Documentation will be available locally at `http://127.0.0.1:8000/docs`.

### 3. Startup Celery Worker Task Runner
Execute the Celery asynchronous worker task manager (ensure a Redis server is active on `redis://localhost:6379`):
```bash
celery -A backend.workers.celery_app worker --loglevel=info -P solo
```

