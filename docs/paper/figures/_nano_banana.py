"""Thin helper for NanoBanana (Gemini 3 Pro Image) generation.

Submits a prompt, polls until FINISHED, downloads the image. Handles both
URL responses and inline-base64 responses transparently.

Env requirements (proxy bypass for the df-ability host):
  NO_PROXY=38.98.112.79,127.0.0.1,localhost  no_proxy=...  HTTP(S)_PROXY=""

Usage:
  from _nano_banana import generate
  generate(prompt="...", output_path="figures/fig-X.png")
"""
from __future__ import annotations

import base64
import sys
import time
from pathlib import Path

import requests

_API_BASE = "http://38.98.112.79/df-ability-server/task/v1"
_SUBMIT_URL = f"{_API_BASE}/submit"
_STATUS_URL = f"{_API_BASE}/status/{{task_id}}"
_HEADERS = {
    "x-df-ability": "df-ability-google-gemini",
    "x-df-access-key": "yunying",
    "x-df-secret-key": "ths123456",
    "Content-Type": "application/json",
}


def generate(
    prompt: str,
    output_path: str | Path,
    model: str = "gemini-3-pro-image-preview",
    poll_interval: int = 8,
    max_wait: int = 300,
) -> dict:
    """Submit -> poll -> download. Returns dict with output_path, size_kb, duration_s."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    start = time.time()
    payload = {"model": model, "contents": [{"parts": [{"text": prompt}]}]}

    print("Submitting...")
    r = requests.post(_SUBMIT_URL, json=payload, headers=_HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    if data.get("status_code") != 0:
        raise RuntimeError(f"Submit failed: {data}")
    task_id = data["data"]["result"]
    print(f"task_id: {task_id}")

    status_url = _STATUS_URL.format(task_id=task_id)
    get_headers = {k: v for k, v in _HEADERS.items() if k != "Content-Type"}

    elapsed = 0
    result_field = None
    while elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval
        r = requests.get(status_url, headers=get_headers, timeout=30)
        r.raise_for_status()
        d = r.json().get("data", {})
        status = d.get("status", "")
        print(f"  [{elapsed:>3}s] status={status}")
        if status == "FINISHED":
            result_field = d.get("result")
            break
        if status == "FAILED":
            raise RuntimeError(f"Generation failed: {d.get('errorMsg', 'unknown')}")
    else:
        raise TimeoutError(f"Timed out after {max_wait}s")

    if not result_field:
        raise RuntimeError("No result field in FINISHED response")

    # Result may be either a URL or inline base64 (sometimes with data: prefix)
    if isinstance(result_field, str) and result_field.startswith("http"):
        print(f"got URL: {result_field[:60]}...")
        raw = requests.get(result_field, timeout=60).content
    else:
        s = result_field
        if isinstance(s, str) and s.startswith("data:"):
            s = s.split(",", 1)[1]
        print(f"got inline base64 ({len(s)} chars), decoding")
        raw = base64.b64decode(s)

    output_path.write_bytes(raw)
    duration_s = round(time.time() - start, 1)
    size_kb = len(raw) // 1024
    print(f"\nOK\noutput: {output_path}")
    print(f"size: {size_kb} KB · duration: {duration_s}s · cost ≈ $0.06")
    return {"output_path": str(output_path), "size_kb": size_kb, "duration_s": duration_s}


if __name__ == "__main__":
    print(__doc__)
