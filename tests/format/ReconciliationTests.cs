using ExtronExporter.Format;
using System.Text.Json;
using static ExtronExporter.Format.NrbfDocument;

static class ReconciliationTests
{
    static void Check(bool ok, string message = "Assertion failed") { if (!ok) throw new Exception(message); }
    static void Reject(Action action) { try { action(); } catch (Exception e) when (e is InvalidDataException or NotSupportedException) { return; } throw new Exception("Expected rejection"); }
    static string[] ControlIdFields(NrbfNode node) => node.Fields!.Keys
        .Where(k => k == "userIdField" || k.EndsWith("+userIdField", StringComparison.Ordinal)).ToArray();
    static ushort ControlId(NrbfNode node) => ControlIdFields(node)
        .Select(k => (ushort)node.Fields![k]!).Distinct().Single();
    public static void Unit(Action<string, Action> test, Func<string, byte[]> fixture)
    {
        string root = ScreenTests.Root;
        foreach (string mode in new[] { "", "shared-string", "shared-collection", "shared-state-array" })
            test($"Reconciliation writer: synthetic graph retains values and shared references ({mode})", () =>
            {
                byte[] before = fixture(mode); byte[] after = Read(before).Write();
                Check(NrbfGraph.Compare(before, after).Count == 0);
            });
        test("Reconciliation verifier catches protected values and split references", () =>
        {
            var a = Read(fixture("shared-string")); var b = Read(fixture("shared-string"));
            Set(Child(b.Root, "button"), "PBControlBase+nameField", new NrbfNode { Type = "System.String", Text = "Changed" });
            Reject(() => AssertEquivalent(a.Root, b.Root));
            b = Read(fixture("shared-string")); var extra = Child(b.Root, "extra");
            Set(extra, "text", Copy(Child(extra, "text"))); Reject(() => AssertEquivalent(a.Root, b.Root));
        });
        test("Reconciliation writer keeps local DateTime ticks and primitive arrays", () =>
        {
            var doc = Read(fixture(""));
            doc.Root.Fields!.Add("localDate", new DateTime(2026, 10, 24, 12, 23, 45, DateTimeKind.Local));
            doc.Root.Fields.Add("bytes", new NrbfNode { Type = "System.Byte[]", Library = "mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089", Values = new byte[] { 0, 128, 255 } });
            byte[] bytes = doc.Write(); AssertEquivalent(doc.Root, Read(bytes).Root);
        });
        foreach (string name in new[] { "tlp-pro-1025m", "tlp-pro-300m-portrait" })
        {
            string file = Path.Combine(root, "samples", "donors", name + ".gdl");
            if (!File.Exists(file)) continue;
            test($"Reconciliation writer: {name} preserves the complete decoded donor graph", () =>
            {
                var before = ExtronContainer.ReadFile(file).Payload;
                byte[] after = NrbfDocument.Read(before).Write();
                var differences = NrbfGraph.Compare(before, after);
                if (differences.Count != 0) throw new Exception(string.Join("; ", differences.Select(x => $"{x.Path}: {x.Left} => {x.Right}")));
                string output = Path.Combine(root, "output", "reconciliation"); Directory.CreateDirectory(output);
                File.WriteAllBytes(Path.Combine(output, name + "-roundtrip.gdl"), ExtronContainer.ReadFile(file).RepackWithPayload(after));
            });
        }
        foreach (string name in new[] { "tlp-pro-1025m", "tlp-pro-300m-portrait" })
        {
            string folder = Path.Combine(root, "samples", "fixtures", "update-workflow-0.6.6");
            string oldFile = Path.Combine(folder, name + "-v1.gdl"), newFile = Path.Combine(folder, name + "-v2.gdl");
            if (!File.Exists(oldFile) || !File.Exists(newFile)) continue;
            byte[] before = File.ReadAllBytes(oldFile), after = File.ReadAllBytes(newFile);
            LayoutUpdateSelection Select(byte[] a, byte[] b, int[]? ids = null, bool geometry = false)
            { var p = LayoutReconciliation.Compare(a, b); return new("exui-layout-selection/1", p.BaseSha256, p.SourceSha256, ids ?? [8101], geometry); }
            ProjectModel Model(byte[] bytes) => ProjectModel.Read(ExtronContainer.Parse(bytes).Payload);
            ControlModel Music(ProjectModel p) => p.Pages.SelectMany(c => c.Controls).Single(c => c.ControlId == 8101);
            test($"Layout update {name}: selected appearance, unchanged geometry/IDs and unselected button", () =>
            {
                var plan = LayoutReconciliation.Compare(before, after);
                Check(plan.Items.Single(i => i.ControlId == 8101).CanUpdate);
                Check(!plan.Items.Single(i => i.ControlId == 8103).CanUpdate && !plan.Items.Single(i => i.ControlId == 8104).CanUpdate);
                var r = LayoutReconciliation.Apply(before, after, Select(before, after));
                var old = Model(before); var actual = Model(r.Gdl); var next = Model(after);
                Check(Music(actual).States[0].Text == Music(next).States[0].Text);
                Check(Music(actual).Left == Music(old).Left && Music(actual).Top == Music(old).Top);
                Check(Music(actual).ControlId == 8101 && Music(actual).ObjectId == Music(old).ObjectId && actual.ProjectId == old.ProjectId);
                Check(JsonSerializer.Serialize(actual.Pages[0].Controls.Single(c => c.ControlId == 8103)) == JsonSerializer.Serialize(old.Pages[0].Controls.Single(c => c.ControlId == 8103)));
                Check(actual.Pages[0].Controls.All(c => c.ControlId != 8104));
                Check(r.ImportedResources > 0 && !ExtronContainer.Parse(r.Gdl).HasBuildOutput);
                Check(!r.GcpVerified && actual.Build.StatusValue == 1);
            });
            test($"Layout update {name}: geometry is opt-in and stale/unknown/duplicate selections are refused", () =>
            {
                var r = LayoutReconciliation.Apply(before, after, Select(before, after, geometry: true));
                Check(Music(Model(r.Gdl)).Left == Music(Model(after)).Left);
                var selection = Select(before, after);
                Reject(() => LayoutReconciliation.Apply(before, after, selection with { BaseSha256 = "stale" }));
                Reject(() => LayoutReconciliation.Apply(before, after, selection with { SourceSha256 = "stale" }));
                foreach (int[] ids in new[] { Array.Empty<int>(), new[] { 8101, 8101 }, new[] { 8104 } }) Reject(() => LayoutReconciliation.Apply(before, after, selection with { ControlIds = ids }));
            });
            test($"Layout update {name}: shared old states stay unchanged on unselected buttons; manual popup retained", () =>
            {
                var container = ExtronContainer.Parse(before); var doc = Read(container.Payload);
                var pages = Items(Child(doc.Root, "pagesField")); var controls = Items(Child(pages[0], "controlsField"));
                var music = controls.Single(c => ControlId(c) == 8101);
                var mute = controls.Single(c => ControlId(c) == 8103);
                Set(mute, "statesField", Child(music, "statesField"));
                // A manual container unknown to Figma must survive the full graph write.
                var manual = Copy(pages[0]); Set(manual, "idField", (ulong)500);
                foreach (string field in ControlIdFields(manual)) manual.Fields![field] = (ushort)500;
                Set(manual, "nameField", new NrbfNode { Type = "System.String", Text = "Manual page" });
                var empty = Copy(Child(manual, "controlsField")); Set(empty, "_size", 0); Set(manual, "controlsField", empty);
                var list = Child(doc.Root, "pagesField"); var array = Copy(Child(list, "_items")); array.Values = pages.Append(manual).ToArray();
                Set(list, "_items", array); Set(list, "_size", pages.Length + 1);
                byte[] edited = container.RepackEditablePayload(doc.Write());
                var original = Model(edited); var updated = Model(LayoutReconciliation.Apply(edited, after, Select(edited, after)).Gdl);
                Check(JsonSerializer.Serialize(original.Pages[0].Controls.Single(c => c.ControlId == 8103)) == JsonSerializer.Serialize(updated.Pages[0].Controls.Single(c => c.ControlId == 8103)));
                Check(updated.Pages.Any(p => p.Name == "Manual page" && p.ObjectId == 500));
            });
            test($"Layout update {name}: changed object identity and state mapping block replacement", () =>
            {
                foreach (string mode in new[] { "object", "state" })
                {
                    var container = ExtronContainer.Parse(after); var doc = Read(container.Payload);
                    var music = Items(Child(Items(Child(doc.Root, "pagesField"))[0], "controlsField")).Single(c => ControlId(c) == 8101);
                    if (mode == "object") Set(music, "idField", (ulong)999);
                    else Set(Items(Child(music, "statesField"))[0], "nameField", new NrbfNode { Type = "System.String", Text = "Different role" });
                    byte[] changed = container.RepackEditablePayload(doc.Write());
                    Check(!LayoutReconciliation.Compare(before, changed).Items.Single(i => i.ControlId == 8101).CanUpdate);
                    Reject(() => LayoutReconciliation.Apply(before, changed, Select(before, changed)));
                }
            });
            test($"Layout update {name}: different IDs bind explicitly and export/reload the Figma ID map", () =>
            {
                var container=ExtronContainer.Parse(after);var doc=Read(container.Payload);
                var music=Items(Child(Items(Child(doc.Root,"pagesField"))[0],"controlsField")).Single(c=>ControlId(c)==8101);
                foreach(string field in ControlIdFields(music))music.Fields![field]=(ushort)9205;
                byte[] incoming=container.RepackEditablePayload(doc.Write());
                var pairs=new[]{new LayoutButtonBinding(8101,9205)};
                var plan=LayoutReconciliation.Compare(before,incoming,bindings:pairs);
                Check(plan.Items.Single(i=>i.ControlId==8101) is {CanUpdate:true,Status:"mapped",SourceControlId:9205});
                Check(!LayoutReconciliation.Compare(before,incoming).Items.Single(i=>i.ControlId==8101).CanUpdate);
                var selection=new LayoutUpdateSelection("exui-layout-selection/1",plan.BaseSha256,plan.SourceSha256,[8101],Bindings:pairs);
                var updated=Model(LayoutReconciliation.Apply(before,incoming,selection).Gdl);
                Check(Music(updated).ControlId==8101&&Music(updated).ObjectId==Music(Model(before)).ObjectId);
                Check(Music(updated).States[0].Text==Model(incoming).Pages[0].Controls.Single(c=>c.ControlId==9205).States[0].Text);
                var origin=new ExtronExporter.Screen.FigmaOrigin("exui-figma-origin/1","1:1","origin-test-00000001","Home",
                    [new("10:1",Model(incoming).Pages[0].Controls.Single(c=>c.ControlId==9205).Comments![9..],9205,"button_Music")]);
                var map=ExtronExporter.Screen.FigmaIdMap.Create(origin,name,before,incoming,selection);
                Check(map.Entries.Single() is {NodeId:"10:1",SourceControlId:9205,ControlId:8101});
                var changed=origin with {Nodes=[origin.Nodes[0] with {ControlId=8101}]};
                Check(map.BindTo(changed,name).Single()==new LayoutButtonBinding(8101,8101));
                Reject(()=>map.BindTo(changed with {PageToken="other-token-0000000"},name));
                Reject(()=>LayoutReconciliation.Compare(before,incoming,bindings:[new(8101,65535)]));
                Reject(()=>LayoutReconciliation.Compare(before,incoming,bindings:[new(8101,9205),new(8101,9205)]));
                var duplicate=selection with {ControlIds=[8101,8103],Bindings=[new(8101,9205),new(8103,9205)]};
                Reject(()=>LayoutReconciliation.Apply(before,incoming,duplicate));
                Reject(()=>ExtronExporter.Screen.FigmaIdMap.Create(origin,name,before,incoming,duplicate));
            });
            test($"Layout update {name}: explicit ID-only replacement updates a manually authored ID 1 without changing its identity or behavior", () =>
            {
                var oldContainer = ExtronContainer.Parse(before); var oldDoc = Read(oldContainer.Payload);
                var oldMusic = Items(Child(Items(Child(oldDoc.Root, "pagesField"))[0], "controlsField")).Single(c => ControlId(c) == 8101);
                foreach (string field in ControlIdFields(oldMusic)) oldMusic.Fields![field] = (ushort)1;
                Set(oldMusic, "idField", (ulong)2562);
                Set(oldMusic, "nameField", new NrbfNode { Type = "System.String", Text = "Button1_ID1" });
                Set(oldMusic, "commentsField", new NrbfNode { Type = "System.String", Text = "Created manually in GUI Designer" });
                foreach (var state in Items(Child(oldMusic, "statesField")))
                    Set(state, "nameField", new NrbfNode { Type = "System.String", Text = "Button1_ID1" });
                byte[] manual = oldContainer.RepackEditablePayload(oldDoc.Write());
                var nextContainer = ExtronContainer.Parse(after); var nextDoc = Read(nextContainer.Payload);
                var nextPage = Items(Child(nextDoc.Root, "pagesField"))[0];
                Set(nextPage, "idField", (ulong)6000);
                var nextMusic = Items(Child(nextPage, "controlsField")).Single(c => ControlId(c) == 8101);
                foreach (string field in ControlIdFields(nextMusic)) nextMusic.Fields![field] = (ushort)1;
                byte[] incoming = nextContainer.RepackEditablePayload(nextDoc.Write());
                string evidence = Path.Combine(root, "output", "reconciliation"); Directory.CreateDirectory(evidence);
                File.WriteAllBytes(Path.Combine(evidence, name + "-manual-id1-working.gdl"), manual);
                File.WriteAllBytes(Path.Combine(evidence, name + "-manual-id1-incoming.gdl"), incoming);
                Check(!LayoutReconciliation.Compare(manual, incoming).Items.Single(i => i.ControlId == 1).CanUpdate);
                var strict = Select(manual, incoming, [1]);
                Reject(() => LayoutReconciliation.Apply(manual, incoming, strict));
                var plan = LayoutReconciliation.Compare(manual, incoming, rebindByControlId: true);
                Check(plan.Items.Single(i => i.ControlId == 1) is { CanUpdate: true, Status: "rebind" });
                var original = Model(manual); var updated = Model(LayoutReconciliation.Apply(manual, incoming, strict with { RebindByControlId = true }).Gdl);
                var oldButton = original.Pages.SelectMany(c => c.Controls).Single(c => c.ControlId == 1);
                var actual = updated.Pages.SelectMany(c => c.Controls).Single(c => c.ControlId == 1);
                Check(actual.ObjectId == 2562 && actual.Name == "Button1_ID1" && actual.Comments == oldButton.Comments);
                Check(updated.Pages[0].ObjectId == original.Pages[0].ObjectId && updated.ProjectId == original.ProjectId);
                Check(actual.States.Select(s => (s.Id, s.Name, s.Index)).SequenceEqual(oldButton.States.Select(s => (s.Id, s.Name, s.Index))));
                Check(actual.States[0].Text == Model(incoming).Pages[0].Controls.Single(c => c.ControlId == 1).States[0].Text);
                Check(JsonSerializer.Serialize(updated.Pages[0].Controls.Single(c => c.ControlId == 8103)) == JsonSerializer.Serialize(original.Pages[0].Controls.Single(c => c.ControlId == 8103)));
                // Explicit matching cannot override an incompatible state map.
                var bad = Items(Child(nextMusic, "statesField"))[0]; Set(bad, "idField", (ulong)7);
                byte[] incompatible = nextContainer.RepackEditablePayload(nextDoc.Write());
                Check(!LayoutReconciliation.Compare(manual, incompatible, rebindByControlId: true).Items.Single(i => i.ControlId == 1).CanUpdate);
                Reject(() => LayoutReconciliation.Apply(manual, incompatible, Select(manual, incompatible, [1]) with { RebindByControlId = true }));
            });
        }
    }
}
