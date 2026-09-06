"""files workers. The orphan sweep REPORTS; it never repairs (B14_09 §4)."""

from __future__ import annotations

from celery import shared_task


@shared_task(name="files.orphan_file_sweep", queue="maintenance")
def orphan_file_sweep_task() -> int:
    from .services import sweep_orphan_files

    return sweep_orphan_files()


__all__ = ["orphan_file_sweep_task"]
