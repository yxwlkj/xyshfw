Integrated Patch Bundle (One-shot) - Campus Life Assistant

Overview
- This patch bundle consolidates all optimizations and feature stabilizations described in our plan into a single, cohesive update you can apply locally. It is designed for a clean, end-to-end patch that enables one-click local startup, smoke tests, and a ready path toward a GitHub PR.

Scope (high level)
- Frontend: branding unification, Remember Me UI/state, consistent header/navigation visibility based on login state.
- AI MVP: wiring frontend to AI routes, persistent logs/state (ai_state.json, ai_decisions.log).
- WeChat sharing: Web Share API with QR fallback, invite scaffolding.
- RBAC/tenant scaffolding and migration observability stubs.
- Local startup: run-local-all.ps1 and run-local.bat with optional Admin auto-login and smoke-test hooks.
- CI skeleton: initial GitHub Actions workflow scaffold.
- Test skeletons: a set of smoke tests and integration tests for AI, admin invites, and permissions.

Patch plan (grouped by file area)
- web_app/index.html and related UI text: branding constants, login state reveals, header/navigation visibility.
- scripts/run-local-all.ps1 and scripts/run-local.bat: integration-friendly entry points and optional Admin auto-login mode.
- frontend/auth.js (or equivalent): remember-me persistence across sessions.
- ai-assistant/index.js and /api/ai/*: AI MVP endpoints wired end-to-end and logs persisted.
- api/friend/invite: endpoint scaffolding for invites.
- share.js: WeChat share logic with Web Share API fallback.
- RBAC middleware and tenant scaffolding: access control shape.
- .github/workflows/ci.yml: initial CI scaffold.
- test/ smoke tests: ai_permissions.test.js, ai_integration.test.js, admin_permissions.test.js, admin_e2e.test.js, admin_invite.test.js.

How to apply (recommended flow)
- Option A: Integrated Patch Bundle (one-shot)
  1) Create or switch to the target branch (default campus-life-assistant).
  2) Apply all patches in a single pass using a single patch bundle or by applying grouped patches file-by-file.
  3) Run local startup and smoke tests as outlined in the repository docs.
  4) If any patch touches binary or non-text assets, review diffs and resolve conflicts.
- Option B: Chunked Patches (safer for review)
  - Apply patches in logical blocks as they are prepared, verify each block, then proceed.

Next steps after applying
- Run the local startup script: run-local-all.ps1 or run-local.bat with AdminLogin if needed.
- Execute the smoke-test checklist and capture logs for verification.
- If everything passes, prepare a GitHub PR with a single, cohesive summary explaining why this integration patch bundle is beneficial and how to validate locally.

Notes
- This document itself is part of the patch bundle scaffolding to help you organize the changes before applying them to code.
- I can generate concrete patch blocks for each file group if you want me to proceed with applying code changes directly in subsequent steps.
