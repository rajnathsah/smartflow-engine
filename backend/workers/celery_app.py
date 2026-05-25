import os
from celery import Celery

# Load broker and backend settings from environment variables
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

app = Celery(
    "synq_workers",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

# Apply performance and reliability configurations
app.conf.update(
    # Force worker child processes to restart after executing 50 tasks.
    # This prevents Out-Of-Memory (OOM) failures from memory leaks in third-party libraries.
    worker_max_tasks_per_child=50,
    
    # Acknowledge tasks only AFTER they have completed execution.
    # If a worker crashes mid-task, Celery will redeliver it instead of dropping it.
    task_acks_late=True,
    
    # Restrict prefetch limit to exactly 1 task per worker.
    # Prevents worker nodes from hoarding long-running data sync tasks.
    worker_prefetch_multiplier=1,
    
    # Set strict JSON serialization protocols
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Task time limits to prevent hanging connections
    task_time_limit=3600,       # Max 1 hour per execution
    task_soft_time_limit=3300,  # Warning at 55 minutes
    
    # Auto-discover task modules
    imports=["backend.workers.tasks"]
)

if __name__ == "__main__":
    app.start()
