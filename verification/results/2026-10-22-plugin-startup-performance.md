# Plugin startup performance and collapsed button panel

Date: 2026-10-22. Changes made in the main checkout, preserving existing work.

## Findings and correction

- `presetPreviews()` used to flatten the entire current page separately for each role, and repeat that traversal when a sample was absent: up to four whole-page traversals per UI update. Both roles now share one iterative traversal. Explicit saved sample references stop traversal once both are found. Missing, ambiguous, renamed and deleted sample behavior is retained.
- Scope restoration used to traverse every node even with no saved frame IDs. It now skips that work and stops once all requested frames have been found. Saved order and nested frames are preserved.
- `publish()` used to recognize the same project separately for navigation targets and authoring links. Those consumers now share the same synchronous draft within one publish. It is never cached across edits or commands.
- Recognition and capture signatures used to serialize the entire Figma page even when explicit project members were supplied. Signatures now inspect those members and their descendants, retaining root properties and parent/absolute geometry checks. Full-tree signatures remain the default when no member scope is supplied. Export still rejects edits, deletion, reparenting and edits during asynchronous PNG rendering within the export scope.
- The “Оформление кнопок” disclosure starts collapsed. Opening it exposes the existing actions; selection updates do not force it open.

## Verification

- `npm run verify`: type checks, **480/480 tests**, build passed.
- `npm run test:browser`: Chromium UI passed, including initial collapsed state, manual disclosure opening, sample assignment, preparation/update, both profile downloads, popup links, keyboard use and error recovery; no page errors. Figma parent messages are mocked.
- `node test/startup-benchmark.ts`: 5000 unrelated rectangles, median of 3 synthetic API runs. Reconstructed pre-fix hot paths: **161.71 ms** startup; corrected paths: **6.06 ms**. Across three startup/export runs, reads of unrelated rectangle fills changed from **210000 to 0**. Export bundles were identical in this scenario.
- Packaged main bundle executed against the API fixture: ready and selected-frame exports passed for both panel profiles; archive HTML contains the initially collapsed disclosure.
- `git diff --check`: passed.

The benchmark reconstructs the previous startup hot paths while retaining other working-tree fixes. It measures JavaScript against the fake Figma API, not native Figma node loading, host CPU, GPU or memory behavior. Native Figma startup in the user's actual document has not been profiled; complete elimination of the reported freezes is not yet established.

## Artifacts

- Development build: `src/figma-plugin/manifest.json` → `dist/code.js`, `dist/ui.html`.
- Working-build archive: `output/plugin-startup/figma-extron-plugin-0.6.8-startup-fix.zip`. Existing release archives were not replaced.
- Benchmark output: `output/plugin-startup/benchmark.json`.
- Check logs: `output/plugin-startup-verify.txt`, `output/plugin-startup-browser.txt`.
