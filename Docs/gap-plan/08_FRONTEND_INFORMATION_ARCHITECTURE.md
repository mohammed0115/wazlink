# 08 — Frontend Information Architecture

> Resolves brief §28. **WazLink must not become a cluttered ERP menu.**

## 1. Problem with the current IA

`client/src/domain/data.js:96` `navItems` declares **21 entries across 9 groups**, three of which (`contacts`, `companies`, `calls`) render `Placeholder`. Adding Customers, Imports, Tickets, Knowledge, Quotes, Products and Calendar naively would push it past 27 — the ERP-menu failure the brief forbids.

## 2. Proposed IA — 7 groups, max 3 visible children each

```
الرئيسية                        #/dashboard

الاستكشاف                       (Track A — hidden when operating_mode = "existing customers")
  اكتشاف العملاء                #/discovery
  عمليات البحث                  #/discovery/jobs
  النتائج                       #/discovery/results

العملاء
  العملاء المحتملون             #/crm
  العملاء                       #/customers          ← NEW
  جهات الاتصال                  #/contacts           ← was Placeholder

المحادثات                       #/inbox              ← Team Inbox (N10)

المبيعات
  الصفقات                       #/deals
  مسار المبيعات                 #/pipeline
  عروض الأسعار                  #/quotes             ← NEW

الخدمة                          (hidden until support is enabled)
  التذاكر                       #/tickets            ← NEW
  قاعدة المعرفة                 #/knowledge          ← NEW

الأنشطة
  المهام                        #/tasks
  التقويم                       #/appointments       ← calendar view (X6)

الذكاء الاصطناعي
  ذكاء العملاء                  #/intelligence
  مساعد المبيعات                #/copilot
  وكيل المبيعات الذكي           #/agent

الأتمتة                         #/automation
التقارير والتحليلات             #/analytics
الإعدادات                       #/settings
```

**Removed:** `#/companies` (subsumed by العملاء), `#/calls` (non-goal). **Relocated into Settings, not top-level:** Imports, Products/Services, Custom Fields, Assignment Rules, Forms, Integrations.

**Net:** 21 entries → **21**, while adding seven capabilities and removing two orphans. The gain comes from demoting configuration surfaces out of primary navigation.

## 3. Why Imports and Products are not top-level

Import is a **task performed rarely**, usually during onboarding, and it has a natural entry point from the Customers empty state and the Customers page action bar (`#/imports/new`). A permanent top-level entry for a once-a-quarter action costs a slot every user pays for daily.

Products/Services is **configuration for Quotes**, not a workspace destination. It lives at `#/settings/catalog` and is reachable from the quote line editor. If usage evidence later shows daily catalog management, promotion is a one-line change — the reverse is not true.

## 4. Operating-mode influence (`GAP-024`)

Onboarding asks *ما الذي تريد تحقيقه؟* → `find_new` | `manage_existing` | `both`.

| Mode | الاستكشاف group | العملاء المحتملون | العملاء | Dashboard |
|---|---|---|---|---|
| `find_new` | shown | primary | shown | acquisition KPIs |
| `manage_existing` | **hidden** | secondary | primary | retention/support KPIs |
| `both` (default) | shown | shown | shown | combined |

**Four hard rules.** Mode changes **navigation and defaults only** — never the data model, never a table, never a permission. It is a reversible `workspaces.operating_mode` preference changeable at any time from Settings with no migration. Hiding is **presentation, not authorization**: a hidden route still resolves if typed, and its API remains permission-gated (a hidden nav item is not a security control — B13). Data created in one mode remains fully valid in another.

## 5. Empty-module behavior

A group whose capability is entitlement-locked renders with the existing frozen upgrade affordance (`EntitlementDecision` → upgrade CTA), **not** hidden — that pattern already exists for `discovery.basic`/`automation.rules`/`inbox.copilot` in `shellNavigation.ts` and must be reused rather than reinvented. A group that is *available but empty* stays visible and routes to an empty state that offers the first action.

## 6. Desktop vs mobile

**Desktop** — persistent right-anchored RTL sidebar with collapsible groups; active-group auto-expansion via the existing `activeMatches` mechanism in `shellNavigation.ts`, extended with the new route ids.

**Mobile (<768px)** — bottom tab bar with the five highest-frequency destinations: الرئيسية · العملاء · المحادثات · المبيعات · المزيد. "المزيد" opens the full grouped list. The Team Inbox uses list→thread drill-down rather than a split pane. Import wizards are single-column, one step per screen.

**Role visibility** — Viewer sees no mutation actions but full read navigation; Sales sees own-scoped lists; Manager and above see all. Every visibility rule mirrors a backend permission from `11_RBAC_PLAN.md` and **adds no client-side authority**.
