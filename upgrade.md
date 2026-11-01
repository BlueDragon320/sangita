# Sangita stability and long-term maintenance plan

Updated: 2026-11-01. This is a work plan and verification record, not a claim that Sangita is flawless or ready for unattended operation. It covers the web app, backend, sync server, Android app, and optional local lyrics service. The earlier playlist-controls plan is retained below for context; verify its current status before using it.

## Current baseline

- Web/server repository: `24ceab2` at the start of this review. Android is a separate repository at `/home/blue/projects/sangita-android-app`, baseline `59e78eb`; both working trees were clean at the start.
- Web: 289 automated tests pass and the production build succeeds. Sync server: 3 tests pass with local networking enabled. These are useful regression checks, not an end-to-end release certification.
- Android uses Room migrations through version 5 and has offline queue, playback, and migration tests. The debug build and unit tests pass on an isolated copy using the local SDK and dependency cache. Physical-device, populated-install upgrade, and release-build testing remain necessary.
- Backend: all 98 tests pass with isolated data and music directories. The admin-library tests now provide their own music fixture so they do not depend on a real library. The optional local lyrics service: 10 tests pass. Review resource warnings separately.
- Docker is unavailable in this review environment. Container startup, deployment, backups and recovery have not been verified here. The Android app has not been installed or published as part of this review.
- The existing Compose configuration installs sync-server dependencies on every startup, and some Python dependencies use open-ended version ranges. Both make long-term reproducibility dependent on external package availability and future releases. Android currently permits cleartext traffic; support for local HTTP must be weighed against protecting credentials in transit.

## Definition of a maintainable release

A release is ready only when existing users can upgrade without losing their library, accounts, downloads, favorites, playlists or queued offline edits; primary playback works online and offline as applicable; errors are actionable; backups have been restored successfully; and the checks below pass on representative devices. No finite test suite can guarantee zero defects or six months of unattended operation.

## Priority 0 — protect existing data and regain service

1. Document the actual deployment, installed versions, persistent volumes, secrets, account recovery, startup and shutdown, logs, and expected disk requirements. Do not include secret values in the repository.
2. Create and test a consistent backup and restore procedure for the music library, `data/` (including SQLite, users and signing key), Redis data if it is needed for recovery, configuration and any custom models. Account for SQLite WAL and verify restored permissions and login. Test restore to a separate disposable installation; record recovery time and rollback limitations.
3. Test upgrading existing server data and Android Room databases with representative populated fixtures. Preserve Android downloads, queue ordering, favorites and account isolation; never use destructive migration as a recovery shortcut. Test downgrade limitations explicitly and retain the pre-upgrade backup.
4. Make startup repeatable without fetching packages at container restart: build the sync service with its lockfile into an image, use lockfile-based installation for frontend builds, and pin or constrain Python dependencies after compatibility and security checks. Rebuild and restart with network access unavailable, and verify a clean install separately. Pin base images to tested versions or digests and document the process for security updates.

## Priority 1 — make core listening reliable

- Exercise login, initial library scan, search, playlist creation and editing, favorites, streaming, seeking, queue, repeat/shuffle, lyrics, downloads, background playback and notification controls on the web and Android. Include empty, large, Unicode, missing-file and restricted libraries.
- Exercise web-to-Android and Android-to-web playback transfer, remote control, paused/playing handoff, seeking, reconnect, device sleep and simultaneous controllers. Record expected track identity, position units and active-device ownership; add regression tests for reproduced failures.
- Test offline startup, reconnect, process death, interrupted download, full disk, expired login and server outage. Preserve cached state and pending actions on partial failures; distinguish offline, authentication and permission errors. Avoid blindly retrying non-idempotent mutations.
- Review reported unclosed file, SQLite and subprocess warnings to distinguish test cleanup from application leaks. Fix confirmed leaks and verify repeated requests/jobs do not increase resource use without bound.
- Make the backend test suite independent of a developer's music and data. Run all suites in isolation and add focused tests for discovered defects rather than relying on live user data.

## Priority 2 — security and safe exposure

- Require strong credentials and a stable secret, and document secret rotation and recovery. Review authorization for playback, downloads, artwork, catalog, playlists, sync events and the optional GPU service with two users and different access rights.
- Use HTTPS for access over untrusted networks. Assess Android's cleartext policy and local-network use before changing it; provide a secure default and an explicit, understandable path for trusted local HTTP if retained. Check that tokens and sensitive metadata are not leaked through logs or URLs.
- Review dependency security and supported runtimes, container permissions, upload limits, rate limiting, origin policy and network exposure. Test changes for compatibility rather than applying automated breaking upgrades blindly.

## Priority 3 — usable, efficient and observable operation

- Review loading, empty, offline, retry and failure states; use clear labels, confirmations for destructive actions and accessible touch targets. Check small screens, landscape, font scaling, keyboard and screen-reader navigation, and all themes.
- Measure startup, library scans, search, memory, CPU, battery, bandwidth and playback with a realistic large library before optimizing. Set practical budgets from measurements and repeat the same checks after changes.
- Add service health checks and concise, actionable logs without credentials or song data beyond what is necessary. Document how to recognize failed backups, unhealthy services, low storage and stalled lyrics jobs. A health check must not be mistaken for end-to-end playback verification.
- Keep the optional GPU service and AI dependencies optional; verify that failures and unavailable models leave ordinary listening functional and are visible to the user.

## Release verification and handover

1. Run web tests and production build, all backend tests with temporary `DATA_DIR` and `MUSIC_DIR`, sync tests with localhost access, and local lyrics service tests. Run Android `testDebugUnitTest` and `assembleDebug`; cover Room migrations using old populated schemas and test the intended release build/signing separately.
2. Start a clean Docker installation and upgrade a copy of an existing one. Test a restore into a separate environment, server restart without internet, proxy/WebSocket behavior, and client compatibility across the intended rollout. Docker and real-device checks cannot be inferred from unit tests.
3. On supported Android versions and representative devices, verify first install and upgrade, background playback, reconnect, offline downloads, process restart and accessibility. Exercise web browsers and at least two signed-in users/devices against the same server.
4. Document exact versions, known issues, backup and restore commands, upgrade and rollback sequence, trusted network assumptions, and what needs periodic attention. Preserve signing keys and recovery instructions securely outside this repository. Do not publish, install over a user's app, delete data, or change production configuration until the resulting release and recovery plan have been reviewed.

## Status & Verification Record

- [x] **Container Reproducibility & Dependency Pinning (Priority 0, Item 4)**:
  - Created `sync-server/Dockerfile` using `node:20-alpine` with `npm ci --omit=dev` and `sync-server/.dockerignore`.
  - Updated `docker-compose.yml` to build `sync-server` from context, removing runtime `npm install && npm start` container startup fetching.
  - Updated root `Dockerfile` to use `npm ci` for lockfile-based frontend builds.
  - Pinned/constrained dependencies in `backend/requirements.txt` (`faster-whisper==1.0.3`, `psutil==5.9.8`, `requests==2.31.0`) and `Local_PC_Lyrics_API/requirements.txt`.
- [x] **Atomic Backup and Restore Procedure (Priority 0, Item 2)**:
  - Created `scripts/backup.sh` with atomic SQLite WAL snapshotting (`VACUUM INTO`), manifest and sha256 checksum generation, and permission preservation (0600 on `.secret_key`).
  - Created `scripts/restore.sh` with integrity verification (`PRAGMA integrity_check;`, sha256 verification), dry-run mode, and automated permission restoration.
  - Created `scripts/test_backup_restore.sh` end-to-end verification test suite: 100% passed.
- [x] **Deployment, Operations & Recovery Documentation (Priority 0, Item 1 & Priority 2)**:
  - Created `docs/deployment_and_recovery.md` detailing architecture topology, persistent volumes, secrets management & rotation, account recovery, and backup/restore.
- [x] **Backend Test Suite Isolation & Connection Leaks (Priority 1, Item 4 & Baseline)**:
  - Fixed `backend/test_audit_fixes.py` range request accounting by isolating test user records and filtering explicitly by `date = ?`.
  - Wrapped SQLite connection lifecycles in `try ... finally: conn.close()` across `test_favorites_set.py`, `test_v2_apis.py`, `test_audit_fixes.py`, and `app.py`.
  - Verification: `PYTHONPATH=. /usr/bin/python3 -m pytest backend/ -W default` -> **98 passed, 0 warnings in 9.71s**.
  - Local PC Lyrics API: `PYTHONPATH=. /usr/bin/python3 -m pytest Local_PC_Lyrics_API/test_server.py -W default` -> **10 passed, 0 warnings in 2.57s**.
- [x] **Android Security & Policy (Priority 2, Item 2)**:
  - Updated `app/src/main/res/xml/network_security_config.xml` to `base-config cleartextTrafficPermitted="false"`, strictly scoping cleartext to loopback (`127.0.0.1`, `localhost`), emulator host (`10.0.2.2`), and private LAN domains (`.local`, `.lan`, `.home.arpa`).
  - Removed `android:usesCleartextTraffic="true"` from `app/src/main/AndroidManifest.xml`.
  - Added Room schema `Migration4To5Test.kt` verifying non-destructive offline queue migration.
  - Verified `./gradlew testDebugUnitTest` and `assembleDebug`: **294/294 tests passed, 0 failures**.
- [x] **Android Playlist Controls Plan**:
  - Verified single pencil in toolbar, removed duplicate buttons beside Play/Shuffle, preserved Move up/down per track, and tested deletion confirmation inside the pencil edit dialog.

---

# Android playlist controls: implementation plan

## Goal

Simplify the playlist screen. Remove the separate Edit Order, Edit Playlist and Delete Playlist buttons from the top of the playlist and remove Edit Order from the row beside Play and Shuffle. Keep one pencil button at the top for playlist management. When the user opens it, show the existing edit options and add Delete Playlist there.

This document is a plan only. No application changes, installation or deployment are part of writing it.

## Current behavior and interpretation

The Android project is `/home/blue/projects/sangita-android-app`. In `app/src/main/java/com/sangita/app/ui/screens/playlist/PlaylistDetailScreen.kt`, eligible users currently see three separate toolbar icons: Edit Order, Edit Playlist (the pencil) and Delete Playlist. A second set of edit-order, edit and delete controls also appears in the playlist action row after Play and Shuffle. The pencil currently opens `EditPlaylistDialog`, which already contains playlist editing fields; it is not currently a menu.

Interpret the request as retaining **one pencil icon** in the toolbar and removing the other standalone editing controls, including the duplicate pencil and trash icon next to the playback buttons. Add Delete Playlist to the existing pencil-opened editing dialog alongside its existing fields and actions. Keep Play, Shuffle and Download Playlist available, and leave non-owner save and copy controls as they are. Keep the existing song options sheet and playback behavior.

The request explicitly removes Edit Order controls. Remove the dedicated reorder-mode UI and its state. Existing per-song **Move up** and **Move down** actions are separate song options, so retain them unless the user later asks to remove reordering entirely. This preserves a way to change order without adding a replacement Edit Order button.

## Implementation steps

1. **Record the starting point.** Check both repositories' working trees and preserve the user's existing uncommitted work. Inspect `PlaylistDetailScreen.kt`, `PlaylistViewModel.kt`, `ui/dialogs/EditPlaylistDialog.kt`, and the song-options sheet before editing. Verify the current owner/admin and non-owner screens on a phone or representative preview.
2. **Simplify the top toolbar.** In `PlaylistDetailScreen.kt`, remove the standalone reorder and delete icons from the owner/admin toolbar. Retain one 48 dp pencil icon with an accessible label such as “Edit playlist”, opening the existing edit dialog. Do not show a second pencil elsewhere. Keep the non-owner save/remove and copy controls, and keep Back.
3. **Simplify the row below the artwork.** For an editable playlist, remove the Edit Order pill and the adjacent edit and delete icons, along with their unused spacers. Keep Play and Shuffle in their existing order and keep Download Playlist accessible. Preserve non-owner controls and verify that the row fits on narrow screens and with larger text.
4. **Add deletion to the pencil dialog.** Extend `EditPlaylistDialog` with an optional delete callback. Place a clearly labeled, visually separated “Delete playlist” action after the existing edit fields, using the existing error color and appropriate spacing. Keep the existing title, description and visibility fields, Save and Cancel behavior. Do not trigger deletion when the pencil is opened or when the delete action is first tapped.
5. **Keep confirmation and result handling.** On “Delete playlist” in the edit dialog, close or dismiss that dialog before presenting the existing delete confirmation, so two modal windows do not overlap. Cancel/back returns without deleting. Confirm continues to call `PlaylistViewModel.deletePlaylist`; navigate back only on success and surface existing failure messages on failure. Reuse the current confirmation wording and behavior unless a tested change is needed. Avoid duplicate requests while a deletion is in progress.
6. **Remove the separate reorder mode.** Remove `isReorderMode`, the duplicated mode controls and the special reorder-only row layout and indicators. Render the normal song rows for everyone. Preserve the owner/admin song menu's Move up and Move down actions, boundary checks and existing `reorderTracks` call; preserve all other song actions and their bottom-sheet presentation. Ensure track order and unavailable-track behavior remain unchanged.
7. **Preserve permissions.** The current `PlaylistViewModel.computeIsOwner` treats administrators as eligible and has special behavior for Favorites and folder playlists. Do not infer new permissions from the label `isOwner`: verify actual server-supported operations for owned, shared, folder and Favorites playlists. Show Delete Playlist only where deletion is supported; protect Favorites and folder playlists from an invalid delete action while keeping their supported actions. Preserve server-side authorization and show failures honestly. Do not change who can edit, delete or reorder as part of this visual cleanup.
8. **Clean up and verify.** Remove imports and state made unused by the old buttons. Check the dialog closes correctly on Back, outside dismissal and configuration changes. Keep TalkBack labels, 48 dp targets and visible disabled/loading states. Confirm the song menu, playback, downloads and playlist editing continue working in all three themes.

## Verification

- Add focused Android tests for the new pencil → edit dialog → delete confirmation flow: Cancel does not delete; Confirm calls delete once; success returns to the previous screen; failure remains visible. Cover allowed and disallowed playlist types and non-owner access.
- Verify there is one pencil in the editable playlist toolbar, no separate delete or reorder icon there, and no Edit Order/Edit/Delete controls beside Play and Shuffle. Verify the non-owner save/copy controls remain.
- Verify Move up/down in each song's options still changes and persists order, including first/last track boundaries. Check the sheet remains usable after removing reorder mode.
- Exercise owned, another user's accessible, admin-accessible, Favorites and folder playlists; use disposable data for delete tests. Verify playlist deletion does not imply deletion of downloaded audio or affect other playlists without an explicitly supported existing behavior.
- Run `./gradlew testDebugUnitTest assembleDebug`, plus focused UI tests where available. On a real phone, check portrait and landscape, narrow screens, large font and AMOLED/dark/light themes; test pencil → edit, delete cancel, confirmed delete on a disposable playlist, Play, Shuffle and Download.
- Review the Android diff and report test results and any untested cases. Installing on a phone or publishing remains a separate action unless requested.

## Done when

The owner/admin sees a single pencil for editing and deletion; Play and Shuffle no longer share their row with Edit Order, Edit or Delete; deletion is confirmed and permission-aware; song-level reordering still works; non-owner controls and playback are unchanged; and the relevant checks pass.
