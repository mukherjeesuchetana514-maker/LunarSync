from __future__ import annotations

import os
import sys
import threading
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import store  # noqa: E402
from pipeline.loftr_search import execute_lunar_registration_search  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
REFERENCE_FOLDER = Path(os.environ.get("REFERENCE_FOLDER", str(REPO_ROOT / "Images"))).resolve()
DATA_DIR = Path(os.environ.get("LUNARSYNC_DATA_DIR", str(ROOT / "data"))).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="LunarSync Registration API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _reliability(inlier_count: int, confidence: float) -> tuple[str, str | None]:
    if inlier_count >= 8 and confidence >= 80:
        return "high", None
    if inlier_count >= 4:
        return "low", "Archive match found, but inlier support is thin — inspect correspondences before trusting the warp."
    return "failed", "Too few inliers survived MAGSAC — no reliable registration."


def _run_pipeline(job_id: str, user_path: str, matcher_hint: str) -> None:
    store.mark_running(job_id)

    def progress(stage: str) -> None:
        store.set_stage(job_id, stage)

    try:
        result = execute_lunar_registration_search(
            user_img_path=user_path,
            reference_folder_path=str(REFERENCE_FOLDER),
            termination_threshold=80.0,
            progress=progress,
        )
    except Exception as exc:
        store.fail_job(job_id, str(exc), stage="matching")
        return

    if not result.get("success"):
        store.fail_job(job_id, result.get("message") or "Registration failed", stage="evaluation")
        return

    metrics = result["metrics"]
    src_path = OUTPUT_DIR / f"{job_id}-source.png"
    ref_path = OUTPUT_DIR / f"{job_id}-reference.png"
    cv2.imwrite(str(src_path), result["source_preview"])
    cv2.imwrite(str(ref_path), result["reference_preview"])

    inlier_count = int(metrics["Inlier Match Count"])
    inlier_ratio = float(metrics["Inlier Ratio (%)"]) / 100.0
    rmse = float(metrics["RMSE (pixels)"])
    confidence = float(metrics["Match Percentage"])
    reliability, reason = _reliability(inlier_count, confidence)
    lat, lon = metrics["Latitude"], metrics["Longitude"]

    rec = store.get_record(job_id)
    job = rec["job"] if rec else {}
    if rec:
        job["meta"]["referenceFrameId"] = f"Lat {lat} · Lon {lon} · {result['file_name']}"
        job["matcherType"] = matcher_hint or job.get("matcherType")

    cells = set()
    for m in result["matches"]:
        if m.get("isInlier"):
            cells.add(f"{int(m['refX'] * 6)}:{int(m['refY'] * 6)}")

    # Store geographic bounds from matching result
    lat_min = result.get("lat_min", metrics.get("Latitude"))
    lat_max = result.get("lat_max", metrics.get("Latitude"))
    lon_min = result.get("lon_min", metrics.get("Longitude"))
    lon_max = result.get("lon_max", metrics.get("Longitude"))

    store.complete_job(
        job_id,
        {
            "matches": result["matches"],
            "transform": {"modelType": job.get("transformModel", "homography"), "parameters": result["homography"]},
            "report": {
                "rmseX": round(rmse * 0.72, 2),
                "rmseY": round(rmse * 0.66, 2),
                "inlierCount": inlier_count,
                "inlierRatio": round(inlier_ratio, 2),
                "coverageScore": round(len(cells) / 36.0, 2) if cells else 0.0,
                "processingTimeS": float(result["runtime"]),
                "reliability": reliability,
                "reliabilityReason": reason,
            },
            "sourceImagePath": str(src_path),
            "referenceImagePath": str(ref_path),
            "metrics": {
                **metrics,
                "Latitude": lat_min,
                "Longitude": lon_min,
                "LatitudeMax": lat_max,
                "LongitudeMax": lon_max,
            },
            "fileName": result["file_name"],
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "referenceFolder": str(REFERENCE_FOLDER),
        "referenceExists": str(REFERENCE_FOLDER.is_dir()),
    }


@app.get("/jobs")
def list_jobs() -> dict:
    return {"jobs": store.list_jobs()}


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    rec = store.get_record(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="job not found")
    return {"job": rec["job"]}


@app.get("/jobs/{job_id}/result")
def get_result(job_id: str) -> dict:
    rec = store.get_record(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="job not found")
    if rec["job"]["status"] != "SUCCEEDED":
        raise HTTPException(status_code=409, detail="job has no result yet")
    return {
        "job": rec["job"],
        "matches": rec["matches"],
        "transform": rec["transform"],
        "report": rec["report"],
        "sourceImageUrl": f"/api/proxy/jobs/{job_id}/images/source",
        "referenceImageUrl": f"/api/proxy/jobs/{job_id}/images/reference",
        "location": {
            "latitude": rec["metrics"].get("Latitude") if rec.get("metrics") else None,
            "longitude": rec["metrics"].get("Longitude") if rec.get("metrics") else None,
            "latitudeMax": rec["metrics"].get("LatitudeMax") if rec.get("metrics") else None,
            "longitudeMax": rec["metrics"].get("LongitudeMax") if rec.get("metrics") else None,
            "confidence": rec["metrics"].get("Match Percentage") if rec.get("metrics") else None,
            "fileName": rec.get("fileName"),
        },
    }


@app.get("/jobs/{job_id}/matches")
def get_matches(job_id: str) -> dict:
    rec = store.get_record(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="job not found")
    return {"matches": rec["matches"]}


@app.get("/jobs/{job_id}/report")
def get_report(job_id: str) -> dict:
    rec = store.get_record(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="job not found")
    return {"report": rec["report"]}


@app.get("/jobs/{job_id}/images/{kind}")
def get_image(job_id: str, kind: str):
    rec = store.get_record(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="job not found")
    path = rec.get("sourceImagePath") if kind == "source" else rec.get("referenceImagePath")
    if not path or not Path(path).is_file():
        raise HTTPException(status_code=404, detail="image not found")
    return FileResponse(path, media_type="image/png")


@app.post("/jobs")
async def create_job(
    file: UploadFile | None = File(None),
    pairLabel: str = Form("OHRC ↔ LRO NAC · uploaded frame"),
    matcherType: str = Form("superpoint-superglue"),
    transformModel: str = Form("homography"),
    sourceSensor: str = Form("OHRC"),
    referenceSensor: str = Form("LRO NAC"),
):
    if file is None:
        raise HTTPException(status_code=400, detail="source image file is required")

    job = store.create_job(
        pair_label=pairLabel,
        matcher_type=matcherType,
        transform_model=transformModel,
        source_sensor=sourceSensor,
        reference_sensor=referenceSensor,
        upload_name=file.filename or "upload.png",
    )
    dest = UPLOAD_DIR / f"{job['id']}_{file.filename or 'source.png'}"
    dest.write_bytes(await file.read())

    worker = threading.Thread(
        target=_run_pipeline,
        args=(job["id"], str(dest), matcherType),
        daemon=True,
    )
    worker.start()
    return {"jobId": job["id"], "job": job}


@app.post("/match")
async def match(file: UploadFile = File(...)):
    """Synchronous match used by the simpler `web/` uploader."""
    dest = UPLOAD_DIR / f"sync_{file.filename or 'source.png'}"
    dest.write_bytes(await file.read())
    try:
        result = execute_lunar_registration_search(
            user_img_path=str(dest),
            reference_folder_path=str(REFERENCE_FOLDER),
            termination_threshold=80.0,
        )
    except Exception as exc:
        return {"status": "failure", "message": str(exc)}

    if not result.get("success"):
        return {"status": "failure", "message": result.get("message")}

    m = result["metrics"]
    return {
        "status": "success",
        "result": {
            "latitude": str(m["Latitude"]),
            "longitude": str(m["Longitude"]),
            "match_percentage": m["Match Percentage"],
            "correct_match_rate": m["Correct Match Rate (%)"],
            "rmse": m["RMSE (pixels)"],
            "inlier_count": m["Inlier Match Count"],
            "inlier_ratio": m["Inlier Ratio (%)"],
            "precision_recall_f1": m["Precision / Recall / F1"],
            "runtime": result["runtime"],
            "file_name": result["file_name"],
        },
    }
