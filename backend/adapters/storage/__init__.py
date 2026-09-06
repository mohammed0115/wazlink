"""Object storage adapters — implement `StoragePort` (B11_STORAGE_PROVIDER_BOUNDARY).

**The vendor is configuration** (`ID-10`). Two implementations ship:

*   `LocalObjectStorageAdapter` — a filesystem-backed store for a single-node
    deployment, and the default when no object-store credential is present.
*   `StubStorageAdapter` — in-memory, deterministic, for tests.

Both satisfy the same port, so a domain cannot tell which is bound (LSP). A
third implementation for an S3-compatible vendor slots in at the composition
root and changes no domain module.

**Path traversal is unreachable rather than filtered.** The port has no method
that accepts a client-supplied path: keys are computed server-side by
`apps.files`, and `_resolve` below additionally refuses any key that escapes
the configured root, so a forged key that somehow reached this layer would
still fail.
"""

from __future__ import annotations

import hashlib
import os
import pathlib

from common.provider_ports import (
    CONFIGURED,
    NOT_CONFIGURED,
    ProviderNotConfigured,
    ProviderStatus,
    StoredObject,
)

PROVIDER_NAME = "storage"
CREDENTIAL_REFS = ("FILE_STORAGE_ROOT",)
DEFAULT_ROOT = "/var/lib/wazlink/files"


def _checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


class LocalObjectStorageAdapter:
    """Filesystem-backed. The deployed default until an object store is named."""

    provider_name = PROVIDER_NAME

    def __init__(self, root: str = ""):
        self._root = (root or os.environ.get("FILE_STORAGE_ROOT") or "").strip()

    def status(self) -> ProviderStatus:
        configured = bool(self._root)
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if configured else NOT_CONFIGURED,
            configuration_valid=configured,
            credential_refs=CREDENTIAL_REFS,
        )

    def _base(self) -> pathlib.Path:
        if not self._root:
            raise ProviderNotConfigured("File storage is not configured.", provider=PROVIDER_NAME)
        return pathlib.Path(self._root).resolve()

    def _resolve(self, storage_key: str) -> pathlib.Path:
        """Resolve a key under the root, refusing anything that escapes it.

        Belt and braces: `apps.files` computes the key and never accepts one
        from a client, but a store that trusts its caller absolutely is a store
        that fails badly the day some other caller appears.
        """
        base = self._base()
        candidate = (base / storage_key.lstrip("/")).resolve()
        if not candidate.is_relative_to(base):
            raise ProviderNotConfigured("Refused a storage key outside the root.", provider=PROVIDER_NAME)
        return candidate

    def put(self, *, storage_key: str, content: bytes, content_type: str) -> StoredObject:
        path = self._resolve(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return StoredObject(
            storage_key=storage_key, size_bytes=len(content), checksum=_checksum(content)
        )

    def get(self, *, storage_key: str) -> bytes:
        path = self._resolve(storage_key)
        if not path.is_file():
            raise FileNotFoundError(storage_key)
        return path.read_bytes()

    def delete(self, *, storage_key: str) -> None:
        path = self._resolve(storage_key)
        if path.is_file():
            path.unlink()

    def exists(self, *, storage_key: str) -> bool:
        try:
            return self._resolve(storage_key).is_file()
        except ProviderNotConfigured:
            return False


class StubStorageAdapter:
    """Deterministic in-memory store satisfying the SAME port (LSP, B14_19)."""

    provider_name = PROVIDER_NAME

    def __init__(self, *, configured: bool = True):
        self._configured = configured
        self.objects: dict[str, bytes] = {}
        self.content_types: dict[str, str] = {}

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if self._configured else NOT_CONFIGURED,
            configuration_valid=self._configured,
            credential_refs=CREDENTIAL_REFS,
        )

    def _require(self) -> None:
        if not self._configured:
            raise ProviderNotConfigured("File storage is not configured.", provider=PROVIDER_NAME)

    def put(self, *, storage_key: str, content: bytes, content_type: str) -> StoredObject:
        self._require()
        # The same traversal refusal the real adapter applies, so a test cannot
        # pass here and fail in production.
        if storage_key.startswith("/") or ".." in storage_key.split("/"):
            raise ProviderNotConfigured("Refused a storage key outside the root.", provider=PROVIDER_NAME)
        self.objects[storage_key] = content
        self.content_types[storage_key] = content_type
        return StoredObject(
            storage_key=storage_key, size_bytes=len(content), checksum=_checksum(content)
        )

    def get(self, *, storage_key: str) -> bytes:
        self._require()
        if storage_key not in self.objects:
            raise FileNotFoundError(storage_key)
        return self.objects[storage_key]

    def delete(self, *, storage_key: str) -> None:
        self._require()
        self.objects.pop(storage_key, None)
        self.content_types.pop(storage_key, None)

    def exists(self, *, storage_key: str) -> bool:
        return storage_key in self.objects


__all__ = [
    "LocalObjectStorageAdapter",
    "StubStorageAdapter",
    "PROVIDER_NAME",
    "CREDENTIAL_REFS",
]
