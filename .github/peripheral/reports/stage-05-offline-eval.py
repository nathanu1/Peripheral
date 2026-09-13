#!/usr/bin/env python3
"""Run Peripheral's Stage 5 detector gate on licensed prerecorded images.

This is a reproducible native reference-runtime check, not a browser, camera, or
wearable-hardware test. Every emitted observation has evaluation provenance and
no live perception tier.

Runtime dependency:
    python -m pip install mediapipe==0.10.21
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import statistics
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


MODEL_NAME = "efficientdet-lite0-int8-v1"
MODEL_SHA256 = "0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb"
RUNTIME = "mediapipe@0.10.21"
SCORE_THRESHOLD = 0.25
MAX_RESULTS = 20


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Peripheral-Stage5-Evaluation/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for {url}")
        with tempfile.NamedTemporaryFile(
            dir=destination.parent, prefix=f".{destination.name}.", delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                temporary.write(chunk)
    os.replace(temporary_path, destination)


def percentile_nearest_rank(values: list[float], proportion: float) -> float:
    ordered = sorted(values)
    if not ordered:
        raise ValueError("Cannot calculate a percentile without samples")
    index = max(0, math.ceil(proportion * len(ordered)) - 1)
    return ordered[index]


def normalized_box(box: Any, width: int, height: int) -> dict[str, float] | None:
    numbers = [box.origin_x, box.origin_y, box.width, box.height]
    if not all(math.isfinite(value) for value in numbers):
        return None
    if box.width <= 0 or box.height <= 0:
        return None
    left = max(0.0, float(box.origin_x))
    top = max(0.0, float(box.origin_y))
    right = min(float(width), float(box.origin_x + box.width))
    bottom = min(float(height), float(box.origin_y + box.height))
    if right <= left or bottom <= top:
        return None
    return {
        "xmin": left / width,
        "ymin": top / height,
        "xmax": right / width,
        "ymax": bottom / height,
    }


def intersection_over_union(a: dict[str, float], b: dict[str, float]) -> float:
    left = max(a["xmin"], b["xmin"])
    top = max(a["ymin"], b["ymin"])
    right = min(a["xmax"], b["xmax"])
    bottom = min(a["ymax"], b["ymax"])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    area_a = max(0.0, a["xmax"] - a["xmin"]) * max(0.0, a["ymax"] - a["ymin"])
    area_b = max(0.0, b["xmax"] - b["xmin"]) * max(0.0, b["ymax"] - b["ymin"])
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def canonical_label(value: str) -> str:
    return " ".join(value.strip().casefold().split())


def evaluate(args: argparse.Namespace) -> dict[str, Any]:
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    fixtures = manifest.get("fixtures")
    if manifest.get("schema") != "peripheral.stage5.fixtures.v1" or not isinstance(fixtures, list):
        raise ValueError("Unexpected fixture manifest schema")
    if sha256_file(args.model) != MODEL_SHA256:
        raise ValueError("Detector model SHA-256 does not match the pinned artifact")
    if getattr(mp, "__version__", "") != "0.10.21":
        raise RuntimeError(
            f"Expected mediapipe 0.10.21, found {getattr(mp, '__version__', 'unknown')}"
        )

    fixture_paths: list[tuple[dict[str, Any], Path, str]] = []
    for fixture in fixtures:
        fixture_id = fixture.get("id", "")
        if not isinstance(fixture_id, str) or not fixture_id:
            raise ValueError("Every fixture needs an identifier")
        image_path = args.cache / f"{fixture_id}.jpg"
        if not image_path.exists():
            download(fixture["sourceUrl"], image_path)
        image_hash = sha256_file(image_path)
        expected_hash = fixture.get("sha256")
        if expected_hash and image_hash != expected_hash:
            raise ValueError(f"Fixture hash mismatch: {fixture_id}")
        fixture_paths.append((fixture, image_path, image_hash))

    options = vision.ObjectDetectorOptions(
        base_options=python.BaseOptions(model_asset_path=str(args.model)),
        running_mode=vision.RunningMode.IMAGE,
        score_threshold=SCORE_THRESHOLD,
        max_results=MAX_RESULTS,
    )
    latencies: list[float] = []
    per_fixture: list[dict[str, Any]] = []
    invalid_boxes = 0
    expected_hits = 0
    matched_at_iou50 = 0

    with vision.ObjectDetector.create_from_options(options) as detector:
        # Three disclosed warm-ups keep model initialization out of per-image latency.
        warmup_image = mp.Image.create_from_file(str(fixture_paths[0][1]))
        for _ in range(3):
            detector.detect(warmup_image)

        for fixture, image_path, image_hash in fixture_paths:
            image = mp.Image.create_from_file(str(image_path))
            started = time.perf_counter_ns()
            result = detector.detect(image)
            elapsed_ms = (time.perf_counter_ns() - started) / 1_000_000
            latencies.append(elapsed_ms)

            expected_label = canonical_label(fixture["className"])
            annotation = fixture["expectedBox"]
            expected_box = {
                "xmin": float(annotation["xMin"]),
                "ymin": float(annotation["yMin"]),
                "xmax": float(annotation["xMax"]),
                "ymax": float(annotation["yMax"]),
            }
            detections: list[dict[str, Any]] = []
            expected_label_boxes: list[dict[str, float]] = []
            fixture_invalid_boxes = 0
            for detection in result.detections:
                box = normalized_box(detection.bounding_box, image.width, image.height)
                if box is None:
                    invalid_boxes += 1
                    fixture_invalid_boxes += 1
                    continue
                categories = [
                    category
                    for category in detection.categories
                    if category.category_name and math.isfinite(category.score)
                ]
                if not categories:
                    continue
                category = max(categories, key=lambda item: item.score)
                label = canonical_label(category.category_name)
                record = {
                    "label": label,
                    "score": round(float(category.score), 8),
                    "box": {key: round(value, 8) for key, value in box.items()},
                    "tier": None,
                    "source": "evaluation",
                }
                detections.append(record)
                if label == expected_label:
                    expected_label_boxes.append(box)

            hit = bool(expected_label_boxes)
            max_iou = max(
                (intersection_over_union(box, expected_box) for box in expected_label_boxes),
                default=0.0,
            )
            if hit:
                expected_hits += 1
            if max_iou >= 0.5:
                matched_at_iou50 += 1
            per_fixture.append(
                {
                    "id": fixture["id"],
                    "expectedClass": fixture["className"],
                    "expectedLabelDetected": hit,
                    "maxExpectedLabelIou": round(max_iou, 8),
                    "inferenceMs": round(elapsed_ms, 4),
                    "imageSha256": image_hash,
                    "invalidDetectionCount": fixture_invalid_boxes,
                    "detections": detections,
                }
            )

    augmented_fixtures = [{**fixture, "sha256": image_hash} for fixture, _, image_hash in fixture_paths]
    results = {
        "imagesProcessed": len(fixtures),
        "imagesWithExpectedDetection": expected_hits,
        "expectedBoxes": len(fixtures),
        "matchedAtIou50": matched_at_iou50,
        "invalidBoxes": invalid_boxes,
        "liveTier1Count": 0,
        "medianInferenceMs": round(statistics.median(latencies), 4),
        "p95InferenceMs": round(percentile_nearest_rank(latencies, 0.95), 4),
    }
    return {
        "schema": "peripheral.stage5.offline-run.v1",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "provenance": "evaluation-image",
        "claimBoundary": (
            "Licensed prerecorded photographs in a native CPU reference runtime; "
            "not live camera input, browser throughput, or wearable hardware."
        ),
        "model": {
            "executed": True,
            "name": MODEL_NAME,
            "sha256": MODEL_SHA256,
            "runtime": RUNTIME,
            "runningMode": "IMAGE",
            "delegate": "CPU",
            "scoreThreshold": SCORE_THRESHOLD,
            "maxResults": MAX_RESULTS,
            "warmupRunsExcluded": 3,
        },
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "fixtures": augmented_fixtures,
        "results": results,
        "perFixture": per_fixture,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    evidence = evaluate(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, args.output)
    print(json.dumps({"results": evidence["results"], "environment": evidence["environment"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
