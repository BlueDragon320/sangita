# Sangita UI upgrade implementation plan

## Purpose

Improve the web player and Android app together using the ideas in [Unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), licensed under CC BY 4.0. The reference repository was cloned to `/tmp/sangita-unslop-reference` and reviewed at commit `4652254`; its examples are design references, not production code to copy. This document is a plan only. It does not change either application, deploy a server, or install an app.

Sangita is a self-hosted music player for people listening to their own libraries. Its interfaces should make it easy to find something, play it, and understand where it is playing. Preserve the existing logo, steel-blue identity, three themes, listening workflows, and the real music and artwork that make the product personal.

### Proposed direction

- **Product:** A personal, self-hosted music library that works across web and Android.
- **Character:** Focused, tactile, and quietly expressive.
- **World:** Album sleeves, track lists, and the familiar controls of a music player; use actual library content rather than a decorative illustration.
- **Moments:** Album or playlist artwork on the listening screen, and the active lyric line when lyrics are open. Listening charts can carry meaningful color in analytics.
- **Signature:** A subtle, consistent active-track and playback-progress treatment shared across platforms; it communicates state rather than serving as decoration.

Unslop recommends a screen-by-screen audit and ordered passes for spacing, color, icons, copy, type, layout, detail, visuals, and motion. Apply those ideas as guidance, not as a rigid visual template. Keep screen order and existing capabilities unless a specific change is agreed. Do not invent illustrations, metrics, or album art. Artwork, the listening graph, and user content are sufficient focal points for this app.

## Scope and current observations

The web project is `/home/blue/projects/sangita`; Android is the separate `/home/blue/projects/sangita-android-app` repository. Both contain current uncommitted work, including personal-library changes. Start from that work; do not reset, overwrite, or silently alter its behavior. `improvement_plan.md` and `upgrade_app.md` provide prior context, but this plan focuses on presentation and interaction.

These are **code-review observations**, not findings from a live visual audit. Capture real screens before deciding whether each needs a light polish or larger changes:

| Area | Evidence and what to investigate |
| --- | --- |
| Web styling | `frontend/src/index.css` contains many legacy and newer rules, large radii, gradients, shadows, theme overrides, and `!important` declarations. Some comments describe older colors and typography. Identify the rules that actually render before consolidating them. |
| Web components | `Sidebar.jsx`, `DiscoverView.jsx`, `Hero.jsx`, `Player.jsx`, and `TrackList.jsx` combine inline styling, gradients, and multiple interaction patterns. Audit what users actually see; retain useful artwork-based treatments where they improve recognition. |
| Android theme | `ui/theme/Color.kt`, `Theme.kt`, and `Type.kt` already provide AMOLED, dark, light, and steel-blue roles. Some individual screens still specify their own font sizes, shapes, color aliases, and radial backgrounds. Check contrast and consistency rather than replacing the brand palette. |
| Navigation and content | Web has a sidebar, discovery, playlist, player, right panel, lyrics and admin; Android has Home, Discover, Library, Downloads, player, lyrics and artist/playlist details. Keep native navigation and screen sizes appropriate to each platform. |
| Small text and controls | Android `PlayerScreen.kt` has some 9–10sp labels and many icon actions; web also uses compact icon controls. Check actual readability, state labels, touch targets, keyboard access and screen-reader announcements before choosing changes. |
| Library states | Current work adds a personal library for saved songs, artists and playlists. Inspect empty, loading, saved, unsaved, error and permission-limited states on both platforms. Preserve downloads and don't imply that saving an item downloads it. |

## Phase 0 — establish the baseline

1. Record both repositories' commit IDs, working-tree changes, installed Android version, and the web/API versions under review. Protect existing changes; do not install, replace, or sign out of the phone merely to capture a baseline.
2. Use a disposable or representative library and test accounts. Include long multilingual titles, missing covers, several artists and playlists, an empty personal library, favorites, saved items, restricted content, offline downloads and a remote playback device. Avoid screenshots containing passwords, tokens, or private user data.
3. Capture web at desktop (for example 1440×900), tablet and narrow mobile widths in AMOLED, dark and light. Capture Android on a phone and, if available, a larger screen in all themes. Include increased text size and landscape. Use the existing development setup rather than changing app behavior to create attractive screenshots.
4. Walk through login → Discover/search → save a song, artist and playlist → play → open playlist/artist → lyrics → device transfer → downloads/offline → return to library. Capture loading, no results, errors, permissions, and active/remote player states. Inspect the admin's overview and library management separately.
5. Compare each screen with Unslop's signs checklist. Record exact screen, element, issue and impact; distinguish inconsistent decoration from meaningful album art, status colors or intentional contrast. Mark each screen **retain**, **polish**, or **redesign**, with reasons. If a screen is already good, keep it and list only specific refinements.

**Exit:** A before-image set, short issue inventory and prioritized list exist. No broad redesign is assumed until these are reviewed.

## Phase 1 — shared visual foundation

1. **Define a small shared specification.** Document surface, text, border, accent and semantic roles for AMOLED, dark and light; spacing on a 4-unit rhythm; type sizes and weights; corner radii; icon sizes; focus/pressed/disabled states; and motion timings. Map the same intent to web CSS and Android Compose rather than forcing identical pixel values. Keep AMOLED main surfaces true black and preserve theme choices and migrations.
2. **Color and contrast.** Keep steel blue as a restrained active/primary accent where it remains legible. Use semantic warning/error/success colors only when they communicate meaning. Measure text and UI-component contrast in all themes; do not rely only on opacity. Preserve color in artwork and meaningful charts. Review gradients/glows against their purpose; keep a treatment if it aids music identity or legibility, remove it if it competes with content.
3. **Type and spacing.** Establish readable body and metadata sizes for both platforms, with scalable web text and Android `sp`. Replace tiny labels where practical; verify long titles, mixed scripts and larger system text. Set consistent row spacing, image sizes and alignment. Use tabular numbers for elapsed time, duration and statistics where supported.
4. **Components and icons.** Inventory existing SVGs and Material icons; choose coherent style and sizes within each platform. Unify button hierarchy, toggles, menus, dialogs, cards, empty states, rows and status indicators. Keep accessible names and distinct enabled/disabled/selected states. Avoid adding dependencies without a practical need.
5. **Implementation locations.** Web: consolidate tokens and currently effective overrides in `frontend/src/index.css`, `DiscoverView.css`, and `AdminDashboard.css`; move repeated one-off component styles to reusable rules where appropriate. Android: update `ui/theme/{Color,Type,Theme}.kt` and reusable `ui/components/` primitives before screen-specific fixes. Avoid a risky wholesale stylesheet rewrite.

**Exit:** A token/component sheet with example states works in all themes, and existing theme preferences and playback remain unchanged.

## Phase 2 — listening and library experience

### 2A. Playback and lyrics (highest priority)

- **Web:** Audit `Player.jsx`, `RightPanel.jsx`, `LyricsView.jsx`, and related styles. Keep playback, seek, shuffle, repeat, queue, volume, favorite/save, device transfer and lyrics controls visible and understandable. Make the active/remote device state explicit. Keep the player usable at narrow widths without overlapping dialogs or content.
- **Android:** Audit `PlayerScreen.kt`, `MiniPlayer.kt`, `LyricsOverlay.kt`, and `DeviceSyncBottomSheet.kt`. Preserve media notification, background playback and controls. Make the current track, progress, play/pause state and output device legible, including during transfer and reconnect. Review the 9–10sp labels at larger font scales and under TalkBack.
- **Lyrics:** Retain synchronized highlighting, click-to-seek and background preferences. The active line may be a visual moment; ensure contrast, stable scrolling and reduced-motion alternatives. Do not remove the existing ambient option without a separate product decision.
- **Acceptance:** A listener can play, pause, seek and identify the active device with keyboard, touch and assistive technology; changing screens or themes does not interrupt playback.

### 2B. Personal library, Discover and search

- **Web:** Review `Sidebar.jsx`, `DiscoverView.jsx`, `ArtistDetailView.jsx`, `TrackList.jsx`, `AddToPlaylistModal.jsx`, and `CreatePlaylistModal.jsx`. Make the personal library's saved songs, artists, saved playlists and own playlists distinct from the accessible catalog. Keep Discover and search useful when the library is empty. Make adding/removing items explicit, with clear success and recoverable error feedback. Preserve saved versus favorite versus downloaded distinctions.
- **Android:** Review `LibraryScreen.kt`, `DiscoverScreen.kt`, `ArtistDetailScreen.kt`, `PlaylistDetailScreen.kt` and their view models, plus `TrackItemRow.kt` and the add/edit sheets. Keep the user's saved items separate from Discover. Downloads remain stored on the phone and accessible without internet; saving an artist is a library shortcut and does not download that artist's music. Provide labeled, accessible actions to save/remove songs and artists and manage playlists.
- **Lists:** Use stable artwork sizes, consistent title/artist/metadata hierarchy and a discoverable overflow action on both touch and pointer devices. Preserve actual track order, unavailable markers and permission behavior. Avoid relying on a long press as the only route to an action. Show safe placeholders for unavailable or missing artwork without exposing restricted metadata.
- **States:** Distinguish genuinely empty library, no search matches, unavailable server, missing permission and empty playlist. Preserve queued edits and present failures without claiming success. Use retry controls where meaningful. For a new user, show a short invitation to discover music and create a playlist rather than a blank pane.
- **Acceptance:** A user can find and add/remove accessible songs, artists and playlists; create and edit a personal playlist; and understand empty, offline and failed states. UI refreshes do not change ownership, permissions, ordering or saved data.

### 2C. Home, account and administration

- **Home:** Inspect web `HomeDashboard.jsx` / `ListeningGraph.jsx` and Android `HomeScreen.kt`. Keep existing stats and history, but make listening shortcuts and the current context easy to scan. Quiet redundant containers and decorate data only when it communicates meaning. Do not drop analytics or invent data.
- **Login and settings:** Align `Login.jsx`, Android `LoginScreen.kt`, and settings/theme controls with the shared roles. Preserve private-access and authentication messages. Keep theme labels consistent, and keep errors, disabled states and password visibility controls usable.
- **Web admin:** Review `AdminDashboard.jsx` and CSS independently as a data-heavy workflow. Retain overview, music, activity, users, lyrics, system, classification and playlist access controls. Replace decorative emoji labels with consistent meaningful icons where observed; keep dense tables readable and horizontally scrollable on small screens. Preserve confirmation steps and access warnings for destructive actions.
- **Acceptance:** Existing workflows and data remain available; administrative controls are not removed or hidden by visual simplification.

## Phase 3 — accessibility, motion and performance

- **Web:** Confirm visible keyboard focus, logical tab order, semantic buttons/links, labeled icon-only actions, focus containment and restoration in dialogs, Escape handling, and screen-reader announcements for status changes. Test at 200% browser zoom, desktop keyboard and touch-sized layouts. Check reduced-motion preferences and avoid color-only state cues.
- **Android:** Check TalkBack traversal and labels, large system font/display settings, touch target sizes, contrast, system-bar insets, orientation changes and keyboard visibility. Use native semantics and accessibility APIs; preserve device controls and notification accessibility.
- **Motion:** Keep transitions short and functional. Respect reduced-motion settings and avoid continuously animating decorative gradients. Do not remove informative playback indicators without an equivalent state cue.
- **Performance:** Profile long playlists, scrolling, artwork loads, player responsiveness and device transfer on representative hardware. Reuse existing artwork and caches; avoid network-dependent decorative assets. Measure before introducing virtualization or libraries.

**Exit:** No blocked core journey; visual and accessibility checks are documented with device/browser, theme, font scale, and remaining issues.

## Implementation sequence and validation

1. Baseline and audit both products, then confirm direction and select the first screen. The user has requested a plan only; implementation begins only after a separate implementation request.
2. Implement shared tokens and a small reusable control set in both repositories. Validate theme migration and accessibility before migrating screens.
3. Implement player/lyrics, then personal library and Discover, then playlist/artist detail and dialogs. Keep each change reviewable and preserve current in-progress library behavior.
4. Address Home, login/settings, and web admin. Apply Unslop's passes in order where useful: spacing → color → icons → copy → type → layout → details → visuals → motion.
5. Add or adjust focused tests for changed behavior and accessible controls, not tests that merely duplicate the styling implementation. Run web `npm test` and `npm run build`; Android `./gradlew testDebugUnitTest assembleDebug`; run backend and sync tests when their behavior is touched. Use isolated test data and a temporary Android checkout if needed.
6. Compare before/after captures for each theme and size. Check the critical journey on a real Android device, including app restart, downloaded playback offline, reconnection and cross-device transfer. Confirm no loss of local files, queued changes or account isolation. Record device/browser and any untested cases.
7. Review both repositories' diffs and update UI documentation. Release web/server and Android in a compatible order only under a separate deployment request. Preserve a rollback path and test an upgrade from the currently installed app, including signing compatibility.

## Definition of done

- The same Sangita identity is recognizable across both platforms, while web and Android use their own native navigation and interaction conventions.
- Primary listening tasks are obvious, readable and accessible in AMOLED, dark and light, including narrow screens, long titles and large fonts.
- Artwork and lyrics carry visual interest; effects elsewhere are intentional and do not interfere with content or state.
- A new user sees a useful empty personal library and can discover and save permitted items. Existing personal playlists, favorites, downloads, saved choices and pending edits remain intact.
- Playback, lyrics, background audio, notifications, permissions, device transfer, offline downloads and admin capabilities have no known regression.
- Automated checks pass and before/after visual and real-device findings, including any limitations, are recorded.

## Decisions for implementation review

- Which single listening screen should be the first design reference: web playlist/player or Android full player? Use the other platform to validate the system early.
- Should the default Android Home emphasize recently played content or quick access to the personal library? Retain the current behavior until user feedback supports a change.
- Which existing decorative effects are intentional parts of Sangita's identity, particularly lyrics ambience and artwork-derived backgrounds? Assess them visually rather than removing them mechanically.
- How should saved-but-not-downloaded tracks be explained while offline? Keep Downloads as the clear place for files stored on the phone; do not promise offline library editing without an implemented sync design.
