# Navigation targets before saved recognition

User evidence: plugin 0.5.3 reports `screen_AudioControl: нужна кнопка, ведущая к контейнеру`, while the selected `button_AudioControl` has blank identity fields and only `Без перехода` in the target list.

Cause: `publish()` required saved project metadata and saved container metadata to list targets. Recognition with a navigation validation error cannot save those assignments, leaving the editor unable to repair the navigation.

Changes:

- A configured project scope uses a read-only recognition draft for target keys and selected-node form defaults, including when final navigation validation fails.
- Saving a transition on an unprepared project supplies the edited button to recognition, validates the result, and applies the complete plan with existing rollback protection.
- Already assigned projects retain the ordinary manual-save path, allowing transitions to be edited individually.
- Empty-target helper text explains how to select a project scope. No automatic scope expansion or layer-name matching is introduced.

Regression evidence:

- Two new tests initially failed on an empty target list, then passed: entirely new screens, and a saved target already marked `shownBy: navigation`.
- Additional tests cover invalid targets, unrelated invalid artwork, write failure with full rollback, and current-page mode without remembered selection.
- `npm run verify`: 327 tests passed, type checking passed, build passed.
- `node test/browser.ts ../../output/figma-plugin/navigation-fix-browser-20261022`: Chromium UI suite passed without page errors.

Artifact: `output/figma-plugin/figma-extron-plugin-0.5.5-navigation-fix.zip`, extracted to `output/figma-plugin/navigation-fix-0.5.5` for direct development-plugin import. This is a local fix build; it has not been installed or exercised inside the user's Figma Desktop. API tests use the Figma fixture; the browser suite uses the simulated host bridge.
