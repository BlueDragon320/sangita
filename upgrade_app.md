# Android app upgrade plan

## Goal and scope

Bring Sangita Android up to date with the web application's catalog, playlist, discovery, and playback synchronization changes while preserving offline listening and existing user data. This is a plan, not an implementation. The reference is web/server commit `e6e66bf` (including sync commit `bad1a60`) and the adjacent `sangita-android-app` checkout at commit `84871fa`, including its current uncommitted changes. Those Android changes include playback-sync work; preserve and evaluate them rather than replacing them.

The Android project is a separate repository. This plan is based on source inspection, not a live comparison or a test run. Recheck both repositories and server behavior before implementation. Web admin features are not automatically required in the Android listener app; keep administration on the web unless explicitly requested.

## What changed and why Android needs work

| Area | Current web/server behavior | Android baseline and consequence |
| --- | --- | --- |
| Library identity | V2 distinguishes personal playlists, public playlists, classified folder playlists, artists, and sources. Personal playlists have IDs, owner, visibility, description, and ordered tracks. | `Playlist`, `PlaylistEntity`, membership, and navigation use playlist name as identity. Two playlists with the same title cannot safely coexist, and renames can break references. |
| Discovery | Web has Discover and artist detail; `/api/v2/artists` and `/api/v2/playlists` expose accessible artists and playlists. | `SangitaApiService` uses legacy playlist endpoints and has no V2 catalog or artist endpoints. Artist-classified folders are omitted from legacy `/api/playlists`, so their music may disappear from the Android library after classification. |
| Playlist actions | V2 supports creating, editing, deleting, adding/removing tracks, reordering, visibility, and cloning accessible playlists. | Android currently creates and edits by name through legacy calls and queues those actions offline. It cannot reliably represent ownership, visibility, V2 IDs, or another user's public playlist. |
| Availability and access | Playlist detail returns ordered track entries and `is_available`; unavailable tracks can be retained for owners, while other viewers receive only permitted tracks and an `unavailable_count`. | Local reconciliation and downloads must not silently delete retained memberships, expose stale restricted metadata, or attempt to play unavailable tracks. |
| Playback between devices | Recent web/sync changes propagate track identity and progress and support transfer/remote control. | Android has `DeviceSyncManager` and local uncommitted playback reporting changes. Verify interoperability and finish any gaps with the actual protocol rather than assuming the feature is absent. |
| Offline | Android already has Room, downloaded audio, a queued sync worker, favorites, and library reconciliation. | A new identity model and new server responses must not erase downloads, favorites, pending actions, or local playback state during migration or failed refreshes. |

## Phase 0 — establish a safe baseline

1. Record the exact Android working tree and review its uncommitted sync/navigation changes with their author or in the implementation review. Do not reset, overwrite, or assume those changes are released. Capture the current app version, Room schema, and supported Android versions from the project.
2. Run existing Android unit tests and a debug build; record failures separately from new work. With a disposable server and accounts, capture current Home, Library, playlist, Downloads, player, lyrics, and device-transfer behavior. Include online and airplane mode.
3. Prepare sample data: same-named personal/folder/public playlists; empty playlists; artists with multiple sources; root tracks; public and private playlists owned by two users; restricted and missing tracks; local downloads; and unsent offline edits. Back up the server database and a test device database before migration tests.
4. Agree on minimum supported backend versions and rollout ownership. Deploy server and web together as documented in `README.md`; do not assume every installation upgrades at once. Verify actual endpoints using backend tests and real responses, including errors, before freezing client DTOs.

**Exit:** baseline and version matrix recorded; representative fixture and rollback backups available.

## Phase 1 — API contracts and compatibility

- Add typed Retrofit DTOs and endpoints in `data/remote/api/SangitaApiService.kt` and `data/remote/dto/` for:
  - `GET /api/v2/catalog/sources`, `GET /api/v2/artists`, and `GET /api/v2/artists/{id}`.
  - `GET/POST /api/v2/playlists`, `GET/PUT/DELETE /api/v2/playlists/{id}`, `POST /api/v2/playlists/{id}/clone`, and `POST/DELETE /api/v2/playlists/{id}/tracks`.
  - Continue using existing favorites, metadata, streaming, covers, lyrics, and stats APIs. Favorites remain a special collection, not an assumed V2 playlist.
- Model actual response shapes: list endpoints wrap arrays in `sources`, `artists`, and `playlists`; detail tracks use `track_path`, `position`, and `is_available`, while artist tracks use `path`. Playlist list fields include `id`, `title`, `owner`, `visibility`, `is_folder_playlist`, and `track_count`; detail adds tracks and `unavailable_count`. Handle optional fields and unknown additive fields without inventing API guarantees. Preserve Unicode and correctly encode paths and opaque IDs.
- Detect V2 support with an authenticated request and distinguish a genuinely unsupported endpoint from authentication, network, and server errors. Only use legacy mode when support is confirmed absent; never treat a failed V2 refresh as an empty library. State clearly which discovery and editing features are unavailable on older servers. Test against both server versions. Confirm whether a feature/capability endpoint should be added server-side rather than relying on ambiguous 404s.
- The legacy API is keyed by title, skips artist-classified folders, and can collapse name collisions. Treat it as a compatibility view, not a source of authoritative V2 identity. Before enabling V2 writes, resolve backend legacy mirroring for same-title playlists and rename/delete collisions: the current V2 create mirrors by owner/title, and rename/delete also modify legacy rows by title. Add server tests and either enforce unique personal titles during the compatibility window or fix the adapter; do not silently merge or delete data. Test simultaneous old and new clients.
- Classify 401, 403, 404, 409, validation, and transient failures separately. Refresh access-controlled content when permissions change; keep the server as the authorization authority. Avoid exposing tokens in logs or user-facing URLs.

**Exit:** contract tests cover observed request/response shapes and mixed-version behavior; collision policy has a tested server-side resolution.

## Phase 2 — durable identity and data migration

1. Replace name-based identity throughout `domain/model/Playlist.kt`, `PlaylistEntity`, `PlaylistTrackCrossRef`, DAOs, repository interfaces, `PlaylistViewModel`, and navigation. Use an opaque local key plus a nullable server ID and explicit kind (personal, public, folder, favorites, legacy/local pending). Store display title separately, alongside owner, visibility, description and sync state. Scope data to server and account so equal IDs/names on different accounts cannot mix. Keep track paths as track identity where the existing API requires them; do not assume the server offers stable track IDs.
2. Create a versioned, non-destructive Room migration from the current version 2. Rebuild keys and membership references transactionally; preserve ordering, favorites, track records, download locations, cached lyrics, playback events and sync queue. Export Room schemas and write migration tests from real v1/v2 fixtures. Do not use destructive fallback.
3. Map existing local name-keyed records to V2 IDs only when identity is unambiguous for the current server/account. Keep ambiguous or offline records in a distinct legacy/pending state and reconcile after a successful authenticated fetch; never merge solely on title. Preserve downloads keyed by track path and retain a recoverable mapping to existing files. Avoid deleting local data when a request fails or only partial catalog data is available.
4. Migrate queued actions with their original ordering and payload versions. Resolve legacy names to IDs only when unambiguous; quarantine unresolved entries for user-visible recovery, not silent discard or replay against the wrong playlist. For an offline-created playlist, retain a temporary local ID and map dependent actions to the server ID after creation succeeds.
5. Define account/server switching and logout behavior for cached metadata and downloads. Revalidate access before exposing synced metadata after an account change; decide and document the expected offline policy for already downloaded audio.

**Exit:** upgrading a populated installation retains its library, pending actions, and downloads; duplicate names and offline-first migration are covered by tests.

## Phase 3 — repository and offline synchronization

- Update `MusicRepositoryImpl`, `LibraryReconciliation`, `SyncRepositoryImpl`, `SyncSerialization`, and `SangitaSyncWorker` to use IDs for V2 collections and ordered memberships. Keep independent fetch outcomes: do not apply deletions for a failed or incomplete source. Reconcile in a transaction while preserving pending local edits and per-track download state.
- Introduce versioned queue payloads for create, update, delete, add/remove, reorder and clone as supported. Serialize operations per playlist, retain dependencies on local IDs, and expose pending, failed, retry and conflict states. Apply optimistic edits only with enough information to recover or undo on permanent failure.
- A timed-out create/clone may already have succeeded. The present API does not expose an idempotency key; add a server-supported request key and persistence before automatically retrying these operations, or keep the outcome unresolved and reconcile explicitly. For add, distinguish duplicate `409` from real conflicts and confirm desired membership before marking success; remove can be retried only after verifying server semantics. Do not replay an old toggle favorite as if it were an idempotent set; retain existing `/api/favorites/set` behavior for new changes.
- Define conflict handling for concurrent rename, visibility, deletion, reordering, revoked permissions and missing tracks. The present update endpoint has no revision/precondition contract: add version checking server-side or detect and surface conflicts; do not promise automatic lossless merges. Preserve the user's unsent intent and explain actionable failures.
- Owner/admin views may receive unavailable entries; preserve order and display a disabled row. Other viewers get only permitted tracks and aggregate unavailable count. Never reconstruct or display restricted metadata from another account's cache; skip unavailable tracks for playback, download, and clone. Revalidate access after reconnect.

**Exit:** airplane-mode edits, retries, process death, partial failures, account changes and two-device conflicts do not lose or misdirect changes.

## Phase 4 — Android experience

1. **Library and navigation:** keep Favorites and the user's own playlists prominent. Add a clear Discover destination, using existing Compose navigation and bottom bar. Pass encoded opaque IDs in routes; titles are labels only. Keep Downloads accessible and the mini-player and playback uninterrupted across screens.
2. **Discover:** show accessible artists, folder playlists, and other users' public playlists in clearly labeled sections with search, loading, empty, error, offline/cached and retry states. Respect `has_access` and server-filtered results; do not expose restricted source details. Add artist detail with artwork, accessible tracks, play and add-to-playlist actions. Consider pagination only if measurements or API support justify it.
3. **Playlist details:** show cover, title, owner, visibility, description, count, ordered tracks, and unavailable information. Play/shuffle only playable tracks. Use clear touch actions to add/remove, edit title/description/visibility, reorder, delete with confirmation, and copy/clone when permitted. Show edit actions only for owner/admin where the API permits; folder playlists are not user-editable. Re-fetch after mutations to reflect server state. Check clone response and partial-access behavior rather than promising every source track was copied.
4. **Creation and add-to-playlist:** support name, description and public/private selection, validation, a clear public visibility explanation, pending state, and recoverable errors. Show only writable targets. Preserve queue intent offline and handle duplicate names according to the resolved server policy.
5. **Visual polish:** adapt the web's improved hierarchy, playlist controls and discover presentation to native Compose and small screens, retaining existing AMOLED/dark/light themes, Android navigation, accessibility labels, readable contrast, large touch targets and system font scaling. Do not copy desktop layout literally. Test long names, missing artwork and landscape/tablet layouts.
6. **Existing experiences:** verify favorites, Home statistics, lyrics, downloads, background playback, notification controls and device selection remain functional. Admin library classification remains a web workflow; explain in release notes that classification affects what appears in Discover.

**Exit:** a user can find accessible artist music, create/manage a personal playlist, discover and copy an accessible public playlist, and continue listening offline without losing context.

## Phase 5 — playback and cross-device compatibility

- Compare `sync-server/server.js`, web `useDeviceSync.js`/`App.jsx`, and Android `DeviceSyncManager`, `PlaybackController`, and the uncommitted `PlaybackSyncObserver` and `PlaybackPositionReport` before changing the protocol. Document events, fields, units (milliseconds), active-device ownership, and behavior for missing track data and stale updates.
- Verify web-to-Android and Android-to-web transfer for paused and playing states, current track identity, position, seek, next/previous, reconnect, and background/notification controls. Check that a remote controller does not start duplicate local audio or overwrite a newer active track with stale position. Preserve handling for older peers and existing server authentication.
- A V2 playlist ID is context, not the audio identity: keep actual track path usable by streaming and the existing protocol. If adding fields, make them optional and verify old peers ignore them. Test transfer from discovered artists and public playlists even when the receiving device has not cached that collection.

**Exit:** mixed web/Android clients agree on active device, track, play state and progress within an agreed tolerance, including reconnect and background playback.

## Verification and release

- **Automated:** Android unit tests for DTO decoding, permissions, ID collisions, reconciliation, queue ordering/retries, favorites and unavailable tracks; Room migration tests against v1/v2 databases; UI tests for discovery, editing and accessibility; backend contract/integration tests for V2, restricted access, legacy coexistence and idempotency/conflicts; existing sync-server and web tests plus cross-client protocol tests. Run the Android debug build and relevant existing regression suites.
- **Device checks:** supported minimum and current Android versions, small phone and tablet, all themes, large text/TalkBack, slow/offline networks, process restart, background playback, downloads, and a realistically large library. Exercise existing installations with populated downloads and queued changes, not only clean installs.
- **Acceptance matrix:** current and older Android against upgraded server; upgraded Android against current and older server; two accounts with different source permissions; two devices editing or transferring playback; online/offline transitions. Confirm restricted tracks cannot be played or leaked via discovery, cache or clone and that temporary network errors never clear the library.
- **Release order:** resolve and test server compatibility/idempotency gaps, deploy and back up the server, ship Android with migration and legacy fallback, monitor sync failures and user reports, then consider retiring legacy API only after all clients have migrated. Release notes should describe Discover, visibility, any minimum server version and migration behavior.
- **Rollback:** back up server DB and test-device app data first. Reverting the app binary after a Room schema upgrade may not be supported; test an explicit downgrade/export recovery path and preserve a pre-upgrade backup. Server rollback must be tested against the upgraded database and queued client writes; do not claim code rollback alone restores data. Keep older API routes until rollback and adoption criteria are met.

## Decisions and dependencies before implementation

- Is old-server support required, and for how long? If not, specify a minimum version and a clear upgrade message.
- Should same-title personal playlists be prohibited during legacy coexistence, or should server legacy mirroring be redesigned? Resolve before exposing V2 create/rename/delete.
- Which offline operations must be supported on day one, and should existing downloads remain playable after access is revoked? Agree on privacy and user expectations.
- What conflict and retry guarantees should the server provide for create, clone, and reorder? Add idempotency and revision support if automatic retries and concurrent edits are required.
- Is Android admin functionality desired? It is outside this plan unless explicitly prioritized.
