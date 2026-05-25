# Database Module 🗄️

This directory manages connection dialects and connection engine bootstrapping.

## Components

*   [**`factory.py`**](factory.py):
    *   **Async Drivers:** Constructs SQLAlchemy 2.0 AsyncEngines (`postgresql+asyncpg` or `mysql+asyncmy`) based on UI inputs.
    *   **Decryption Sync:** Connects to the vault module to decrypt database password credentials dynamically.
    *   **Connection Pooling:** Enforces strict execution limits (`pool_size=20`, `max_overflow=10`, `pool_timeout=30`, `pool_pre_ping=True`) to maintain socket stability during bulk transfers.
