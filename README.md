# synq.to

Enterprise-grade Universal Data Sync Engine.
Zero-touch ETL. Auto-infer schemas and sync databases in minutes, not days.

---

## Monorepo Structure

```
synq.to/
├── .github/                # CI/CD workflows (GitHub Actions)
│   └── .gitkeep
├── backend/                # Python FastAPI backend engine
│   ├── api/                # Route handlers (auth, pipelines)
│   ├── database/           # Async SQLAlchemy engine factory
│   ├── utils/              # Encryption vault, SSH tunneling, logging
│   ├── workers/            # Celery ETL tasks and stream extractors
│   ├── main.py             # FastAPI application entrypoint
│   ├── Dockerfile          # Backend development Docker configuration
│   └── requirements.txt    # Python dependencies
├── docker/                 # Legacy/production Docker configurations
├── docs/                   # Architecture docs, API references, ADRs
│   └── .gitkeep
├── frontend/               # Standalone frontend build folder
│   ├── src/                # Active React + TypeScript frontend app
│   │   ├── components/     # UI views (Login, Dashboard, Forms, Tables)
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # Shared TypeScript interfaces
│   │   └── lib/            # API client and shared utilities
│   ├── Dockerfile          # Frontend development Docker configuration
│   ├── package.json        # Frontend Node.js manifest
│   └── vite.config.ts      # Vite configuration file
├── tests/                  # Integration and end-to-end test suites
│   └── .gitkeep
├── .dockerignore           # Docker build context exclusion rules
├── .env.example            # Environment variable template (copy to .env)
├── .gitignore              # VCS exclusion rules
├── docker-compose.yml      # Monorepo full-stack local orchestration
├── LICENSE                 # MIT License
└── README.md               # You are here
```

---

## Monorepo Component Details

### Backend Core (backend/)
The backend is a FastAPI application orchestrating user authentication, JWT-based RBAC, multi-tenant database thread-isolation, SSH Bastion tunnel configuration, secure AES-256-GCM credential encryption, and asynchronous ETL operations via Celery.

*   **API Module (backend/api/)**: FastAPI route registrations:
    *   auth.py: Onboarding, user invitation flow, login endpoints, forced password reset, and PostgreSQL multi-tenant workspace schema mappings. Manages thread-local context using Python contextvars.
    *   pipelines.py: Endpoint to trigger and check Celery ETL pipeline progress and results.
*   **Database Module (backend/database/)**: Database connection factory:
    *   factory.py: Generates SQL dialect drivers (postgresql+asyncpg / mysql+asyncmy) with dynamic database credential decryption and client connection pooling. Enforces strict execution limits (pool_size=20, max_overflow=10, pool_timeout=30, pool_pre_ping=True) to maintain socket stability during bulk transfers.
*   **Utilities Module (backend/utils/)**: Security and infrastructure helpers:
    *   encryption.py: AES-256-GCM encryption vault powered by cryptography.hazmat. Hashes environmental MASTER_VAULT_KEY values to verify exactly 32-byte master parameters.
    *   tunneling.py: Placeholder for SSH Bastion tunneling (disabled/removed).
    *   logging.py and limiter.py: Structured JSON logger (structlog) and client request rate-limiting utilities (slowapi).
*   **Asynchronous Workers (backend/workers/)**: Asynchronous ETL tasks:
    *   celery_app.py: Celery instance configuration backed by Redis. Configured to avoid OOM faults: worker_max_tasks_per_child=50 (forces process recycling), task_acks_late=True (guarantees delivery), and worker_prefetch_multiplier=1 (prevents hoarding).
    *   tasks.py: Standardized extract-transform-load tasks buffering up to 5,000 items per bulk query insert.
    *   extractors.py: Stream-oriented paging connectors yielding results using Python generators (yield) to limit memory footprints, with exponential backoffs and Retry-After header parsing.

### Frontend Application (frontend/)
The frontend is a React, TypeScript, and Tailwind CSS application providing a monochromatic interface for system administration.

*   **Components (frontend/src/components/)**: Reusable UI layouts and primary view modules:
    *   Login.tsx: Monochromatic entry page containing mock Google OAuth logic, tenant onboarding registration, and the first-login force password reset view.
    *   CreatePipelineForm.tsx: Multi-step wizard to register sources, choose database targets, map schemas, and schedule sync cycles.
    *   PipelinesTable.tsx: Connection monitor displaying pipeline details, last sync state, and inline controls to trigger sync execution.
    *   LiveDashboard.tsx: Monochromatic logs streaming panel and task progress tracker for active ETL processes.
    *   UsersTable.tsx: RBAC directory listing teammate invitations, registration status, and workspace role assignments.
*   **Zustand Store (frontend/src/store/)**: Global state management:
    *   authStore.ts: Coordinates JWT tokens, tenant details, password reset states, and user sessions.
    *   pipelineStore.ts: Standardizes connection status tracking and stores loaded configuration profiles.
*   **Types (frontend/src/types/)**: TypeScript interface definitions:
    *   index.ts: Strong typing specifications for Pipeline, Source, Destination, User, Tenant, and JWT payload claims.

---

## Configuration and Environment

The backend relies on the following environment variables:
*   MASTER_VAULT_KEY: A 32-byte key (or string hashed to 32 bytes) used as the AES-256 encryption key to safeguard database passwords.
*   JWT_SECRET_KEY: Standard secret phrase to sign and verify authorization tokens.
*   N8N_WEBHOOK_URL: Webhook URL used to dispatch workspace team invitations via n8n.
*   POSTGRES_SERVER, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT: PostgreSQL connection details.
*   DB_POOL_SIZE: Database pool configuration (default is 5).
*   SERVICE_NAME: Configurable name of the running backend instance (default is "Synq.to").

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v18+ |
| Python | v3.11+ |
| Redis | v7+ |
| npm | v9+ |

---

### 1 - Clone the Repository

```bash
git clone https://github.com/aditya25shah/synq.to.git
cd synq.to
```

### 2 - Configure Environment

```bash
cp .env.example .env
```

Open .env and fill in your JWT_SECRET_KEY, MASTER_VAULT_KEY, N8N_WEBHOOK_URL, and REDIS_URL.

---

### 3 - Run with Docker Compose (Recommended)

Spins up the FastAPI backend, Celery worker, Redis broker, MySQL database, and the Vite frontend with hot-reloading enabled in one command:

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Redis | localhost:6379 |
| MySQL | localhost:3306 |

---

### 4 - Run Services Manually

#### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

#### Backend (FastAPI + Uvicorn)

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

#### Celery Worker

```bash
celery -A backend.workers.celery_app worker --loglevel=info -P solo
```

---

## Architecture Overview

```
 Browser (React SPA)
       │
       │  REST + JWT
       ▼
 FastAPI  ──────────► PostgreSQL (Auth / Tenants)
       │
       │  Celery Task Dispatch
       ▼
 Redis Broker
       │
       ▼
 Celery Worker
       │
   ┌───┴───────────────┐
   │                   │
   ▼                   ▼
 REST API Source    SQL Destination
 (httpx stream)     (asyncpg/asyncmy)
```

### Key Design Principles

*   Multi-Tenant RBAC: Every request carries a JWT embedding tenant_uuid and role. All database queries are isolated per tenant via contextvars.ContextVar.
*   Zero Plain-Text Secrets: Database passwords are encrypted at rest using AES-256-GCM before any storage.
*   Stream-First ETL: Extractors use Python generators to page through API responses without loading full datasets into memory.
*   Strict Monochrome UI: The frontend enforces a True Black (#000000) / Pure White (#FFFFFF) design system with no color dependencies.
*   Live Task Telemetry Polling: When a connection is triggered, the client executes an active polling loop against the FastAPI /api/v1/pipelines/tasks/{task_id} worker endpoint every 2 seconds, reactively committing pipeline record counts and execution state changes to the local state.
*   Client-Side PEM Parsing: SSH private keys drop-zones serialize file text contents in-memory via browser FileReader API rather than uploading raw credential streams, enabling secure transfer payloads directly to the backend AES-256 vault.

---

## Security

*   Passwords hashed with bcrypt via passlib — never stored in plain text.
*   JWT tokens embed email, tenant_uuid, and role to eliminate per-request database lookups.
*   SSH private keys are read client-side via FileReader and transmitted encrypted — never stored to disk.
*   AES-256-GCM encryption (via cryptography.hazmat) for all credential storage.
*   SlowAPI rate limiting on all public endpoints.

---

## Tech Stack

### Frontend
| Library | Purpose |
|---------|---------|
| React 18 + TypeScript | UI framework |
| Vite | Dev server and bundler |
| Tailwind CSS | Utility-first styling |
| Zustand | Global state management |
| React Hook Form + Zod | Forms and schema validation |
| Framer Motion | Animations and transitions |
| Lucide React | Icon system |

### Backend
| Library | Purpose |
|---------|---------|
| FastAPI | HTTP API framework |
| SQLAlchemy 2.0 (async) | ORM and connection pool |
| PostgreSQL | Multi-tenant auth and user store |
| Celery + Redis | Async ETL task queue |
| httpx | Resilient HTTP extraction client |
| python-jose | JWT signing and verification |
| passlib + bcrypt | Secure password hashing |
| cryptography | AES-256-GCM vault |
| structlog | Structured JSON logging |
| slowapi | Rate limiting |

---

## License

Distributed under the MIT License.  
Copyright (C) 2026 synq.to
