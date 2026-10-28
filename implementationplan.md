# Sangita web themes and admin dashboard: implementation plan

## Goal

Bring the web player’s appearance into line with the Android app and make the admin dashboard easier to navigate. Preserve the current music, account-management, analytics, system, and lyrics-engine capabilities.

This document is a plan only. It does not make any application changes.

## Current state

- The Android app has three themes: **Pure AMOLED Black**, **Dark Obsidian**, and **Light Zinc**. Its primary accent is soft steel blue (`#66A3BF`), with a deep navy (`#032F72`) used for contrasting controls.
- The web app currently has two themes, `dark` and `light`, with green accent colors. The selected theme is saved in browser local storage as `sangita_theme`.
- Web theme tokens and many component styles live in `frontend/src/index.css`; some green colors are hard-coded there and in the admin dashboard.
- The web admin dashboard is a large component in `frontend/src/components/AdminDashboard.jsx`. It has six functional areas: overview and analytics, music and catalog, activity logs, users, lyrics, and system health. The lyrics engine also contains configuration, telemetry, progress, logs, and remote-compute controls.
- The admin component already has tests in `frontend/src/test/AdminDashboard.test.jsx`. These provide a useful regression baseline but do not cover every workflow.

## Scope and boundaries

### In scope

1. Add Android-aligned web themes and a clear way to select them.
2. Improve the admin dashboard’s navigation, spacing, hierarchy, readability, and mobile layout.
3. Keep common actions easy to find and progressively disclose secondary diagnostic information.
4. Verify the player, admin screens, themes, and affected workflows.
5. Update relevant web documentation and tests.

### Out of scope

- Changing backend APIs, account permissions, lyrics-generation behavior, or playback logic solely for the redesign.
- Removing admin features or hiding required fields behind an inaccessible control.
- Changing the Android app.
- Deploying to the live server without a separate deployment instruction.

## Part 1: Align the web themes with Android

### Theme choices

Provide three named choices, matching Android’s terminology:

| Web theme | Reference | Planned base colors |
| --- | --- | --- |
| Pure AMOLED Black | Android AMOLED | Background and main surfaces `#000000`; subtle borders and readable light text. |
| Dark Obsidian | Android dark | Background `#080A0F`; surfaces around `#10131B` and `#121620`; text `#F1F2F7`. |
| Light Zinc | Android light | Background `#F8FAFC`; white cards; text `#0F172A`; borders `#E2E8F0`. |

Use the Android palette as the visual reference, adapting individual colors where necessary to keep text, icons, and active states readable in a browser. Use soft steel blue for primary accents, with appropriate dark or light text on filled buttons. Preserve distinct semantic colors for errors, warnings, and success rather than making every indicator blue.

### How to implement

1. **Define shared theme tokens** in `frontend/src/index.css` for backgrounds, surfaces, text, borders, accent colors, button text, focus rings, and overlays. Add an explicit `amoled` theme alongside `dark` and `light`.
2. **Replace hard-coded primary green accents** in the player, library, login screen, lyrics controls, and admin styling with appropriate tokens. Review each occurrence rather than blindly replacing semantic success or status colors.
3. **Add named theme selection.** Prefer a compact menu or selector that shows the current theme and lets the user choose any of the three directly. Use accessible button labels and keyboard support. Ensure both the player header and admin header can access it.
4. **Preserve existing preferences.** Continue using `sangita_theme` and explicitly decide how existing `dark` and `light` values map to the new themes. Because the current web dark theme is pure black, consider migrating an existing `dark` selection to AMOLED so a returning user’s saved appearance does not unexpectedly change. Document the chosen migration and test it.
5. **Apply the selected theme consistently** to the app shell, menus, dialogs, player bar, login page, admin dashboard, empty states, and responsive layouts. Check the admin dashboard’s nested `data-theme` behavior.
6. **Keep lyrics background controls independent.** The lyrics overlay has its own background preference; preserve that behavior while ensuring its text and controls remain legible with each application theme.
7. Review focus states, input borders, hover/active states, disabled controls, and contrast in all three themes.

### Acceptance criteria

- Users can select all three themes directly and see which is selected.
- The selection persists after a refresh and remains consistent when switching between player and admin pages.
- Existing saved theme preferences receive a deliberate, tested migration.
- AMOLED uses a black main background and player background. Dark and light use the corresponding Android-inspired palettes.
- Controls, status messages, and text remain readable in all three themes.
- Existing lyrics background preferences and functionality continue to work.

## Part 2: Simplify the admin dashboard

### Design approach

Keep the existing six areas but give each one a short, clear label and purpose:

| Area | Primary task |
| --- | --- |
| Overview | See listening activity and the most important metrics. |
| Music | Inspect tracks, artists, playlists, and catalog activity. |
| Activity | Inspect live sessions and logs. |
| Users | Create, edit, and manage accounts and access. |
| Lyrics | Configure and run lyrics jobs; inspect progress and logs. |
| System | Inspect server health and technical details. |

Use these as working labels; retain terminology that matches the actual information shown. Do not show a “live” or healthy status unless it is supported by current data.

### Planned layout

1. **Simplify the top bar.** Show the Sangita admin identity, a clear return-to-player action, the theme selector, and account/sign-out actions. Keep timezone selection easy to find near the analytics controls rather than competing with primary navigation.
2. **Use one clear navigation row.** Shorten the tab labels, make the active area visually obvious, and allow horizontal scrolling on small screens instead of wrapping multiple rows of dense controls. Use accessible selected-state semantics and maintain existing test identifiers where practical.
3. **Add a page heading and short description** for the active area so users know what they are looking at. Keep page-level actions close to the content they affect.
4. **Simplify the overview.** Keep the core metrics and listening trend immediately visible. Group secondary breakdowns—such as hourly, weekday, device, OS, and browser details—under clearly named expandable sections if appropriate. Do not remove data.
5. **Make filters understandable.** Group the date range, custom dates, timezone, refresh, and export controls. Use readable labels, clear selected states, and a sensible mobile layout. Keep custom date validation and existing fetch behavior intact.
6. **Reduce lyrics-engine overload.** Keep job status, scope, and the main start/stop actions prominent. Group advanced model, resource, remote GPU, telemetry, and logs under clearly labelled sections or disclosures. Preserve defaults, validation, existing state, active-job visibility, and every existing action. Avoid collapsing warnings or errors needed to understand a running job.
7. **Improve tables and forms.** Increase touch-target size, improve labels and spacing, make wide tables scroll horizontally on mobile, and keep account actions understandable. Preserve confirmation behavior for destructive actions.
8. **Clarify loading, empty, and failure states.** Avoid presenting placeholder zeros as real results while loading or after an error. Provide useful retry controls where an existing fetch supports them. Distinguish “no data” from “could not load.”
9. **Improve accessibility.** Add landmarks and headings, visible focus, accessible labels for icon-only buttons, selected tab state, keyboard-operable disclosures, and reduced-motion support. Keep status changes understandable without relying solely on color.

### Suggested implementation structure

- Start with the existing component to avoid a large risky rewrite.
- Extract small, self-contained pieces where it makes the redesign easier to maintain, such as the admin navigation, page heading, theme selector, and analytics toolbar.
- Keep API calls and state transitions unchanged unless an error or usability issue requires a targeted fix.
- Move reusable styles into clear admin-specific CSS rather than adding more scattered inline styles. Keep theme colors based on shared tokens.
- Keep a record of the existing controls and verify each remains reachable after grouping.

### Acceptance criteria

- All six admin areas remain accessible on desktop and mobile.
- Existing account management, export, analytics filters, logs, system controls, and lyrics-engine actions still work.
- The overview shows a clear summary first; secondary detail remains discoverable.
- Lyrics job state and start/stop actions are visible without navigating through unrelated settings.
- Filters, dialogs, and tables work at narrow widths without clipped actions.
- Loading, error, and empty states are distinct and actionable.
- Theme selection, keyboard navigation, focus visibility, and readable contrast work throughout the dashboard.

## Implementation order

1. Establish the theme tokens, preference migration, and reusable theme selector.
2. Update the player and other non-admin screens to use the tokens; verify all three themes.
3. Rework the admin shell, navigation, headings, and filter placement.
4. Simplify the overview and progressively group lyrics-engine diagnostics while preserving actions.
5. Polish users, activity, music, and system screens and their responsive layouts.
6. Run regression tests and visually inspect the finished result in each theme and at desktop and mobile widths.
7. Update the README with theme options and any changed admin navigation.

## Verification plan

### Automated checks

- Run the existing frontend suite and production build.
- Add focused tests for theme selection, persistence, old-preference migration, and switching between player and admin.
- Test admin navigation and selected states; ensure each area can be opened by keyboard and by pointer.
- Retain or extend tests for analytics timeframe, export, user creation/editing, lyrics configuration and job controls.
- Test that loading, error, and empty states are distinguishable and that retry actions call the right fetch.
- Check that collapsible sections remain keyboard-operable and do not remove hidden functionality.

### Visual and manual checks

- Inspect AMOLED, dark, and light themes on the player, login, admin overview, users, lyrics engine, and dialogs.
- Check desktop, tablet, and narrow mobile widths, including long names, empty datasets, and wide tables.
- Exercise a complete admin workflow: navigate, change a timeframe, inspect a chart, open and cancel a user form, and inspect lyrics configuration without starting an unintended job.
- Verify the theme survives refresh and navigation, and that it does not change the separate lyrics-background preference.
- Check text and interactive contrast, focus indicators, keyboard order, screen-reader labels, and reduced-motion behavior.

## Rollout and risks

- A theme migration can change an existing user’s saved appearance if mapped incorrectly; cover the old `dark` and `light` values with tests.
- The admin dashboard contains many controls and remote-job operations. Extract and group incrementally, with regression tests, instead of rewriting all behavior at once.
- Some status colors are semantic; keep them distinct from the general blue accent.
- Test against representative data, but do not start lyrics jobs, edit users, or make other consequential changes merely to inspect the layout.
- The web update requires a rebuild and deployment to the cloud server; source changes alone do not update the live site.
