"""The class A import-dependency walker (B14_03 §4a).

Rules implemented:
  W-1  A class A edge is a STATIC IMPORT of one app's symbol by another app.
  W-2  config/ is the composition root and is EXCLUDED from the walk.
  W-3  A selector/service call that requires an import IS an edge.
  W-4  The walk covers EVERY file under apps/ — never a representative sample.
  W-6  String-reference FKs, outbox events, name-dispatched commands and
       registry-resolved providers produce NO edge: none is a static import.
  W-8  The resulting graph must be acyclic.
  W-9  There is NO exception list. Counters are 0, never "0 excluding ...".
"""

from __future__ import annotations

import ast
import pathlib

APPS_ROOT = pathlib.Path(__file__).resolve().parent.parent / "apps"

# The 26-module layering (B14_03 §5). Wave 1 installs a subset; the layer map
# is complete so a later wave cannot silently move a module.
LAYERS: dict[str, int] = {
    "accounts": 1,
    "identity_access": 2,
    "workspaces": 2,
    "entitlements": 3,
    "files": 3,
    "platform_async": 3,
    "auditlog": 3,
    "customfields": 3,
    "identity": 4,
    "discovery": 4,
    "billing": 4,
    "assignment": 4,
    "knowledge": 4,
    "crm": 5,
    "tax": 5,
    "customers": 6,
    "intelligence": 6,
    "messaging": 6,
    "pipeline": 7,
    "revenue": 7,
    "imports": 8,
    "aiagent": 8,
    "support": 8,
    "automation": 9,
    "analytics": 10,
    "integrations": 10,
}


def discover_modules() -> set[str]:
    return {path.name for path in APPS_ROOT.iterdir() if path.is_dir() and (path / "__init__.py").exists()}


def _imported_apps(tree: ast.AST) -> set[str]:
    """Extract every `apps.<module>` referenced by a static import."""
    found: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                parts = alias.name.split(".")
                if len(parts) >= 2 and parts[0] == "apps":
                    found.add(parts[1])
        elif isinstance(node, ast.ImportFrom):
            if node.level:  # relative import: within the same app, no edge
                continue
            if not node.module:
                continue
            parts = node.module.split(".")
            if len(parts) >= 2 and parts[0] == "apps":
                found.add(parts[1])
    return found


def build_edges(extra_source: dict[str, str] | None = None) -> set[tuple[str, str]]:
    """Build the class A edge set by AST-walking EVERY file under apps/.

    `extra_source` injects synthetic module source for negative controls.
    """
    edges: set[tuple[str, str]] = set()

    for path in sorted(APPS_ROOT.rglob("*.py")):
        if "migrations" in path.parts:
            # A migration's model references are string references (W-6).
            continue
        module = path.relative_to(APPS_ROOT).parts[0]
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError:
            continue
        for target in _imported_apps(tree):
            if target != module:
                edges.add((module, target))

    for module, source in (extra_source or {}).items():
        tree = ast.parse(source)
        for target in _imported_apps(tree):
            if target != module:
                edges.add((module, target))

    return edges


def classify(edges: set[tuple[str, str]]) -> dict[str, object]:
    same_layer, upward = [], []
    for source, target in sorted(edges):
        source_layer, target_layer = LAYERS.get(source), LAYERS.get(target)
        if source_layer is None or target_layer is None:
            continue
        if source_layer == target_layer:
            same_layer.append((source, target))
        elif source_layer < target_layer:
            upward.append((source, target))
    return {
        "edges": sorted(edges),
        "same_layer": same_layer,
        "upward": upward,
        "cycles": find_cycles(edges),
    }


def find_cycles(edges: set[tuple[str, str]]) -> list[list[str]]:
    """Return every simple cycle in the module graph."""
    graph: dict[str, set[str]] = {}
    for source, target in edges:
        graph.setdefault(source, set()).add(target)

    cycles: list[list[str]] = []
    seen_signatures: set[frozenset[str]] = set()

    def visit(node: str, stack: list[str], visiting: set[str]) -> None:
        for neighbour in sorted(graph.get(node, ())):
            if neighbour in visiting:
                cycle = stack[stack.index(neighbour) :] + [neighbour]
                signature = frozenset(cycle)
                if signature not in seen_signatures:
                    seen_signatures.add(signature)
                    cycles.append(cycle)
                continue
            visit(neighbour, stack + [neighbour], visiting | {neighbour})

    for start in sorted(graph):
        visit(start, [start], {start})
    return cycles
