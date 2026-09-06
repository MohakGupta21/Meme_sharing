"""Diagnose a Cloudinary storage configuration end to end.

    cd backend
    STORAGE_BACKEND=cloudinary CLOUDINARY_URL=cloudinary://key:secret@cloud \
        .venv/bin/python scripts/cloudinary_doctor.py

Reads the same settings the app does (backend/.env + real env vars), then:
  1. builds the storage backend,
  2. pings the Cloudinary Admin API (credentials check),
  3. uploads and deletes a 1x1 PNG (upload-permission check),
printing the *real* Cloudinary error message on any failure.
"""
from __future__ import annotations

import base64
import sys
import uuid

# 1x1 transparent PNG
_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg=="
)


def main() -> int:
    from app.core.config import get_settings
    from app.storage.factory import get_storage

    s = get_settings()
    print(f"STORAGE_BACKEND = {s.storage_backend!r}")
    if s.storage_backend != "cloudinary":
        print("  -> not set to 'cloudinary'; nothing to check.")
        return 1
    print(f"CLOUDINARY_URL set: {bool(s.cloudinary_url)}")
    print(
        "discrete vars set: "
        f"cloud_name={bool(s.cloudinary_cloud_name)} "
        f"api_key={bool(s.cloudinary_api_key)} "
        f"api_secret={bool(s.cloudinary_api_secret)}"
    )

    try:
        storage = get_storage()
    except Exception as exc:  # noqa: BLE001
        print(f"\nFAIL building backend: {type(exc).__name__}: {exc}")
        return 1
    print("\nbackend built OK")

    import cloudinary

    cfg = cloudinary.config()
    print(f"resolved cloud_name = {cfg.cloud_name!r}")

    try:
        storage.check()
        print("ping OK (credentials + cloud_name are valid)")
        print("  NOTE: ping is a *read* action — a permission-restricted key can")
        print("  pass this and still fail the upload check below.")
    except Exception as exc:  # noqa: BLE001
        print(f"ping FAILED: {type(exc).__name__}: {exc}")
        print("  -> wrong api_key/api_secret/cloud_name, or the account is disabled.")
        return 1

    key = f"diagnostics/{uuid.uuid4().hex}.png"
    try:
        stored = storage.put(key, _PNG, "image/png")
        print(f"upload OK -> {stored.url}")
    except Exception as exc:  # noqa: BLE001
        print(f"upload FAILED: {type(exc).__name__}: {exc}")
        print(
            "  -> 'missing permissions (actions=[\"create\"])': the API key is "
            "permission-restricted and cannot upload. In the Cloudinary console\n"
            "     (Settings -> API Keys) use the primary key, or grant this key the "
            "asset 'create' permission / an Admin role.\n"
            "  -> 'Customer is marked as untrusted': verify your Cloudinary email / "
            "wait for account review, or contact Cloudinary support.\n"
            "  -> other messages usually mean an account media-type or upload-preset "
            "restriction (Settings -> Upload)."
        )
        return 1

    try:
        storage.delete(key)
        print("delete OK")
    except Exception as exc:  # noqa: BLE001
        print(f"delete FAILED (non-fatal): {type(exc).__name__}: {exc}")

    print("\nAll checks passed — Cloudinary storage is working.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
