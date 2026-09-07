#!/usr/bin/env python3
"""`T-CSP-BUILD-1` — the `ID-14` CSP inline-style build check.

Frozen `B13_BROWSER_SECURITY` §2 fixes the CSP directive table but leaves one
value conditional:

    style-src: 'self' (plus 'unsafe-inline' ONLY IF the build tooling emits
    inline styles — a build-tooling fact to confirm at implementation time,
    not asserted here)

`B14_19` §5.10 says how that fact is established: inspect a REAL production
frontend build for inline `style` attributes and elements, then either drop
`'unsafe-inline'` from `style-src` or retain it under §2's stated allowance —
and *"`CSP_INLINE_STYLE_BUILD_CHECK` may never be marked verified without that
evidence"*.

So this script does not decide policy and does not pass or fail on taste. It
observes a real bundle and writes down what it found, in a form the CSP
decision can cite. It exits non-zero only when it cannot do that — a missing
or empty bundle is an unverified check, not a clean one, and silently
reporting "no inline styles" for a directory that was never built is exactly
the false green the frozen requirement forbids.

Usage:  python3 csp_inline_style_check.py <bundle-dir> [--evidence PATH]
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
from datetime import UTC, datetime

# Inline styles a CSP `style-src` without `'unsafe-inline'` would block.
INLINE_STYLE_ATTRIBUTE = re.compile(rb"""<[^>]+\sstyle\s*=\s*["'][^"']*["']""", re.IGNORECASE)
INLINE_STYLE_ELEMENT = re.compile(rb"<style[\s>]", re.IGNORECASE)

# Runtime style injection. A CSP that omits `'unsafe-inline'` blocks these too,
# and they are invisible to a scan that only reads the emitted HTML — which is
# why the JavaScript is scanned rather than assumed innocent.
RUNTIME_STYLE_INJECTION = (
    (re.compile(rb"\.style\.cssText\s*="), "element.style.cssText assignment"),
    (re.compile(rb"createElement\(\s*[\"']style[\"']\s*\)"), "document.createElement('style')"),
    (re.compile(rb"insertRule\s*\("), "CSSStyleSheet.insertRule"),
    (re.compile(rb"\.setAttribute\(\s*[\"']style[\"']"), "setAttribute('style', …)"),
)

SCANNED_SUFFIXES = {".html", ".htm", ".js", ".mjs", ".cjs"}


def scan(bundle: pathlib.Path) -> dict:
    findings: list[dict] = []
    scanned: list[str] = []

    for path in sorted(bundle.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SCANNED_SUFFIXES:
            continue
        relative = str(path.relative_to(bundle))
        scanned.append(relative)
        blob = path.read_bytes()

        if path.suffix.lower() in (".html", ".htm"):
            attributes = len(INLINE_STYLE_ATTRIBUTE.findall(blob))
            if attributes:
                findings.append(
                    {"file": relative, "kind": "style attribute", "occurrences": attributes}
                )
            elements = len(INLINE_STYLE_ELEMENT.findall(blob))
            if elements:
                findings.append({"file": relative, "kind": "<style> element", "occurrences": elements})

        for pattern, label in RUNTIME_STYLE_INJECTION:
            hits = len(pattern.findall(blob))
            if hits:
                findings.append({"file": relative, "kind": label, "occurrences": hits})

    return {"scanned_files": scanned, "findings": findings}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", help="the production build output directory")
    parser.add_argument("--evidence", default="", help="where to write the JSON evidence")
    args = parser.parse_args()

    bundle = pathlib.Path(args.bundle).resolve()
    if not bundle.is_dir():
        print(f"T-CSP-BUILD-1: UNVERIFIED — no bundle at {bundle}", file=sys.stderr)
        print("A real production build is required; this check never runs on source.", file=sys.stderr)
        return 2

    result = scan(bundle)
    if not result["scanned_files"]:
        print(f"T-CSP-BUILD-1: UNVERIFIED — {bundle} contains no HTML or JS", file=sys.stderr)
        return 2

    inline_required = bool(result["findings"])
    evidence = {
        "check": "T-CSP-BUILD-1",
        "decision_id": "ID-14",
        "observed_at": datetime.now(UTC).isoformat(),
        "bundle": str(bundle),
        "files_scanned": len(result["scanned_files"]),
        "inline_styles_present": inline_required,
        "findings": result["findings"],
        # The whole point of the check, stated as the CSP decision it feeds.
        "style_src": (
            "'self' 'unsafe-inline'" if inline_required else "'self'"
        ),
        "basis": (
            "B13_BROWSER_SECURITY §2 retains 'unsafe-inline' only where the build "
            "tooling emits inline styles; this bundle does."
            if inline_required
            else "B13_BROWSER_SECURITY §2: the build emits no inline styles, so "
            "'unsafe-inline' is dropped from style-src."
        ),
    }

    default_evidence = bundle.parent / "csp-inline-style-evidence.json"
    destination = pathlib.Path(args.evidence) if args.evidence else default_evidence
    destination.write_text(json.dumps(evidence, indent=2) + "\n")

    print(f"T-CSP-BUILD-1: VERIFIED against a real production bundle ({bundle})")
    print(f"  files scanned      : {evidence['files_scanned']}")
    print(f"  inline styles found: {inline_required}")
    for finding in result["findings"]:
        print(f"    - {finding['file']}: {finding['kind']} x{finding['occurrences']}")
    print(f"  style-src          : {evidence['style_src']}")
    print(f"  evidence           : {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
