"""The frontend's hand-written enums must match the backend's, exactly.

`client/src/api/types.ts` transcribes the backend's DTOs by hand. That is the
right trade — a generated client would hide the contract behind a build step —
but a transcription can be WRONG, and a wrong one is invisible until a user
picks the bad value and gets a 422.

Both of these were real, and both shipped past a green type-check, a green unit
suite and a green browser run before this test existed:

  * `handling_mode` was written as `"ai" | "human"`. The real vocabulary is
    `ai_assisted | human | ai_paused`, so the mode selector posted a value the
    domain refuses — and `ai_assisted` is the mode that gates AI drafting, so
    the assistant silently never produced a draft.
  * `LeadStatus` carried `"converted"`, which does not exist. The real fifth
    status is `nurturing`; conversion is recorded by `converted_at`, not by a
    status value.
  * The inbox polled for proposals with `status=proposed`. The real status of a
    freshly generated proposal is `pending`, so the poll matched nothing and
    every AI draft appeared to time out.

TypeScript cannot catch either: it checks the frontend against itself. This
test checks it against the source of truth.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from apps.aiagent.models import (
    PROPOSAL_ABANDONED,
    PROPOSAL_ACCEPTED,
    PROPOSAL_PENDING,
    PROPOSAL_REJECTED,
)
from apps.crm.models import LEAD_PRIORITIES, LEAD_STATUSES, ORIGIN_TYPES
from apps.customers.models import PARTY_KINDS
from apps.messaging.models import HANDLING_MODES

PROPOSAL_STATUSES = (
    PROPOSAL_PENDING,
    PROPOSAL_ACCEPTED,
    PROPOSAL_REJECTED,
    PROPOSAL_ABANDONED,
)

REPO = Path(__file__).resolve().parents[2]
TYPES_TS = REPO / "client" / "src" / "api" / "types.ts"
PRIMITIVES_TSX = REPO / "client" / "src" / "features" / "crm" / "components" / "primitives.tsx"


def _union_members(source: str, alias: str) -> set[str]:
    """Read `export type <alias> = "a" | "b";` — including a multi-line body."""
    match = re.search(rf"export type {alias}\s*=\s*([^;]+);", source, re.S)
    assert match, f"type alias {alias} not found in types.ts"
    return set(re.findall(r'"([^"]+)"', match.group(1)))


def _record_keys(source: str, name: str) -> set[str]:
    """Read the keys of `const <name>: Record<...> = { a: "..", b: ".." }`."""
    match = re.search(rf"const {name}[^=]*=\s*\{{(.*?)\n\}};", source, re.S)
    assert match, f"record {name} not found"
    return set(re.findall(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:", match.group(1), re.M))


@pytest.fixture(scope="module")
def types_source() -> str:
    return TYPES_TS.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def primitives_source() -> str:
    return PRIMITIVES_TSX.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    ("alias", "backend_values"),
    [
        ("LeadStatus", LEAD_STATUSES),
        ("LeadPriority", LEAD_PRIORITIES),
        ("LeadOrigin", ORIGIN_TYPES),
        ("PartyKind", PARTY_KINDS),
        ("HandlingMode", HANDLING_MODES),
        ("ProposalStatus", PROPOSAL_STATUSES),
    ],
)
def test_the_frontend_union_matches_the_backend_vocabulary(types_source, alias, backend_values):
    assert _union_members(types_source, alias) == set(backend_values), (
        f"{alias} in types.ts has drifted from the backend"
    )


@pytest.mark.parametrize(
    ("record", "backend_values"),
    [
        ("leadStatusLabels", LEAD_STATUSES),
        ("leadPriorityLabels", LEAD_PRIORITIES),
        ("originLabels", ORIGIN_TYPES),
        ("partyKindLabels", PARTY_KINDS),
    ],
)
def test_every_backend_value_has_a_label_and_no_label_is_invented(
    primitives_source, record, backend_values
):
    """A missing label renders a raw enum; an invented one is offered in a
    select and rejected with 422 the moment a user picks it."""
    assert _record_keys(primitives_source, record) == set(backend_values), (
        f"{record} in primitives.tsx has drifted from the backend"
    )
