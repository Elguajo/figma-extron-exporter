# Prepared Frame export

**User outcome:** one editable Extron screen from a prepared Figma Frame.

**Entry path:** plugin panel → profile → Create demo → Check → Download .exui.

**Drive:** follow HARNESS.md steps 1–6. To test naming independence rename a Button and its state layers, reverse state order and move the outer control inside the page. To test copy handling duplicate it and observe the explicit reassignment error.

**Proof of success:** source Frame and metadata persist, all three states present in package, CLI independent report 61/61 for the example, key/objectId/controlId unchanged after cosmetics. Fresh real Figma exports must be distinguished from fixture-generated packages.

**Side effects:** Create demo adds new Frames and images; Save assignment writes private node pluginData; Preview switches child visibility. Export reads design and downloads a local file. Native conversion creates new GDL/report only. No AV logic or Build.

**Prerequisites/gotchas:** Figma Desktop Design, stable plugin ID, Arial, exact supported canvas. Prepared Frames rather than Component Instances. Text/PNG restrictions in src/figma-plugin/README.md. Do not reuse retired IDs for unrelated controls manually; no automatic history registry exists.
