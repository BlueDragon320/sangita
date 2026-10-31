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
