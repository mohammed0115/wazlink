"""T-ARCH-8 — common/ imports NOTHING from apps/.

This is what keeps the cross-cutting pipeline a class B dependency instead of a
pile of class A edges. A single `from apps...` in common/ would invert the
whole layering.
"""

from __future__ import annotations

import ast
import pathlib

import pytest

COMMON_ROOT = pathlib.Path(__file__).resolve().parent.parent / "common"


def _apps_imports(path: pathlib.Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found += [a.name for a in node.names if a.name.split(".")[0] == "apps"]
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.module.split(".")[0] == "apps":
                found.append(node.module)
    return found


def test_arch_8_common_imports_nothing_from_apps():
    offenders: dict[str, list[str]] = {}
    for path in sorted(COMMON_ROOT.rglob("*.py")):
        found = _apps_imports(path)
        if found:
            offenders[str(path.relative_to(COMMON_ROOT))] = found
    assert offenders == {}, f"common/ imports from apps/: {offenders}"


@pytest.mark.nc
def test_arch_8_detector_is_not_vacuous(tmp_path):
    """A detector that finds nothing would pass a broken tree."""
    probe = tmp_path / "probe.py"
    probe.write_text("from apps.crm.models import Lead\n")
    assert _apps_imports(probe) == ["apps.crm.models"]


def test_no_app_imports_config():
    """B14_03 §6 — no app may import the composition root (T-ARCH-9)."""
    apps_root = pathlib.Path(__file__).resolve().parent.parent / "apps"
    offenders: dict[str, list[str]] = {}
    for path in sorted(apps_root.rglob("*.py")):
        if "migrations" in path.parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        found = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                found += [a.name for a in node.names if a.name.split(".")[0] == "config"]
            elif isinstance(node, ast.ImportFrom):
                if node.module and node.module.split(".")[0] == "config":
                    found.append(node.module)
        if found:
            offenders[str(path)] = found
    assert offenders == {}, f"apps importing config/: {offenders}"
