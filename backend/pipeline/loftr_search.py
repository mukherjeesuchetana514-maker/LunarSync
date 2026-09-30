"""Chandrayaan-2 LoFTR registration search, adapted from the project notebook.

USER_IMAGE is the uploaded source frame. DATABASE_FOLDER is the on-disk
reference archive (repo `Images/` by default).
"""

from __future__ import annotations

import os
import re
import threading
import time
from typing import Any, Callable

import cv2
import numpy as np
import torch
import kornia.feature as KF

ProgressFn = Callable[[str], None]

_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_matcher_lock = threading.Lock()
_loftr_matcher: KF.LoFTR | None = None


def _get_matcher() -> KF.LoFTR:
    global _loftr_matcher
    with _matcher_lock:
        if _loftr_matcher is None:
            matcher = KF.LoFTR(pretrained="outdoor").to(_device)
            matcher.eval()
            _loftr_matcher = matcher
        return _loftr_matcher


def run_loop_27_preprocessing(src_img: np.ndarray) -> np.ndarray:
    clipped = np.clip(src_img, 20, 235)
    norm = cv2.normalize(clipped, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_32F)

    gx = cv2.Sobel(norm, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(norm, cv2.CV_32F, 0, 1, ksize=3)
    phase_rad = cv2.phase(gx, gy, angleInDegrees=False)
    phase_invariant_map = cv2.normalize(np.cos(phase_rad), None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)

    norm_u8 = cv2.normalize(clipped, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    blur = cv2.GaussianBlur(norm_u8, (9, 9), 2.0)
    sharp = cv2.addWeighted(norm_u8, 1.5, blur, -0.5, 0)

    fused_space = cv2.addWeighted(sharp, 0.8, phase_invariant_map, 0.2, 0)
    clahe_engine = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe_engine.apply(fused_space)


def extract_coordinates_from_filename(filename: str) -> tuple[str, str]:
    base_name = os.path.splitext(filename)[0]
    normalized_name = re.sub(r"minus", "-", base_name, flags=re.IGNORECASE)

    lat_match = re.search(r"lat(?:itude)?(?:[-_]\s*|(?=\d|-))(-?\d+)", normalized_name, re.IGNORECASE)
    lon_match = re.search(r"lon(?:g|gitude)?(?:[-_]\s*|(?=\d|-))(-?\d+)", normalized_name, re.IGNORECASE)

    lat = lat_match.group(1) if lat_match else "Unknown"
    lon = lon_match.group(1) if lon_match else "Unknown"
    return lat, lon


def _to_loftr_tensor(gray_u8: np.ndarray) -> torch.Tensor:
    tensor = torch.from_numpy(np.ascontiguousarray(gray_u8)).float() / 255.0
    return tensor.unsqueeze(0).unsqueeze(0).to(_device)


def _identity_h() -> list[float]:
    return [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]


def execute_lunar_registration_search(
    user_img_path: str,
    reference_folder_path: str,
    termination_threshold: float = 80.0,
    progress: ProgressFn | None = None,
) -> dict[str, Any]:
    def stage(name: str) -> None:
        if progress:
            progress(name)

    start_total_time = time.time()
    stage("ingestion")

    user_raw = cv2.imread(user_img_path, cv2.IMREAD_GRAYSCALE)
    if user_raw is None:
        raise FileNotFoundError(f"Failed to read user input image path: {user_img_path}")

    if user_raw.shape[0] > user_raw.shape[1]:
        user_raw = cv2.rotate(user_raw, cv2.ROTATE_90_CLOCKWISE)

    stage("preprocessing")
    user_proc = run_loop_27_preprocessing(user_raw)
    user_h, user_w = user_proc.shape

    stage("feature_extraction")
    loftr_matcher = _get_matcher()

    valid_extensions = (".png", ".jpg", ".jpeg", ".tif", ".tiff")
    ref_files = [
        f
        for f in os.listdir(reference_folder_path)
        if f.lower().endswith(valid_extensions)
    ]
    if not ref_files:
        raise FileNotFoundError(f"No reference images found in {reference_folder_path}")

    best_match_record: dict[str, Any] | None = None
    winning_ref_proc: np.ndarray | None = None
    winning_file_name: str | None = None
    winning_H: np.ndarray | None = None
    winning_matches: list[dict[str, Any]] = []

    stage("matching")
    for file_name in ref_files:
        loop_start = time.time()
        ref_raw = cv2.imread(os.path.join(reference_folder_path, file_name), cv2.IMREAD_GRAYSCALE)
        if ref_raw is None:
            continue

        if ref_raw.shape[0] > ref_raw.shape[1]:
            ref_raw = cv2.rotate(ref_raw, cv2.ROTATE_90_CLOCKWISE)

        ref_h_orig, ref_w_orig = ref_raw.shape
        scale_factor = user_h / ref_h_orig
        new_ref_w = int(ref_w_orig * scale_factor)
        if new_ref_w <= 0:
            continue

        ref_rescaled = cv2.resize(ref_raw, (new_ref_w, user_h), interpolation=cv2.INTER_LINEAR)
        ref_proc = run_loop_27_preprocessing(ref_rescaled)
        ref_h, ref_w = ref_proc.shape

        downscale_w, downscale_h = 800, 200
        user_down = cv2.resize(user_proc, (downscale_w, downscale_h), interpolation=cv2.INTER_AREA)
        ref_down = cv2.resize(ref_proc, (downscale_w, downscale_h), interpolation=cv2.INTER_AREA)

        input_dict = {"image0": _to_loftr_tensor(user_down), "image1": _to_loftr_tensor(ref_down)}

        mkpts0 = np.empty((0, 2), dtype=np.float32)
        mkpts1 = np.empty((0, 2), dtype=np.float32)
        with torch.inference_mode():
            try:
                correspondences = loftr_matcher(input_dict)
                mkpts0 = correspondences["keypoints0"].cpu().numpy()
                mkpts1 = correspondences["keypoints1"].cpu().numpy()
            except Exception:
                mkpts0 = np.empty((0, 2), dtype=np.float32)
                mkpts1 = np.empty((0, 2), dtype=np.float32)

        inlier_count = 0
        inlier_ratio = 0.0
        rmse = 999.0
        correct_match_rate = 0.0
        precision, recall, f1 = 0.0, 0.0, 0.0
        H = None
        inlier_mask = np.zeros((len(mkpts0),), dtype=bool)
        overlay_matches: list[dict[str, Any]] = []

        if len(mkpts0) >= 6:
            mkpts0 = mkpts0.copy()
            mkpts1 = mkpts1.copy()
            mkpts0[:, 0] *= user_w / downscale_w
            mkpts0[:, 1] *= user_h / downscale_h
            mkpts1[:, 0] *= ref_w / downscale_w
            mkpts1[:, 1] *= ref_h / downscale_h

            H, inliers = cv2.findHomography(mkpts0, mkpts1, cv2.USAC_MAGSAC, 15.0, 0.99, 2000)
            if inliers is not None:
                inlier_mask = inliers.ravel() == 1
                inlier_count = int(np.sum(inlier_mask))
                inlier_ratio = (inlier_count / len(mkpts0)) * 100 if len(mkpts0) else 0.0

                if inlier_count > 0:
                    pts0_in = mkpts0[inlier_mask].reshape(-1, 1, 2)
                    pts1_in = mkpts1[inlier_mask].reshape(-1, 1, 2)
                    projected = cv2.perspectiveTransform(pts0_in, H)
                    rmse = float(np.sqrt(np.mean((pts1_in - projected) ** 2)))

                correct_match_rate = inlier_ratio
                precision = inlier_count / len(mkpts0)
                recall = inlier_count / len(mkpts0)
                f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

                for i, (p0, p1, inn) in enumerate(zip(mkpts0, mkpts1, inlier_mask)):
                    overlay_matches.append(
                        {
                            "id": f"m-{i}",
                            "srcX": float(np.clip(p0[0] / max(user_w, 1), 0, 1)),
                            "srcY": float(np.clip(p0[1] / max(user_h, 1), 0, 1)),
                            "refX": float(np.clip(p1[0] / max(ref_w, 1), 0, 1)),
                            "refY": float(np.clip(p1[1] / max(ref_h, 1), 0, 1)),
                            "confidence": 0.0,
                            "isInlier": bool(inn),
                        }
                    )

        if inlier_count >= 5:
            match_confidence = (inlier_count / (inlier_count + (rmse / 5.0) + 0.1)) * 100
            match_confidence = min(max(match_confidence, inlier_ratio), 100.0)
        else:
            match_confidence = 0.0

        for m in overlay_matches:
            m["confidence"] = round(match_confidence / 100.0, 3)

        runtime = time.time() - loop_start
        lat, lon = extract_coordinates_from_filename(file_name)
        current_record = {
            "Latitude": lat,
            "Longitude": lon,
            "Match Percentage": round(match_confidence, 2),
            "Correct Match Rate (%)": round(correct_match_rate, 2),
            "RMSE (pixels)": round(rmse, 3) if rmse != 999.0 else 0.0,
            "Inlier Match Count": inlier_count,
            "Inlier Ratio (%)": round(inlier_ratio, 2),
            "Precision / Recall / F1": f"{precision:.2f} / {recall:.2f} / {f1:.2f}",
            "Runtime (seconds)": round(runtime, 4),
        }

        if best_match_record is None or current_record["Match Percentage"] > best_match_record["Match Percentage"]:
            best_match_record = current_record
            winning_ref_proc = ref_proc
            winning_file_name = file_name
            winning_H = H
            winning_matches = overlay_matches

        if match_confidence >= termination_threshold:
            break

    total_execution_time = time.time() - start_total_time
    stage("evaluation")

    if not best_match_record or best_match_record["Inlier Match Count"] < 4 or winning_ref_proc is None:
        return {
            "success": False,
            "message": "Deep Transformer weights could not find a globally consistent spatial match vector.",
            "runtime": round(total_execution_time, 4),
        }

    vis_w = min(user_w, winning_ref_proc.shape[1], 1200)
    source_preview = user_proc[:, :vis_w]
    reference_preview = winning_ref_proc[:, :vis_w]

    H_flat = winning_H.flatten().tolist() if winning_H is not None else _identity_h()
    capped = winning_matches[:48]

    return {
        "success": True,
        "metrics": best_match_record,
        "file_name": winning_file_name,
        "runtime": round(total_execution_time, 4),
        "homography": H_flat,
        "matches": capped,
        "source_preview": source_preview,
        "reference_preview": reference_preview,
        "device": _device.type,
    }
