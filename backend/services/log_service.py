"""
Log Service — reads and writes per-run structured log entries for pipeline executions.
Each row is keyed by (run_id, tenant_id) where run_id == Celery task_id.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.pipeline import PipelineRunLog


class LogService:
    def __init__(self, db: Session, tenant_id: str) -> None:
        self.db = db
        self.tenant_id = tenant_id

    # ── Write ─────────────────────────────────────────────────────────────────

    def append_log(
        self,
        run_id: str,
        level: str,
        message: str,
        pipeline_id: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> PipelineRunLog:
        """Append a single log entry for a pipeline run."""
        max_seq: int = (
            self.db.query(func.max(PipelineRunLog.sequence))
            .filter(PipelineRunLog.run_id == run_id)
            .scalar()
            or 0
        )
        entry = PipelineRunLog(
            id=str(uuid.uuid4()),
            run_id=run_id,
            tenant_id=self.tenant_id,
            pipeline_id=pipeline_id,
            level=level.upper(),
            message=message[:1990],  # guard against DB column limit
            timestamp=datetime.utcnow().isoformat() + "Z",
            sequence=max_seq + 1,
            extra=extra,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    # ── Read ──────────────────────────────────────────────────────────────────

    def get_logs(self, run_id: str) -> List[PipelineRunLog]:
        """Return all log entries for a run in sequence order."""
        return (
            self.db.query(PipelineRunLog)
            .filter(
                PipelineRunLog.tenant_id == self.tenant_id,
                PipelineRunLog.run_id == run_id,
            )
            .order_by(PipelineRunLog.sequence.asc())
            .all()
        )

    def get_logs_after_sequence(
        self, run_id: str, after_sequence: int
    ) -> List[PipelineRunLog]:
        """Return all log entries whose sequence number is greater than `after_sequence`."""
        return (
            self.db.query(PipelineRunLog)
            .filter(
                PipelineRunLog.tenant_id == self.tenant_id,
                PipelineRunLog.run_id == run_id,
                PipelineRunLog.sequence > after_sequence,
            )
            .order_by(PipelineRunLog.sequence.asc())
            .all()
        )
