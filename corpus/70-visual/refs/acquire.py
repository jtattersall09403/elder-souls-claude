#!/usr/bin/env python3
"""Download the text-described reference corpus without transforming media bytes.

The source of truth is `_provenance.json`. Each record contains a destination path,
direct download URL, expected byte length, and SHA-256 recorded from the original
acquisition. Downloads are streamed to a temporary file, verified, and atomically
renamed. No image decoder or encoder is involved.

Usage:
    python3 acquire.py                 # download missing files, then build manifests
    python3 acquire.py --download-only # download and verify, do not run metrics
    python3 acquire.py --check         # verify existing files; do not use the network
    python3 acquire.py --force         # redownload even when destination already verifies
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
PROVENANCE = HERE / "_provenance.json"
CHUNK = 1024 * 1024
USER_AGENT = "elder-souls-reference-acquirer/1.0"


def digest(path: Path) -> tuple[int, str]:
    sha = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        while block := stream.read(CHUNK):
            size += len(block)
            sha.update(block)
    return size, sha.hexdigest()


def expected(record: dict) -> tuple[int, str]:
    return int(record["expected_bytes"]), str(record["expected_sha256"]).lower()


def verify(path: Path, record: dict) -> tuple[bool, str]:
    if not path.is_file():
        return False, "missing"
    got_size, got_sha = digest(path)
    want_size, want_sha = expected(record)
    if got_size != want_size:
        return False, f"size {got_size}, expected {want_size}"
    if got_sha != want_sha:
        return False, f"sha256 {got_sha}, expected {want_sha}"
    return True, f"{got_size} bytes, sha256 {got_sha}"


def download(path: Path, record: dict) -> None:
    url = record["source_url"]
    if not url.startswith("https://"):
        raise ValueError(f"refusing non-HTTPS URL: {url}")
    path.parent.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/*,*/*;q=0.1"})
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".part", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        sha = hashlib.sha256()
        size = 0
        with os.fdopen(fd, "wb") as target, urlopen(request, timeout=60) as response:
            for block in iter(lambda: response.read(CHUNK), b""):
                target.write(block)
                size += len(block)
                sha.update(block)
            target.flush()
            os.fsync(target.fileno())
        want_size, want_sha = expected(record)
        if size != want_size or sha.hexdigest() != want_sha:
            raise ValueError(
                f"download verification failed for {path}: got {size} bytes/{sha.hexdigest()}, "
                f"expected {want_size} bytes/{want_sha}"
            )
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def load_records() -> dict[str, dict]:
    records = json.loads(PROVENANCE.read_text())
    if not isinstance(records, dict) or not records:
        raise ValueError("_provenance.json must contain at least one path-keyed record")
    for relative, record in records.items():
        candidate = (HERE / relative).resolve()
        if HERE not in candidate.parents:
            raise ValueError(f"path escapes refs root: {relative}")
        if not all(k in record for k in ("source_url", "expected_bytes", "expected_sha256")):
            # Local record: a file acquired in-container and already on disk. Documented here so
            # nothing is undocumented, but not fetchable, so acquire.py skips it rather than
            # erroring. Dropping these is how 159 records were silently lost once already.
            record.setdefault("_local", True)
            continue
    return {k: v for k, v in records.items() if not v.get("_local")}, records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify local files without downloading")
    parser.add_argument("--force", action="store_true", help="redownload files that already verify")
    parser.add_argument("--download-only", action="store_true", help="skip make-manifest.py")
    args = parser.parse_args()
    records, all_records = load_records()
    failures = 0
    for index, (relative, record) in enumerate(sorted(records.items()), 1):
        path = HERE / relative
        valid, detail = verify(path, record)
        if args.check:
            marker = "OK" if valid else "FAIL"
            print(f"[{index:02d}/{len(records)}] {marker} {relative}: {detail}")
            failures += not valid
            continue
        if valid and not args.force:
            print(f"[{index:02d}/{len(records)}] cached {relative}: {detail}")
            continue
        try:
            print(f"[{index:02d}/{len(records)}] downloading {relative}")
            download(path, record)
            valid, detail = verify(path, record)
            if not valid:
                raise ValueError(detail)
            print(f"               verified {detail}")
        except (HTTPError, URLError, OSError, ValueError) as error:
            failures += 1
            print(f"ERROR {relative}: {error}", file=sys.stderr)
    if failures:
        print(f"failed: {failures} of {len(records)} reference files", file=sys.stderr)
        return 1
    if not args.check and not args.download_only:
        subprocess.run([sys.executable, str(HERE / "make-manifest.py")], cwd=HERE, check=True)
    print(f"ok: {len(records)} reference files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
