# Verification harness — Figma plugin MVP

## Surface

Primary: local development plugin imported into Figma Desktop Design mode. Secondary: real HTML plugin UI, `.exui/1` download and .NET CLI. Supported outcome is one prepared Frame converted to a new editable GDL.

## Launch

From repository root: `npm ci --prefix src/figma-plugin --ignore-scripts`, `npm run verify --prefix src/figma-plugin`. Import `src/figma-plugin/manifest.json` through Figma Desktop → Plugins → Development → Import plugin from manifest. Stable development ID must remain unchanged after metadata creation. Arial Regular/Bold must be available.

## Readiness / Doctor

`manifest.json` points to existing `dist/code.js` and `dist/ui.html`. Panel title: Figma → Extron Exporter; profile options 1280×800 and 320×480. Confirm this build against recorded SHA in `verification/results/2026-10-19-figma-plugin/file-hashes.json`. Run typecheck/unit/build before the real surface. Native integration additionally needs a built .NET CLI, pinned donors, x86 PowerShell and installed GUI Designer 1.28.0.7.

## Drive

1. New disposable Figma Design file, run the plugin, select one profile, click «Создать демо для этого профиля».
2. Keep generated Frame selected, click «Проверить экран», then «Скачать .exui». Verify complete package, not a delta.
3. Select the outer Button Frame; open «Назначение выбранного элемента», switch preview normal/feedback/pressed. Caption/appearance changes; role and IDs remain explicit.
4. Reopen plugin/file and repeat export. Change layer names/order/coordinates; original key/objectId/controlId stay saved. Copy a control: export must refuse until its control and child state/icon metadata are explicitly reassigned.
5. Validate the actual downloaded file with CLI `validate-package`, then `convert-package <download> <new.gdl>`. Use a new output filename; read its report and verify profile/ID/state/resource checks.
6. Repeat for second profile. Open copies in GUI Designer, inspect/edit, Verify and record actual counts, Save and Build manually, close and reopen. Hardware verification is separate.

## Evidence

Action → new Figma Frame/metadata → downloaded `.exui` → CLI exit 0 and new GDL/report. Record plugin and Figma versions, source profile, screenshots, package SHA, actual download filename and result report. Record Verify counts only if observed.

Automated commands:
- `npm test --prefix src/figma-plugin`: fake Figma API + compiled plugin VM; no claim of real Figma.
- `npm run test:browser --prefix src/figma-plugin`: actual Chromium UI/download, Figma parent messages simulated; browser JSON/screenshot under fresh output folder.
- `node src/figma-plugin/test/native-integration.ts <new-output-folder>` with DOTNET_EXE and EXUI_DONOR_REGISTRY env vars: fake Figma document boundary → real package → actual CLI/Extron writer. No GUI/Build automation.

## Isolation and cleanup

Use a separate worktree if main has parallel edits. Current implementation started at 6a006f5 in codex/figma-plugin. Node outputs are git-ignored. Browser test starts its own ephemeral loopback server and Chromium context and closes both in finally; it never controls existing user browser sessions. Figma demos append new Frames away from existing content. Only delete test Frames created by this run; no generic app/process kills. Native generation creates new files and preserves pinned references. Build remains a manual GUI Designer action.

## Known limitations

Status is an MVP awaiting actual Figma Desktop import/render/persistence verification. Figma MCP use_figma cannot validate our private pluginData path, so it was not substituted for the classic-plugin proof. Browser/API fixtures prove their own boundaries only. Component instances/sets, history-based ID allocation, merge of manual GDL edits, navigation and hardware are unsupported/unverified. Hidden-state PNG rendering, font unit fidelity and label layout must be checked on the real surface.

## Feature map

See [features/README.md](features/README.md). Result evidence: `verification/results/2026-10-19-figma-plugin.md`.
