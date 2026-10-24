# Third-party code and permission

## Baolv/figma-export

Source: https://github.com/Baolv/figma-export
Pinned revision: `6312d15ea52470ab14600c49506f7f9e3c9aec91`.

The repository owner/user explicitly stated in this conversation that they hold a license and authorized using this project as the basis of our plugin. The license text was not supplied to this repository; no MIT/Apache or other license is invented for the upstream code. This notice records provenance and the authorization, and does not replace the owner's license terms.

Adapted parts:

| Our file | Upstream source | Adaptation |
|---|---|---|
| `src/read-node.ts` | `figma-plugin/src/lib/traverse.ts`, `assets.ts` | Bounding box, solid color and font extraction; native PNG export; strict Extron checks replace general serialization and skipped errors |
| `src/package.ts`, `src/ui.ts` | `figma-plugin/ui.html` | Figma parent/UI messages, ZIP and Blob download flow; direct `.exui/1`, SHA-256 and fixed ZIP metadata |
| `ui.html` | `figma-plugin/ui.html` | Compact Figma-themed fieldsets, legends, controls, full-width export action, progress and result status; Russian Extron-specific workflow, metadata editor, accessible labels/focus and stronger fallback contrast |

The upstream delta cache, AI workflow, localhost bridge, sync shell scripts and embedded minified fflate copy are not shipped. We install fflate from its separately licensed npm package. Source attribution is also included in adapted file headers. The plugin has its own stable development ID.

## Runtime dependencies

- `fflate` 0.8.3 — MIT, https://github.com/101arrowz/fflate
- `@noble/hashes` 1.8.0 — MIT, https://github.com/paulmillr/noble-hashes

Their complete license texts are included in the installable archive under `licenses/`. Development tooling and exact versions are pinned by package-lock.json. No Extron DLL, donor GDL, third-party font or private SDK is included.

## AV icons

18 SVG icons from `lucide-static` 1.61.0 are embedded in Extron Kit. Source, integrity and original SVGs: `design/extron-kit/icons/`. ISC and applicable Feather MIT notices are preserved in `licenses/lucide.txt` in the plugin archive. Icons have no Extron control IDs and are intended for button Artwork or passive graphics.
