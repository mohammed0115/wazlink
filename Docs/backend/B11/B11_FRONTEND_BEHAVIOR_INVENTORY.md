# B11 — Frontend Behavior Inventory

> Frontend evidence only. **No frontend file is modified by B11.** Frozen frontend reference: `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` — the same reference every prior phase used, independently re-verified unchanged against current HEAD during this pass. Evidence root: `client/src/`.

## 1. Method

Mechanical, case-insensitive search of the whole `client/src` tree for every file/upload/attachment/media/download term (`upload`, `attach`, `file`, `blob`, `FormData`, `FileReader`, `input type="file"`, `accept=`, `dropzone`, `drag`, `download`, `media`, `avatar`, `logo`, `image`, `createObjectURL`, `storage`, `تخزين`, `مساحة`, `مرفق`), then reading every genuine hit in full context and discarding substring false positives (`localStorage`/`sessionStorage`, `profile`, `fileName` in unrelated contexts). Files read in full or by targeted section: `features/inbox/Inbox.tsx`, `domain/data.js` (messages, `sendMockMessage`, `getBillingUsage`), `services/contracts/services.ts`, `services/index.ts`, `features/analytics/export.ts`, `features/intelligence/export.ts`, `features/settings/Billing.tsx`, `features/auth/Onboarding.tsx`, `services/onboardingService.ts`, `config/env.ts`, `shared/shell/*`.

Classification identical to B8's and B10's precedent:

- **A** — must be preserved / directly shapes a B11 backend contract
- **B** — derivable from existing data, informative
- **C** — placeholder/presentation only
- **D** — intentionally unsupported/deferred, non-authoritative

**The single most important finding: `client/src` contains no `<input type="file">`, no `FileReader`, no drag-and-drop handler, no multipart `FormData` byte submission, and no server upload call of any kind.** Every `FormData` occurrence in the tree is an ordinary text-form read (`new FormData(event.currentTarget)` in `Login.tsx`, `DealModal.tsx`, `Settings.tsx`, `Checkout.tsx`, `Discovery.tsx`, `Onboarding.tsx`, `AutomationModal.tsx`, `AppointmentModal.tsx`, `Lead360.tsx`, `Integrations.tsx`). The only two `Blob`/`createObjectURL` uses construct CSV entirely client-side and never contact a server. This produces a real inventory of **11** behaviors — deliberately not padded to resemble a larger prior phase's count, and deliberately not shrunk to hide that the evidence for a client upload surface is thin.

## 2. Totals

| Class | Count |
|---|---:|
| A | 3 |
| B | 1 |
| C | 4 |
| D | 3 |
| **Total** | **11** |

`FRONTEND_BEHAVIOR_COUNT = 11`, `FRONTEND_A_COUNT = 3`, `FRONTEND_B_COUNT = 1`, `FRONTEND_C_COUNT = 4`, `FRONTEND_D_COUNT = 3`. `3 + 1 + 4 + 3 = 11`, confirmed.

## 3. Class A — backend-contract-shaping

| ID | Class | Source | Line/Range | Observed behavior | B11 interpretation | Contract required |
|---|---|---|---|---|---|---|
| `FB-B11-001` | A | `client/src/features/inbox/Inbox.tsx` | 26, 59, 416-440 | The message composer's only attach affordance is a button labelled "إرفاق وصف تجريبي" whose handler is `setAttachment(current => current ? null : { name: "عرض-تجريبي.pdf", size: "240KB" })` — a hardcoded local object toggled in React state. `type Attachment = { name: string; size: string } \| null`. There is no file picker, no bytes, and no network call | Confirms the **messaging composer is the sole Phase-1 client upload surface** in the product's own design intent, which is exactly what `B5_MEDIA_B11_HANDOFF.md` §3's outbound flow already anticipates. It also confirms the surface is entirely unbuilt, so B11 is free to specify the upload contract without breaking a shipped client. Directly grounds `B11-D-A014`'s decision to register `message_media` as the one active attachment subject type | **Yes** |
| `FB-B11-002` | A | `client/src/domain/data.js` | 539 (`sendMockMessage`) | Accepts `options.attachment` and persists `attachment: { name, size, mime }` on the message; sets `type: attachment?.type \|\| "text"`; admits a message when `text \|\| attachment` — i.e. an attachment alone is a valid message | The `{name, size, mime}` triple is exactly the frozen `UploadRequest{filename, content_type}` pair plus size, corroborating `B11-AM-001`'s additive `size_bytes` field rather than inventing it. "Attachment alone is a valid message" confirms media must be attachable independently of body text, which is why `AttachFile` is a separate command rather than a side effect of a text send | **Yes** |
| `FB-B11-003` | A | `client/src/domain/data.js` | 70, 74 | Two message fixtures carry real attachment metadata: `{name:"مسار_الحجز.png", size:"184 ك.ب", mime:"image/png"}` with `type:"image"`, and `{name:"عرض_نطاق_العمل.pdf", size:"312 ك.ب", mime:"application/pdf"}` with `type:"document"`. Both filenames are Arabic; the second message's `status` is `"failed"` | Three contract consequences. (1) `image/png` and `application/pdf` are the only content types with any frontend evidence, and they seed `B11_FILE_VALIDATION.md` §6's allow-list rather than a guessed list. (2) **Filenames are Arabic in the product's own fixtures**, which is why `B11_FILE_VALIDATION.md` §5 strips bidi *control characters* rather than restricting the character set, and why `Content-Disposition` must carry RFC 5987 `filename*`. (3) `type` (`image`/`document`) is a family distinct from `mime`, matching B5's frozen four-family enum | **Yes** |

## 4. Class B

| ID | Class | Source | Line/Range | Observed behavior | B11 interpretation | Contract required |
|---|---|---|---|---|---|---|
| `FB-B11-004` | B | `client/src/services/contracts/services.ts` | 110, 139, 161, 201 | The typed service contract for sending is `SendHumanMessageInput extends FeatureRow { body?: string }` — **no `attachment` field**. `MessageView` likewise has no `attachment` field. The attachment travels only through `FeatureRow`'s `[key: string]: unknown` index signature | No frozen *typed* frontend contract constrains B11's DTO shape, because the attachment was never promoted into the typed layer. B11's `UploadRequest`/`FileAsset` extensions therefore cannot contradict a shipped contract — a genuinely useful negative finding, since a typed `attachment` field would have forced B11 to match its shape | No |

## 5. Class C — placeholder/presentation only

| ID | Class | Source | Line/Range | Observed behavior | B11 interpretation |
|---|---|---|---|---|---|
| `FB-B11-005` | C | `client/src/features/inbox/Inbox.tsx` | 327-336 | The message bubble renders an attachment as an icon (`▧` for image, `▤` otherwise) plus `<b>{name}</b>` and `<small>{size} · تجريبي</small>` — literally labelled "demo." There is **no link, no href, no thumbnail, no download action** | Presentation only. Confirms no download affordance exists today, so B11's `GET /files/{id}/download` + `/content` pair has no shipped consumer to satisfy and no legacy shape to preserve |
| `FB-B11-006` | C | `client/src/features/settings/Billing.tsx` | 277-280 | Every invoice-history row ends with `<button className="button ghost" type="button" disabled title="غير متاح في S11">قريبًا</button>` — a permanently disabled "soon" button | An unbuilt placeholder for a future invoice download. B11 registers **no** billing or tax attachment subject type on the strength of a disabled button (`B11_DOMAIN_ATTACHMENT_MODEL.md` §3) |
| `FB-B11-007` | C | `Inbox.tsx:115`, `sales/shared.tsx:33`, `settings/shared.tsx:80`, `dashboard/Dashboard.tsx:194`, `shared/shell/Topbar.tsx:41`, `shared/shell/Brand.tsx:7`, `landing/Landing.tsx:65` | as listed | Every image in the product is one static build asset: `<img src={`${appConfig.assetBaseUrl}wazlink-mark.svg`} />`, where `assetBaseUrl` is `import.meta.env.BASE_URL` (`config/env.ts:17`) | A Vite build asset served from the app's own base path. **Not a `FileAsset`**, not uploaded, not workspace-scoped, not in B11's scope at all. Recorded so that the absence of any logo/branding upload is an explicit finding rather than an oversight |
| `FB-B11-008` | C | `Settings.tsx:181,233`, `shared/shell/Sidebar.tsx:97`, `ui-kit/UiKit.tsx:70`, `Inbox.tsx:197` | as listed | Every avatar in the product is a first-letter initial: `<i className="avatar">{user.name.slice(0, 1)}</i>` | **There is no profile photo, no business logo, and no image-upload field anywhere.** B11 therefore designs no avatar/logo pipeline, no image derivatives, and no thumbnailing (`B11-D-B006`, deferred) |

## 6. Class D — intentionally unsupported/deferred

| ID | Class | Source | Line/Range | Observed behavior | B11 interpretation |
|---|---|---|---|---|---|
| `FB-B11-009` | D | `client/src/features/analytics/export.ts` (11-28); `client/src/features/intelligence/export.ts` (31-49) | as listed | Both exports build a CSV string in memory, wrap it in `new Blob([...], {type:"text/csv;charset=utf-8"})`, call `URL.createObjectURL`, click a synthetic `<a download>`, and `revokeObjectURL`. The analytics file's own header comment states: *"لا نقل بيانات إلى خدمة خارجية"* ("no data transfer to an external service") | **Entirely client-side; no server, no `FileAsset`, no storage.** B11 registers no export subject type and designs no export artifact, because none is produced. Should exports ever become server-generated, that is a new producer registering a new subject type — additive, and not designed here |
| `FB-B11-010` | D | `client/src/features/auth/Onboarding.tsx` (34); `client/src/services/onboardingService.ts` (33, 59) | as listed | Onboarding offers a data-source checkbox `["file", "ملفات البيانات والجداول"]` ("data files and spreadsheets"), which maps to `{ capability: "export.csv", action: "راجع نتائج الملفات وجهّزها للتصدير المحلي." }` | A **self-description question**, not an import affordance. It sets no state a file could attach to and triggers no upload. B11 designs no file-import pipeline on this evidence |
| `FB-B11-011` | D | `client/src/domain/data.js` (1038, `getBillingUsage`); `client/src/features/settings/Billing.tsx` (41-47) | as listed | `getBillingUsage()` computes usage for exactly five keys — `{leads, discoveryRuns, seats, automationRuns, aiAnalyses}` — and the Billing usage panel renders whatever that returns. Plan fixtures (`data.js:319-321`) carry `limits` for exactly the same five keys | **There is no storage metric, no storage limit, and no storage usage display anywhere in the product.** This is the frontend corroboration for `B11-D-B001`: B11 does not file a sixth-quota-metric amendment against B8, because neither the frozen catalog nor the frozen frontend has any storage entitlement to consume |

## 7. What the inventory implies for B11

The frontend evidence supports exactly one Phase-1 client upload surface (messaging media), two content types, Arabic filenames, no download UI, no file browser, no image pipeline, no server-side export, and no storage entitlement. Every one of those is reflected in a decision rather than designed around: `B11-D-A014` (one active subject type), `B11_FILE_VALIDATION.md` §6 (seeded allow-list), §5 (bidi handling), `B11-D-B005` (no list endpoint), `B11-D-B006` (no derivatives), and `B11-D-B001` (no storage metric).

`FRONTEND_DRIFT = 0`: no file under `client/` is created, modified, or deleted by B11.
