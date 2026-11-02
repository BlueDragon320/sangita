# Skills and implementation capabilities

Use available environment skills only when applicable; inspect their current instructions rather than assuming installation. If the user asks for a specific skill, follow it. For a website creation task, use the available Sites skill if its workflow fits the repository; for existing repository implementation respect its local architecture and instructions. Use spreadsheet/document skills only for actual spreadsheet/document deliverables. Do not fabricate a skill or block coding just because an optional skill is unavailable.

## Required capabilities
- Android: Kotlin, Jetpack Compose, Media3/ExoPlayer, Hilt, Ktor, Room migrations, DataStore, Android Keystore, background work and lifecycle handling. Examine upstream `AGENT.md` and build configuration.
- Web: TypeScript, React, accessibility, responsive layouts, HTML media and provider SDKs; test autoplay restrictions, accessibility and browser compatibility.
- API: authenticated HTTP, OpenAPI, schema validation, session security, role-based authorization, auditing, rate limiting, async workers and idempotency.
- Data: PostgreSQL migrations, transactional writes, aggregation, timezone-aware analytics, retention, export/delete and query performance.
- Operations: Docker Compose, TLS, environment configuration, health checks, least-privilege secrets, backup and restore.
- Verification: unit/integration, Android regression, browser end-to-end, permission/consent, provider feasibility, security, migration and failure/recovery testing.
- Licensing: inventory upstream credits and licenses, GPLv3 source distribution obligations, third-party notice requirements, and independent media rights. Seek qualified advice for ambiguous combinations and deployment law.

## Research and evidence
Consult official documentation for selected versions, provider terms, browser media behavior and current security recommendations as needed. Record links, access date, applicable constraints and proof-of-concept results in `docs/`. Do not bypass provider restrictions or imply availability without rights. Report unverified assumptions and blocked checks explicitly.


## Required workflow for recovery
Inspect the existing app and actual Android screen implementations before design or coding; verify the advertised behavior by running the app. For web implementation use the applicable Sites skill and its instructions when available. Use browser automation or equivalent to exercise navigation, real playback where rights permit, interaction and responsive layouts; collect screenshots and inspect them. Use real integration and regression tests for persistence, auth, player, consent and failure cases; do not rely on static inspection or mocks as proof of real integration. Consult official provider documentation and rights terms for each integration, and document evidence and limits. Avoid adding test infrastructure that merely mirrors implementation; prioritize end-to-end behavior and regressions.
