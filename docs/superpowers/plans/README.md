# P0 Identity Foundation — Implementation Plans Index

**Spec:** [2026-04-21-deerflow-identity-foundation-design.md](../specs/2026-04-21-deerflow-identity-foundation-design.md)

This directory contains 7 implementation plans, one per milestone of the P0 identity foundation. Execute in order. Each milestone produces an independently-shippable PR against `HE1780/deer-flow:main`.

| Milestone | Plan | Scope | Detail level | Depends on | Status |
|---|---|---|---|---|---|
| **M1** | [m1-schema-bootstrap-feature-flag](./2026-04-21-m1-schema-bootstrap-feature-flag.md) | Postgres identity schema + Alembic + ORM models + bootstrap + `ENABLE_IDENTITY` flag (default off) + docker-compose pg/redis + CI job | **Full TDD** (ready to execute as-is) | none | ⏳ not started |
| **M2** | [m2-authentication](./2026-04-21-m2-authentication.md) | OIDC (Okta/Azure/Keycloak) + internal JWT + API tokens + Redis sessions + login lockout + `/auth/*` + `/me` routes | Signature TDD (expand during implementation) | M1 | ⏳ |
| **M3** | [m3-rbac-middleware](./2026-04-21-m3-rbac-middleware.md) | `@requires` decorator + SQLAlchemy tenant auto-filter + horizontal-access matrix tests + read-only roles/perms routes | Signature TDD | M2 | ⏳ |
| **M4** | [m4-storage-isolation](./2026-04-21-m4-storage-isolation.md) | tenant/workspace file paths + tenant-aware skills loader + 3-layer config merge + sandbox mount rewrite + artifacts authz | Task-list | M3 | ⏳ |
| **M5** | [m5-langgraph-identity-guardrail](./2026-04-21-m5-langgraph-identity-guardrail.md) | HMAC-signed identity headers Gateway→LangGraph + LangGraph `IdentityMiddleware` + `GuardrailMiddleware` tool-level authz + subagent inheritance | Task-list | M4 | ⏳ |
| **M6** | [m6-audit](./2026-04-21-m6-audit.md) | `AuditMiddleware` + async batch writer + JSONL fallback + query/export API + retention + DB GRANT immutability | Task-list | M5 | ⏳ |
| **M7** | [m7-admin-ui-migration-release](./2026-04-21-m7-admin-ui-migration-release.md) | 14 admin pages + Playwright E2E + migration script + multi-replica bootstrap lock + metrics + release guide | Task-list (3 sub-PRs) | M6 | ⏳ |

## How to execute

**Recommended workflow per milestone:**

1. Open a **new Claude Code session** in this repo with the target plan as the opening reference.
2. Invoke `superpowers:subagent-driven-development` to dispatch fresh subagents per task with review between tasks.
3. Alternative: `superpowers:executing-plans` for batch execution with checkpoints.
4. Land PR against `HE1780/deer-flow:main` before starting the next milestone.

## Detail-level legend

- **Full TDD** (M1): Every task has 5-step TDD ladder with complete test code, implementation code, exact shell commands, and commit messages. Can be executed without further spec-ing.
- **Signature TDD** (M2, M3): Function signatures, test case lists, and algorithm sketches are complete. Implementation agent expands bodies during TDD flow using the M1 pattern as template.
- **Task-list** (M4-M7): Each task lists files, the interface, and what tests prove. Agent writes TDD ladders on the spot. These plans are intentionally shorter — the spec and the fully-fleshed M1 are sufficient references.

## If a plan conflicts with spec

Reality trumps plans. If an M4+ plan is found to contradict what M1-M3 actually shipped (e.g., different SQLAlchemy event API, renamed ContextVar), the executing agent MUST:

1. Stop work.
2. File a spec amendment PR against the spec document with rationale.
3. Resume only after the spec is updated (or the plan is rewritten to match reality).

Do not silently reconcile. Do not copy-paste old plan code that references renamed symbols.

## Cross-plan invariants

These invariants MUST hold across all 7 milestones; regressing one is a hard failure:

1. **`ENABLE_IDENTITY=false` ⇒ zero behavior change from pre-M1 main.** The regression guard `backend/tests/identity/test_feature_flag_offline.py` (added in M1) must stay green forever.
2. **Harness boundary.** No code in `backend/packages/harness/deerflow/` imports from `app.*`. Enforced by `backend/tests/test_harness_boundary.py`.
3. **Audit log immutability.** After M6, DB GRANT denies UPDATE/DELETE on `identity.audit_logs`. Migrations that break this revert.
4. **Path derived from identity.** No business code may compute a storage path from untrusted user input; must go through `storage/paths.py`.
5. **Tool permission whitelist.** `TOOL_PERMISSION_MAP` + MCP-declared permissions are the only paths to allow a tool; unknown tools default-deny (after M5).
