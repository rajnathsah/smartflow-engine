from celery import Celery
from backend.config import settings

app = Celery(
    "synq_workers",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

app.conf.update(
    worker_max_tasks_per_child=50,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_time_limit=3600,
    task_soft_time_limit=3300,
    imports=["backend.workers.tasks"]
)

if __name__ == "__main__":
    app.start()
