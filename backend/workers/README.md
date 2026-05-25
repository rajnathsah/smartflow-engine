# Asynchronous ETL Workers Module ⚙️

This directory hosts Celery task managers, api stream extractions, and target loader modules.

## Components

*   [**`celery_app.py`**](celery_app.py):
    *   **Safeguard Configs:** Configures Celery optimizations to avoid OOM faults: `worker_max_tasks_per_child=50` (forces process recycling), `task_acks_late=True` (guarantees delivery), and `worker_prefetch_multiplier=1` (prevents hoarding).
    
*   [**`extractors.py`**](extractors.py):
    *   **Paging Streams:** Employs generators (`yield`) to stream page lists, limiting memory footprints.
    *   **Resiliency:** Implements exponential backoffs and parses standard `Retry-After` headers during rate limits.
    
*   [**`tasks.py`**](tasks.py):
    *   **ETL Task:** Integrates extractors and db factories under Celery.
    *   **Bulk Loading:** Buffers records up to exactly 5,000 items and executes fast SQLAlchemy 2.0 bulk database insert queries.
