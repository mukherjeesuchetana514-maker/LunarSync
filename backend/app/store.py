from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Any

_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_job(
    *,
    pair_label: str,
    matcher_type: str,
    transform_model: str,
    source_sensor: str,
    reference_sensor: str,
    upload_name: str,
) -> dict[str, Any]:
    job_id = f"job-{uuid.uuid4().hex[:10]}"
    job = {
        "id": job_id,
        "pairLabel": pair_label,
        "meta": {
            "sourceSensor": source_sensor,
            "referenceSensor": reference_sensor,
            "referenceFrameId": "matching archive…",
            "sourceGsdM": 0.25 if source_sensor == "OHRC" else (5 if source_sensor == "TMC-2" else 80),
            "referenceGsdM": 0.6 if reference_sensor == "LRO NAC" else 10,
            "sourceSunElevationDeg": 30,
            "referenceSunElevationDeg": 36,
            "sunDeltaDeg": 6,
        },
        "status": "PENDING",
        "currentStage": "queued",
        "matcherType": matcher_type,
        "transformModel": transform_model,
        "createdAt": _now(),
        "uploadName": upload_name,
    }
    record = {
        "job": job,
        "matches": [],
        "transform": {"modelType": transform_model, "parameters": [1, 0, 0, 0, 1, 0, 0, 0, 1]},
        "report": None,
        "sourceImagePath": None,
        "referenceImagePath": None,
        "metrics": None,
    }
    with _lock:
        _jobs[job_id] = record
    return job


def get_record(job_id: str) -> dict[str, Any] | None:
    with _lock:
        rec = _jobs.get(job_id)
        return rec


def list_jobs() -> list[dict[str, Any]]:
    with _lock:
        jobs = [r["job"] for r in _jobs.values()]
    jobs.sort(key=lambda j: j.get("createdAt") or "", reverse=True)
    return jobs


def patch_job(job_id: str, **fields: Any) -> None:
    with _lock:
        rec = _jobs.get(job_id)
        if not rec:
            return
        rec["job"].update(fields)


def set_stage(job_id: str, stage: str) -> None:
    patch_job(job_id, currentStage=stage, status="RUNNING")


def complete_job(job_id: str, payload: dict[str, Any]) -> None:
    with _lock:
        rec = _jobs.get(job_id)
        if not rec:
            return
        rec.update(payload)
        rec["job"]["status"] = "SUCCEEDED"
        rec["job"]["currentStage"] = "evaluation"
        rec["job"]["completedAt"] = _now()


def fail_job(job_id: str, message: str, stage: str = "matching") -> None:
    patch_job(
        job_id,
        status="FAILED",
        currentStage=stage,
        errorMessage=message,
        completedAt=_now(),
    )


def mark_running(job_id: str) -> None:
    patch_job(job_id, status="RUNNING", currentStage="ingestion", startedAt=_now())
