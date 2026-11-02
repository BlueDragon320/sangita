# Recovery plan and evidence-based status

Previous file marked phases 0–7 complete. Those statements are **not verified** and are superseded here. Source inspection found sample tracks and playlists in `web/src/stores/sampleTracks.ts` and `web/src/views/HomeView.tsx`; `server/src/routes/v1/catalog.ts` contains curated metadata and `yt-dlp` search-based resolution; `docs/toolchain_and_build_investigation.md` reports Android toolchain/build blockers. The project has web, server, Android and infrastructure code, but the existence of code does not prove a working feature. Audit actual current behavior before making further claims. Do not discard user data or working functionality.

## 0. Establish the real baseline
- [ ] Read root and Android instructions, actual app sources and existing docs. Run the available local stack and document exact setup, commands, results and limitations. Inspect main web flows and desktop/mobile screenshots, comparing with Android screenshots and source. Record failures and misleading controls with reproduction steps.
- [ ] Create a detailed source-backed Android-to-web feature ledger, including every screen, interaction, setting, playback mode, provider, library function, lyrics, search, queue, discovery, statistics, account and device feature. For each: source links, expected behavior, actual web behavior, dependency, status, verification and remaining work. Review existing matrix for unsupported 100% claims. List device-only constraints honestly.
- [ ] Verify actual Android build and device availability. Do not treat investigation notes as successful build or real-device verification.
- [ ] Review catalog/audio and source permissions, exact metadata, fallback audio and third-party notices. Separate genuine playable catalog from test fixtures. Identify a rights-cleared source and get operator input only if needed.
**Exit:** prioritized, evidence-backed ledger and reproducible bug list; no unsupported claims.

## 1. Restore real end-to-end core
- [ ] Fix environment, auth, navigation, API integration and startup errors based on observed failures; retain data. Replace fake samples and fallback audio in normal mode with verified sources or honest empty/error states. Catalog playback must resolve the actual selected track, with rights and source known.
- [ ] Deliver search → track → actual playback → pause/seek/next → queue → like → reload persistence, with real backend and appropriate consent. Test failure states and browser autoplay policy.
**Exit:** browser journey and audio verified against rights-cleared fixture/source, persistence validated; unavailability clearly reported.

## 2. Rebuild web experience to Android standard
- [ ] Study Android screens and design system; implement cohesive responsive navigation, home/discovery, search, library, detailed player, queue and lyrics using real data. Provide desktop and mobile layouts, content-rich states, accessibility and polished loading/errors. Ensure every visible action works or is honestly disabled with reason.
- [ ] Capture desktop and mobile screenshots of running web and compare with Android references. Verify real click paths, long titles, empty states, keyboard, focus, contrast and playback. Fix observed visual defects.
**Exit:** documented visual comparisons and verified user journeys; no decorative fake functionality.

## 3. Feature-by-feature parity
- [ ] Implement and test every feasible Android capability listed in the ledger, including library, playlists and ordering, album/artist pages, favorites, queues, history, discovery, lyrics, playback settings and enhancements. Include all other features discovered in actual Android source, not just this list. Preserve Android functionality and stored user data.
- [ ] Implement meaningful browser equivalents where feasible; identify browser, permission, device and provider limitations separately and give honest explanations and alternatives. Do not declare a feature done for an icon, placeholder or mock.
**Exit:** each ledger row has end-to-end evidence or a specific justified blocker; no unverified 100% parity claim.

## 4. Authentication, sync and analytics
- [ ] Verify registration/invite/admin policy with user where not already authorized; test account lifecycle, isolation, admin authorization and security. Consent must precede tracking, clearly disclose admin access, and withdrawal must stop collection.
- [ ] Validate Android ↔ web handoff with actual devices, stable track IDs, seek/paused state, conflict and offline handling. Track unavailable content honestly. Test event duration, deduplication, likes, timezone and admin dashboards using known sessions and database-backed results.
**Exit:** actual cross-device journey and analytics reconciliation recorded, or explicitly blocked with evidence and independent work completed.

## 5. Regression, release and truthful reporting
- [ ] Run appropriate web/server/Android checks, browser tests and accessibility checks, plus real-device smoke tests where available; show commands and results. Verify migrations, restart, backups/restoration, deletion and consent. Record what each test proves and what remains untested.
- [ ] Verify GPL obligations, credits, third-party licenses and media rights; document corresponding-source distribution when applicable. Reassess release readiness based on evidence. Do not deploy or publish without explicit instruction.
**Exit:** parity ledger, documentation and status match observed behavior; no unverified completion or release claims.
