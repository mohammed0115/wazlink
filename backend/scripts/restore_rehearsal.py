#!/usr/bin/env python3
"""`CB-23`/`CB-25` — back up, restore, and PROVE the restore.

Frozen `B13_BACKUP_RESTORE` §5 states the reason this exists:

    A backup that has never been restored is not a backup — it is an
    unverified assumption.

and requires, on every restore test and not optionally, *"checksum/row-count
comparison against the source, plus a smoke test of the application against
the restored database"*. `AT-B13BAK-4` sharpens the row-count clause for money:
*"A restored database's financial-row count matches the source at the backup
timestamp exactly (financial rows are never deleted, so this is a strong
integrity check)."*

The mechanism is deliberately ordinary — `pg_dump` in custom format and
`pg_restore` into a fresh database — because a rehearsal that exercises a
bespoke path proves nothing about the path an operator would actually use at
three in the morning.

Nothing here prints a credential: the source DSN is used, never echoed, and
the record it writes carries counts and identities only.

Usage:
    python3 restore_rehearsal.py --source-url <dsn> --target-db <name> \
        [--record scripts/restore_test_record.json]
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from urllib.parse import urlparse, urlunparse

# The tables whose counts must match EXACTLY. Financial rows are append-only,
# so any drift is corruption rather than churn (`AT-B13BAK-4`).
FINANCIAL_TABLES = (
    "revenue_events",
    "revenue_reversals",
    "revenue_attributions",
    "attribution_touchpoints",
    "payments",
    "payment_attempts",
    "invoices",
    "invoice_lines",
    "refunds",
    "subscriptions",
)

# Representative tenant/CRM tables — the rest of the integrity comparison.
TENANT_TABLES = (
    "workspaces",
    "memberships",
    "users",
    "contacts",
    "leads",
    "customers",
    "deals",
    "tickets",
    "file_assets",
    "audit_logs",
    "django_migrations",
)


def _run(command: list[str], *, env: dict | None = None) -> subprocess.CompletedProcess:
    result = subprocess.run(command, capture_output=True, text=True, env=env, check=False)
    if result.returncode != 0:
        # The command is echoed WITHOUT its environment, so no DSN or password
        # reaches the log even on failure.
        raise RuntimeError(f"{command[0]} failed ({result.returncode}): {result.stderr[-800:]}")
    return result


def _psql_scalar(url: str, sql: str) -> str:
    env = {**os.environ, "PGPASSWORD": urlparse(url).password or ""}
    result = _run(["psql", url, "-t", "-A", "-c", sql], env=env)
    return result.stdout.strip()


def _counts(url: str, tables: tuple[str, ...]) -> dict[str, int]:
    out: dict[str, int] = {}
    for table in tables:
        exists = _psql_scalar(url, f"SELECT to_regclass('public.{table}') IS NOT NULL")
        out[table] = int(_psql_scalar(url, f"SELECT count(*) FROM {table}")) if exists == "t" else -1
    return out


def _financial_fingerprint(url: str) -> str:
    """A checksum over the money itself, not merely over how many rows there are.

    A restore that preserved row counts but altered an amount would pass a
    count comparison and fail this.
    """
    if _psql_scalar(url, "SELECT to_regclass('public.revenue_events') IS NOT NULL") != "t":
        return "absent"
    return _psql_scalar(
        url,
        "SELECT coalesce(md5(string_agg(t, '|' ORDER BY t)), 'empty') FROM ("
        "  SELECT workspace_id::text || ':' || public_id || ':' || gross_amount::text || ':'"
        "         || net_amount::text || ':' || currency || ':' || status AS t"
        "  FROM revenue_events) s",
    )


def _tenant_partition(url: str) -> list[str]:
    """Per-workspace revenue totals — the tenant boundary, expressed as data."""
    if _psql_scalar(url, "SELECT to_regclass('public.revenue_events') IS NOT NULL") != "t":
        return []
    raw = _psql_scalar(
        url,
        "SELECT coalesce(string_agg(w || '=' || total, ',' ORDER BY w), '') FROM ("
        "  SELECT workspace_id::text AS w, sum(net_amount)::text AS total"
        "  FROM revenue_events GROUP BY workspace_id) s",
    )
    return sorted(part for part in raw.split(",") if part)


def _with_database(url: str, database: str) -> str:
    parsed = urlparse(url)
    return urlunparse(parsed._replace(path=f"/{database}"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-url", required=True, help="the DSN to back up (never printed)")
    parser.add_argument("--target-db", required=True, help="fresh database to restore INTO")
    parser.add_argument("--record", default="", help="where to write the restore-test record")
    parser.add_argument("--keep", action="store_true", help="keep the restored database")
    args = parser.parse_args()

    source = args.source_url
    admin = _with_database(source, "postgres")
    target = _with_database(source, args.target_db)
    started = datetime.now(UTC)

    print(f"[1/6] source: {urlparse(source).path.lstrip('/')} (credentials not shown)")
    before_financial = _counts(source, FINANCIAL_TABLES)
    before_tenant = _counts(source, TENANT_TABLES)
    before_fingerprint = _financial_fingerprint(source)
    before_partition = _tenant_partition(source)
    print(f"      financial rows: {sum(v for v in before_financial.values() if v > 0)}")

    with tempfile.TemporaryDirectory() as workdir:
        dump = pathlib.Path(workdir) / "wazlink.dump"
        print("[2/6] pg_dump (custom format)")
        _run(["pg_dump", "--format=custom", "--no-owner", "--no-privileges", "-f", str(dump), source])
        size = dump.stat().st_size
        print(f"      backup created: {size} bytes")
        if size <= 0:
            raise RuntimeError("the backup is empty")

        print(f"[3/6] fresh target database: {args.target_db}")
        _run(["psql", admin, "-c", f'DROP DATABASE IF EXISTS "{args.target_db}"'])
        _run(["psql", admin, "-c", f'CREATE DATABASE "{args.target_db}"'])

        print("[4/6] pg_restore")
        _run(["pg_restore", "--no-owner", "--no-privileges", "-d", target, str(dump)])

    print("[5/6] integrity comparison")
    after_financial = _counts(target, FINANCIAL_TABLES)
    after_tenant = _counts(target, TENANT_TABLES)
    after_fingerprint = _financial_fingerprint(target)
    after_partition = _tenant_partition(target)

    financial_mismatch = {
        table: (before_financial[table], after_financial[table])
        for table in FINANCIAL_TABLES
        if before_financial[table] != after_financial[table]
    }
    row_loss = {
        table: (before_tenant[table], after_tenant[table])
        for table in TENANT_TABLES
        if before_tenant[table] != after_tenant[table]
    }
    tenant_mismatch = before_partition != after_partition
    schema_mismatch = before_tenant.get("django_migrations") != after_tenant.get("django_migrations")

    print("[6/6] application smoke test against the RESTORED database")
    smoke = _smoke_test(target)

    ok = (
        not financial_mismatch
        and not row_loss
        and not tenant_mismatch
        and not schema_mismatch
        and before_fingerprint == after_fingerprint
        and smoke["ok"]
    )

    record = {
        "check": "CB-25 restore test",
        "controls": ["CB-23", "CB-25", "AT-B13BAK-1", "AT-B13BAK-4"],
        "started_at": started.isoformat(),
        "completed_at": datetime.now(UTC).isoformat(),
        "mechanism": "pg_dump --format=custom | pg_restore into a fresh database",
        "backup_created": True,
        "restore_target_fresh": True,
        "restore_success": True,
        "row_loss": row_loss,
        "financial_mismatch": financial_mismatch,
        "financial_fingerprint_match": before_fingerprint == after_fingerprint,
        "tenant_partition_match": not tenant_mismatch,
        "schema_match": not schema_mismatch,
        "financial_row_counts": after_financial,
        "tenant_row_counts": after_tenant,
        "smoke_test": smoke,
        "result": "PASS" if ok else "FAIL",
    }

    destination = pathlib.Path(args.record or "scripts/restore_test_record.json")
    destination.write_text(json.dumps(record, indent=2) + "\n")

    if not args.keep:
        _run(["psql", admin, "-c", f'DROP DATABASE IF EXISTS "{args.target_db}"'])

    print(f"\nROW_LOSS            = {row_loss or 0}")
    print(f"FINANCIAL_MISMATCH  = {financial_mismatch or 0}")
    print(f"TENANT_MISMATCH     = {tenant_mismatch}")
    print(f"SCHEMA_MISMATCH     = {schema_mismatch}")
    print(f"FINGERPRINT_MATCH   = {before_fingerprint == after_fingerprint}")
    print(f"SMOKE_TEST          = {smoke}")
    print(f"RESULT              = {record['result']}   record: {destination}")
    return 0 if ok else 1


def _smoke_test(target_url: str) -> dict:
    """Read the restored database THROUGH the application, not through psql.

    `B13_BACKUP_RESTORE` §5 requires a smoke test of the application against
    the restored database, and reading it with the ORM is what distinguishes a
    restore that Django can actually serve from a pile of correct-looking rows.
    """
    script = (
        "import os,django,json;"
        "os.environ['DJANGO_SETTINGS_MODULE']='config.settings.test';"
        "django.setup();"
        "from apps.workspaces.models import Workspace;"
        "from apps.revenue.models import RevenueEvent;"
        "from apps.customers.models import Customer;"
        "print(json.dumps({'ok':True,'workspaces':Workspace.objects.count(),"
        "'revenue_events':RevenueEvent.objects.count(),"
        "'customers':Customer.objects.count(),"
        "'revenue_net':str(sum((e.net_amount for e in RevenueEvent.objects.all()), start=0))}))"
    )
    env = {**os.environ, "DATABASE_URL": target_url, "ENVIRONMENT": "test"}
    result = subprocess.run(
        [sys.executable, "-c", script], capture_output=True, text=True, env=env, check=False
    )
    if result.returncode != 0:
        return {"ok": False, "error": result.stderr.strip()[-400:]}
    try:
        return json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {"ok": False, "error": "the application produced no readable result"}


if __name__ == "__main__":
    raise SystemExit(main())
