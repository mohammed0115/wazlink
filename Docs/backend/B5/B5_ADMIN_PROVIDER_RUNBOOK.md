# B5 — Admin Provider Runbook

> **B5 status:** Target design only. Operational sequence design for a future admin experience. No real secrets appear anywhere in this document.

## 1. Obtain Meta credentials

An operator (workspace admin) creates a Meta Business/WhatsApp Business Account and a phone number through Meta's own onboarding (external to WazLink, `B5-X-001`-adjacent). They obtain: a WABA ID, a phone-number ID, an access token, an app secret, and choose a webhook verify token. This step happens entirely outside WazLink.

## 2. Configure WazLink

`PUT /messaging/provider/configuration` (`messaging.provider.manage`) — the operator supplies the values obtained in §1. WazLink stores secrets as references (`B5_PROVIDER_CONFIGURATION_MODEL.md` §2), `ChannelBinding.status → configuration_required` until all required fields are present.

## 3. Configuration check

`POST /messaging/provider/configuration/check` — WazLink performs the health check of `B5_PROVIDER_CONFIGURATION_MODEL.md` §4 (token validity, phone-number/WABA match, scope). Failure surfaces a specific `error_code`; the operator corrects and re-checks.

## 4. Webhook verification

The operator registers WazLink's webhook URL in Meta's app dashboard (external step). Meta issues the `GET` verification handshake (`B5_WEBHOOK_SECURITY_MODEL.md` §2) against WazLink's endpoint; WazLink responds automatically using the configured `webhook_verify_token_ref`. No manual WazLink-side action is required at this step beyond having already configured the token in §2.

## 5. Provider health check passes

`ChannelBinding.status → connected`.

## 6. Enable provider

`enabled → true` (a separate flag from `status`, `B5_PROVIDER_CONFIGURATION_MODEL.md` §5) — the deliberate final step that actually permits sends, distinct from merely being configured/healthy.

## 7. Send a sandbox/test message

The operator sends a test message to a number they control, through the ordinary `SendMessage` path (there is no separate "test send" command — using the real governed path is the point: it proves the real path works, `B5-D-A025`'s "no second transport path" principle extends to testing).

## 8. Receive an inbound message

The operator (or a colleague) replies from the test recipient's phone. The operator confirms it appears in the Inbox as a new/reopened Conversation.

## 9. Verify delivery callback

The operator confirms the sent test message's status progresses `queued → submitted → sent → delivered` (and, if the test recipient reads it, `→ read`) in the UI, confirming the webhook pipeline is live end to end.

## 10. Inspect observability

The operator (or an SRE) checks `B5_RECONCILIATION_OBSERVABILITY.md` §1's metrics for the workspace — `messages_outbound_total`, `provider_send_attempts_total`, `webhook_received_total` — to confirm telemetry is flowing before relying on the channel for real customer traffic.

## 11. Rotate a credential

`PUT /messaging/provider/configuration` with a new `access_token` (or `app_secret`, requiring re-verification of the webhook signature scheme) — `status` returns to `configuration_required` (`B5_PROVIDER_CONFIGURATION_MODEL.md` §7), forcing a fresh health check (§3 of this runbook) before `connected` is re-reachable. The prior credential reference is invalidated, not merely superseded.

## 12. Disable the provider safely

`enabled → false` — an immediate, reversible pause. In-flight `queued`/`submitted` sends are not silently dropped: `queued` sends fail fast at admission for *new* requests (`provider_disabled`), while a send already `submitted` before the disable completes its in-flight attempt per the normal cooperative-checkpoint discipline (`B5_MESSAGE_STATE_MACHINE.md`, mirroring B4's identical "don't abandon in-flight work" principle). Inbound continues to be accepted (§`B5_PROVIDER_CONFIGURATION_MODEL.md` §5) — disabling the provider pauses WazLink's own outbound capability, not Meta's inbound delivery to WazLink's still-registered webhook.

## What this runbook deliberately does not include

Exact Meta dashboard screens, exact field names for the credential inputs, and exact webhook-registration UI steps — all `B5-X-001`/`B5-X-005`-adjacent external facts, confirmed against current Meta documentation at implementation time, not guessed here.
