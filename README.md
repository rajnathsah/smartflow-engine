# synq.to

> **Enterprise-grade Universal Data Sync Engine.**
> Zero-touch ETL. Auto-infer schemas and sync databases in minutes, not days.

[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Built with FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](backend/)
[![Built with React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react)](src/)
[![Powered by Celery](https://img.shields.io/badge/Workers-Celery%20%2B%20Redis-green)](backend/workers/)

---

## 🗂 Monorepo Structure

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
│   └── requirements.txt    # Python dependencies
├── docker/                 # Docker helper configs and compose overrides
│   └── .gitkeep
├── docs/                   # Architecture docs, API references, ADRs
│   └── .gitkeep
├── frontend/               # Reserved for standalone frontend builds
│   └── .gitkeep
├── src/                    # Active React + TypeScript frontend app
│   ├── components/         # UI views (Login, Dashboard, Forms, Tables)
│   ├── store/              # Zustand state management
│   ├── types/              # Shared TypeScript interfaces
│   └── lib/                # API client and shared utilities
├── tests/                  # Integration and end-to-end test suites
│   └── .gitkeep
├── .dockerignore           # Docker build context exclusion rules
├── .env.example            # Environment variable template (copy to .env)
├── .gitignore              # VCS exclusion rules
├── docker-compose.yml      # Full-stack local orchestration
├── Dockerfile.backend      # Backend production image
├── Dockerfile.frontend     # Frontend production image
├── LICENSE                 # MIT License
├── netlify.toml            # Netlify SPA redirect config
├── package.json            # Frontend Node.js manifest
└── README.md               # You are here
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v18+ |
| Python | v3.11+ |
| Redis | v7+ |
| npm | v9+ |

---

### 1 — Clone the Repository

```bash
git clone https://github.com/aditya25shah/synq.to.git
cd synq.to
```

### 2 — Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in your `JWT_SECRET_KEY`, `MASTER_VAULT_KEY`, `RESEND_API_KEY`, and `REDIS_URL`.

---

### 3 — Run with Docker Compose (Recommended)

Spins up the FastAPI backend, Celery worker, Redis broker, and the Vite frontend in one command:

```bash
cd docker
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Redis | localhost:6379 |

---

### 4 — Run Services Manually

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

## 🏗 Architecture Overview

```
 Browser (React SPA)
       │
       │  REST + JWT
       ▼
 FastAPI  ──────────► SQLite (Auth / Tenants)
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

- **Multi-Tenant RBAC:** Every request carries a JWT embedding `tenant_uuid` and `role`. All database queries are isolated per tenant via `contextvars.ContextVar`.
- **Zero Plain-Text Secrets:** Database passwords are encrypted at rest using AES-256-GCM before any storage.
- **Stream-First ETL:** Extractors use Python generators to page through API responses without loading full datasets into memory.
- **Strict Monochrome UI:** The frontend enforces a True Black (`#000000`) / Pure White (`#FFFFFF`) design system with no color dependencies.

---

## 🔐 Security

- Passwords hashed with `bcrypt` via `passlib` — never stored in plain text.
- JWT tokens embed `email`, `tenant_uuid`, and `role` to eliminate per-request database lookups.
- SSH private keys are read client-side via `FileReader` and transmitted encrypted — never stored to disk.
- AES-256-GCM encryption (via `cryptography.hazmat`) for all credential storage.
- SlowAPI rate limiting on all public endpoints.

---

## 📦 Tech Stack

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
| SQLite | Multi-tenant auth and user store |
| Celery + Redis | Async ETL task queue |
| httpx | Resilient HTTP extraction client |
| python-jose | JWT signing and verification |
| passlib + bcrypt | Secure password hashing |
| cryptography | AES-256-GCM vault |
| sshtunnel + paramiko | SSH Bastion tunneling |
| structlog | Structured JSON logging |
| slowapi | Rate limiting |

---

## 📄 License

Distributed under the [MIT License](LICENSE).  
Copyright © 2026 **synq.to**
