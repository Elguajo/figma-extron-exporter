# Prepared Frame export

**User outcome:** one editable Extron screen from a prepared Figma Frame.

**Entry path:** plugin panel → profile → Create demo → Check → Download .exui.

**Drive:** follow HARNESS.md steps 1–6. To test naming independence rename a Button and its state layers, reverse state order and move the outer control inside the page. To test copy handling duplicate it and observe the explicit reassignment error.

**Proof of success:** all three states present in package, current CLI independent report 65/65 for the example, key/objectId/controlId unchanged after cosmetics. Fixture tests cover ID stability; real metadata persistence across Figma restarts remains pending. User-provided real 300M export is preserved in examples/figma-plugin/figma-demo-300m.exui with semantics and decoded PNG checks in verification/results/2026-10-19-figma-real-export.md. Real 1025M export and the new GDL GUI cycle remain pending.

**Side effects:** Create demo adds new Frames and images; Save assignment writes private node pluginData; Preview switches child visibility. Export creates temporary visible icon clones for isolated PNG rendering, removes them in finally, and downloads a local file. Source layers remain unchanged. Native conversion creates new GDL/report only. No AV logic or Build.

**Prerequisites/gotchas:** Figma Desktop Design, stable plugin ID, Arial, exact supported canvas. Prepared Frames rather than Component Instances. Text/PNG restrictions in src/figma-plugin/README.md. Do not reuse retired IDs for unrelated controls manually; no automatic history registry exists.
