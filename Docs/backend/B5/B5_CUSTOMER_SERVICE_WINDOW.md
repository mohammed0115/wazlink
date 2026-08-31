# B5 — WhatsApp Customer-Service Window

> **B5 status:** Target design only. Architects the policy evaluator's shape without guessing Meta's current exact window duration or rule set — those are external validation facts (`B5-X-010`, `B5-X-011`).

## 1. Why this needs its own document

WhatsApp Business messaging (as a category of provider policy, independent of the exact current numbers) distinguishes free-form replies from template-required sends based on how recently the counterparty last messaged the business. Getting this wrong either blocks legitimate replies (false `SEND_BLOCKED`) or lets a rejected send surprise the actor at the provider instead of at admission (a worse failure mode — spent latency and a confusing error). B5 therefore designs an explicit **evaluator**, not an inline conditional buried in the send path.

## 2. The evaluator

> **`B5-D-A018`: `evaluate_window(conversation)` returns exactly one of four outcomes, computed at send-admission time from stored, workspace-scoped facts — never from a hard-coded duration inside domain logic.**

```
evaluate_window(conversation) =
    last_inbound = most recent Message WHERE conversation_id = :id AND direction = 'inbound'
    IF last_inbound is null:
        UNKNOWN_REQUIRES_VALIDATION   -- no inbound history; provider policy for a
                                        business-initiated first contact is itself
                                        template-governed by definition, but B5 does
                                        not assume the exact rule without B5-X-011
    ELIF now() - last_inbound.created_at <= WINDOW_DURATION:
        FREE_FORM_ALLOWED
    ELSE:
        TEMPLATE_REQUIRED
```

`WINDOW_DURATION` is a **configuration constant**, not a literal in domain code — sourced from `B5-X-010` once confirmed, kept in the same class of value as `B4_FRESHNESS_STALENESS.md`'s `freshness_age_threshold` (Class B, tunable, existence of the concept is Class A).

`SEND_BLOCKED` is reachable only as a **composed** outcome, never directly from this function: it is what the caller (`B5_OUTBOUND_PIPELINE.md` §2 step 7) reports when the evaluator returns `TEMPLATE_REQUIRED` **and** the actor attempted a free-form (non-template) send. A template send is never `SEND_BLOCKED` by window policy — the window governs *free-form* eligibility, not whether WazLink can message the recipient at all (a template send remains legal within Meta's own separate template-approval gate, `B5_TEMPLATE_MODEL.md`).

## 3. What governs each outcome

| Outcome | Meaning | What the actor can do |
|---|---|---|
| `FREE_FORM_ALLOWED` | within the active window | send `text`/`media`/any content type |
| `TEMPLATE_REQUIRED` | window has lapsed | only `content_type=template` sends are admitted; a free-form attempt is rejected (§2's `SEND_BLOCKED` composition) with a clear, actionable reason |
| `SEND_BLOCKED` | (composed, not a raw evaluator output) — a free-form send was attempted while `TEMPLATE_REQUIRED` | `422 VALIDATION_ERROR`, `details.reason="template_required"` — never silently converted to a template send on the actor's behalf; WazLink does not choose a template for a human |
| `UNKNOWN_REQUIRES_VALIDATION` | no inbound history exists to evaluate against, or `B5-X-011`'s exact rule set is not yet confirmed for this case | treated conservatively as `TEMPLATE_REQUIRED` (the safer default — a template send is always provider-legal; a guessed free-form send might not be) until `B5-X-011` resolves the precise rule |

## 4. Where this runs

`B5_OUTBOUND_PIPELINE.md` §2 step 7, inside the synchronous admission sequence — before any Message row is even persisted with `content_type` locked in as free-form, because content immutability (`B5-D-A004`) means a rejected-then-silently-converted send is not an option; rejection must happen before admission, not as a later correction.

## 5. Interaction with the customer-service window and consent

Order of evaluation matters and is fixed by `B5_OUTBOUND_PIPELINE.md` §2: consent (step 6) is checked **before** the window (step 7) — an opted-out recipient is rejected regardless of window state, because consent is the more fundamental gate. A recipient who is within the window but opted out is still blocked; a recipient outside the window who has opted in is not blocked by consent but may still require a template.

## 6. No hard-coded assumption leaks into acceptance tests

`B5_ACCEPTANCE_TESTS.md`'s `POLICY` category tests the evaluator's four-outcome **shape** and its ordering relative to consent/rate-limiting — never a specific duration number, which would encode an unconfirmed external fact as if it were frozen architecture.
