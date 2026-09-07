#!/usr/bin/env python3
"""Fail-closed mypy baseline gate used by backend CI.

The Wave 3 baseline deliberately contains exactly two findings.  This script
does not suppress them and does not turn mypy failures into success: it only
accepts mypy's ordinary type-error exit (1) when its complete error set is
exactly the documented baseline.  A missing executable, configuration error,
unexpected diagnostic, malformed output, disappeared baseline, or new error
therefore fails the job.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

EXPECTED_ERRORS = frozenset(
    {
        ("apps/accounts/migrations/0001_initial.py", "var-annotated"),
        ("apps/analytics/composers.py", "union-attr"),
    }
)

DIAGNOSTIC = re.compile(
    r"^(?P<path>[^:\n]+):(?P<line>\d+): (?P<level>error|note): "
    r"(?P<message>.+?)(?:  \[(?P<code>[a-z0-9-]+)\])?$"
)
SUMMARY = re.compile(r"^Found (?P<count>\d+) errors in (?P<files>\d+) files \(checked \d+ source files\)$")


def validate_mypy_result(*, returncode: int, output: str) -> list[str]:
    """Return every reason this result is not the exact accepted baseline."""
    problems: list[str] = []
    if returncode != 1:
        problems.append(
            f"mypy exited {returncode}; expected 1 for the documented two-error baseline"
        )

    actual_errors: list[tuple[str, str]] = []
    summary_count: int | None = None
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if match := DIAGNOSTIC.match(line):
            if match["level"] == "error":
                code = match["code"]
                if not code:
                    problems.append(f"error diagnostic has no error code: {line}")
                else:
                    actual_errors.append((match["path"], code))
            continue
        if match := SUMMARY.match(line):
            if summary_count is not None:
                problems.append("mypy emitted more than one error summary")
            summary_count = int(match["count"])
            continue
        problems.append(f"unparseable mypy output: {line}")

    if summary_count is None:
        problems.append("mypy emitted no parseable error summary")
    elif summary_count != len(actual_errors):
        problems.append(
            f"mypy summary says {summary_count} errors, but {len(actual_errors)} were parsed"
        )

    if len(actual_errors) != len(EXPECTED_ERRORS):
        problems.append(
            "mypy reported "
            f"{len(actual_errors)} errors; required documented baseline is "
            f"{len(EXPECTED_ERRORS)}"
        )
    if set(actual_errors) != EXPECTED_ERRORS:
        problems.append(
            "mypy errors differ from the documented baseline: "
            f"expected {sorted(EXPECTED_ERRORS)}, got {sorted(actual_errors)}"
        )
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mypy",
        default=str(Path(sys.executable).with_name("mypy")),
        help="mypy executable; defaults to the executable beside this Python",
    )
    parser.add_argument("paths", nargs="*", default=["."], help="paths passed to mypy")
    args = parser.parse_args()

    command = [args.mypy, *args.paths]
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    except OSError as exc:
        print(f"::error::mypy could not be executed: {exc}", file=sys.stderr)
        return 2

    # Preserve the two baseline findings in CI output; they must stay visible.
    print(result.stdout, end="")
    problems = validate_mypy_result(returncode=result.returncode, output=result.stdout)
    if problems:
        for problem in problems:
            print(f"::error::{problem}", file=sys.stderr)
        return 1

    print("mypy baseline gate passed: exactly 2 documented errors remain")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
