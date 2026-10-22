using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ExtronExporter.Adapter;
using ExtronExporter.Format;
using ExtronExporter.Screen;

/// <summary>exui/5: pages, popups, popup groups, popup references and navigation intent.</summary>
static class PagesTests
{
    static void Check(bool ok, string why = "Assertion failed") { if (!ok) throw new Exception(why); }
    static string Example(string p) => Path.Combine(ScreenTests.Root, "examples", "exui-v2", p);
    static Dictionary<string, byte[]> Files(string p = "1025m") => CurrentPackageFixture.Read(Example(p));
    static void Edit(Dictionary<string, byte[]> files, string name, Action<JsonNode> edit)
    {
        var node = JsonNode.Parse(files[name])!; edit(node); files[name] = Encoding.UTF8.GetBytes(node.ToJsonString());
    }
    static string Zip(string work, Dictionary<string, byte[]> files)
    {
        string path = Path.Combine(work, Guid.NewGuid().ToString("N") + ".exui");
        using var output = File.Create(path);
        using var zip = new ZipArchive(output, ZipArchiveMode.Create);
        foreach (var (name, data) in files) { using var s = zip.CreateEntry(name, CompressionLevel.NoCompression).Open(); s.Write(data); }
        return path;
    }
    static void Reject(string code, Action action, string? fragment = null)
    {
        try { action(); }
        catch (ExuiException e) { Check(e.Code == code, $"{e.Code}, expected {code}: {e.Message}"); return; }
        catch (ScreenSpecException e)
        {
            Check(code == "spec", $"spec, expected {code}: {e.Message}");
            Check(fragment == null || e.Errors.Any(x => x.Contains(fragment, StringComparison.Ordinal)), $"no error with '{fragment}': {e.Message}");
            return;
        }
        catch (AdapterException e) { Check(e.Code == code, $"{e.Code}, expected {code}: {e.Message}"); return; }
        throw new Exception("Expected refusal " + code);
    }
    static JsonNode Page(JsonNode n, string key) => n["pages"]!.AsArray().Single(p => (string)p!["key"]! == key)!;
    static JsonNode Popup(JsonNode n, string key) => n["popups"]!.AsArray().Single(p => (string)p!["key"]! == key)!;
    static JsonNode Element(JsonNode container, string key) => container["elements"]!.AsArray().Single(e => (string)e!["key"]! == key)!;
    static Dictionary<string, (ulong, int)> Ids(GeneratePlan p) => p.Containers.SelectMany(c => c.Elements).ToDictionary(e => e.Key, e => (e.ObjectId, e.ControlId));

    public static void Unit(Action<string, Action> test)
    {
        string work = Directory.CreateTempSubdirectory("exui2-tests-").FullName;
        try
        {
            test("exui/5: transparent popup backgrounds and shape paints preserve alpha", () =>
            {
                var files = Files();
                Edit(files, "screen.json", n =>
                {
                    Popup(n, "popup.volume")["background"] = "#00000000";
                    Page(n, "page.home")["elements"]!.AsArray().Add(JsonNode.Parse("""
                        {"key":"popup-appearance.100.1","objectId":999999,"controlId":null,"name":"Guide",
                         "kind":"shape","rect":[0,0,80,60],"fillColor":"#80123456",
                         "native":{"shape":"rectangle","radius":0,"strokeColor":"#00000000","thickness":0}}
                        """)!);
                });
                using var package = ExuiPackage.Load(Zip(work, files));
                Check(package.Plan.Popups.Single(p => p.Key == "popup.volume").Background == "#00000000");
                var shape = package.Plan.Pages.SelectMany(p => p.Elements).Single(e => e.Key == "popup-appearance.100.1");
                Check(shape.FillColor == "#80123456" && shape.Native!.StrokeColor == "#00000000");
            });
            foreach (string color in new[] { "#0000000", "#000000000", "#GG000000", "#00000000\n" })
                test($"exui/5: invalid alpha color {System.Text.Json.JsonSerializer.Serialize(color)} is refused", () =>
                {
                    var files = Files(); Edit(files, "screen.json", n => Popup(n, "popup.volume")["background"] = color);
                    Reject("package-schema", () => ExuiPackage.Load(Zip(work, files)).Dispose());
                });
            test("exui/5: alpha extension does not allow transparent ordinary pages", () =>
            {
                var files = Files(); Edit(files, "screen.json", n => Page(n, "page.home")["background"] = "#00000000");
                Reject("package-schema", () => ExuiPackage.Load(Zip(work, files)).Dispose());
            });
            foreach (string profile in new[] { "1025m", "300m" })
                test($"exui/5 {profile}: pages, popups, group and references lower to one plan", () =>
                {
                    using var p = ExuiPackage.Load(Zip(work, Files(profile)));
                    Check(p.Contract == "exui/5" && p.Plan.Pages.Count == 2 && p.Plan.Popups.Count == 4 && p.Plan.Groups.Count == 1);
                    Check(p.Plan.StartPage == "page.home" && p.Plan.Page.ObjectId == 100);
                    Check(p.Plan.Groups[0] is { GroupId: 1, Name: "Источники", ReferenceCount: 1 });
                    var confirm = p.Plan.Popups.Single(x => x.Key == "popup.confirm");
                    Check(confirm.Modal && confirm.Width == p.Profile.Width && confirm.Height == p.Profile.Height && confirm.Group == null);
                    Check(p.Plan.Popups.Where(x => x.Group == "group.sources").Select(x => x.Key).SequenceEqual(new[] { "popup.sources-1", "popup.sources-2" }));
                    Check(p.Plan.Containers.SelectMany(c => c.Elements).Where(e => e.Kind == "button").All(e => e.PressState == 2));
                });
            test("exui/5: both panels carry the same keys and IDs", () =>
            {
                using var a = ExuiPackage.Load(Zip(work, Files("1025m")));
                using var b = ExuiPackage.Load(Zip(work, Files("300m")));
                Check(Ids(a.Plan).OrderBy(x => x.Key).SequenceEqual(Ids(b.Plan).OrderBy(x => x.Key)));
                Check(a.Plan.Containers.Select(c => (c.Key, c.ObjectId)).SequenceEqual(b.Plan.Containers.Select(c => (c.Key, c.ObjectId))));
            });
            test("exui/5: IDs ignore order of pages, popups and elements, texts and geometry", () =>
            {
                using var original = ExuiPackage.Load(Zip(work, Files()));
                var f = Files();
                Edit(f, "screen.json", n =>
                {
                    foreach (string list in new[] { "pages", "popups" })
                    {
                        var arr = n[list]!.AsArray(); var items = arr.Reverse().Select(x => x!.DeepClone()).ToArray(); arr.Clear();
                        foreach (var c in items)
                        {
                            var els = c["elements"]!.AsArray(); var es = els.Reverse().Select(x => x!.DeepClone()).ToArray(); els.Clear();
                            foreach (var e in es)
                            {
                                if (e["kind"]!.GetValue<string>() != "popup-ref") { e["rect"]![0] = (int)e["rect"]![0]! + 1; e["name"] = (string)e["name"]! + " v2"; }
                                if (e["states"] is JsonArray states) foreach (var s in states) s!["text"] = "Другое " + (string)s["name"]!;
                                els.Add(e);
                            }
                            arr.Add(c);
                        }
                    }
                });
                using var changed = ExuiPackage.Load(Zip(work, f));
                Check(Ids(changed.Plan).OrderBy(x => x.Key).SequenceEqual(Ids(original.Plan).OrderBy(x => x.Key)));
                Check(changed.Plan.Containers.OrderBy(c => c.Key).Select(c => (c.Key, c.ObjectId)).SequenceEqual(original.Plan.Containers.OrderBy(c => c.Key).Select(c => (c.Key, c.ObjectId))));
                Check(changed.Plan.Pages[0].Key == "page.sources", "order really changed");
            });
            test("exui/5: ID map lists every control ID and says navigation is not stored in GDL", () =>
            {
                using var p = ExuiPackage.Load(Zip(work, Files()));
                string map = IdMap.Markdown(p.Plan, p.Profile.Panel);
                foreach (var id in p.Plan.Containers.SelectMany(c => c.Elements).Where(e => e.ControlId != 0).Select(e => e.ControlId)) Check(map.Contains($"| {id} |"), id.ToString());
                Check(map.Contains("в GDL переходы не хранятся") && map.Contains("модальный popup") && map.Contains("| Источники | 1 |"));
            });

            var cases = new (string Name, string Code, string? Fragment, Action<Dictionary<string, byte[]>> Edit)[]
            {
                ("v1 manifest with v2 screen", "package-schema", null, f => Edit(f, "manifest.json", n => n["schema"] = "exui/1")),
                ("unknown contract", "package-schema", null, f => Edit(f, "manifest.json", n => n["schema"] = "exui/3")),
                ("popup-ref inside a popup", "package-schema", null, f => Edit(f, "screen.json", n => Popup(n, "popup.volume")["elements"]!.AsArray().Add(Element(Page(n, "page.home"), "home.volume-ref").DeepClone()))),
                ("popup-ref with control ID", "package-schema", null, f => Edit(f, "screen.json", n => Element(Page(n, "page.home"), "home.volume-ref")["controlId"] = 9000)),
                ("unknown popup property", "package-schema", null, f => Edit(f, "screen.json", n => Popup(n, "popup.volume")["timeout"] = 5)),
                ("modal popup with size", "spec", "full-canvas and ungrouped", f => Edit(f, "screen.json", n => Popup(n, "popup.confirm")["size"] = new JsonArray(100, 100))),
                ("standard popup without size", "spec", ".size", f => Edit(f, "screen.json", n => Popup(n, "popup.volume").AsObject().Remove("size"))),
                ("reference to a modal popup", "spec", "is modal", f => Edit(f, "screen.json", n => Element(Page(n, "page.home"), "home.volume-ref")["popup"] = "popup.confirm")),
                ("direct reference to a grouped popup", "spec", "reference the group", f => Edit(f, "screen.json", n =>
                {
                    var r = Element(Page(n, "page.sources"), "sources.group-ref"); r.AsObject().Remove("group"); r["popup"] = "popup.sources-1";
                })),
                ("reference naming popup and group", "spec", "exactly one popup or one group", f => Edit(f, "screen.json", n => Element(Page(n, "page.home"), "home.volume-ref")["group"] = "group.sources")),
                ("reference size differs from popup", "spec", "must equal the size", f => Edit(f, "screen.json", n => Element(Page(n, "page.home"), "home.volume-ref")["rect"]![2] = 500)),
                ("standard popup placed nowhere", "spec", "needs a popup-ref", f => Edit(f, "screen.json", n => Page(n, "page.home")["elements"]!.AsArray().Remove(Element(Page(n, "page.home"), "home.volume-ref")))),
                ("group without members", "spec", "at least one member", f => Edit(f, "screen.json", n => n["groups"]!.AsArray().Add(JsonNode.Parse("{\"key\":\"group.empty\",\"groupId\":2,\"name\":\"Пусто\"}")))),
                ("members of different size", "spec", "share one size", f => Edit(f, "screen.json", n => Popup(n, "popup.sources-2")["size"]![1] = 300)),
                ("navigation to an unknown target", "spec", "is not a page or popup", f => Edit(f, "screen.json", n => Element(Page(n, "page.home"), "nav.sources")["navigate"] = "page.missing")),
                ("navigation page nobody leads to", "spec", "no button navigates to it", f => Edit(f, "screen.json", n => Element(Page(n, "page.home"), "nav.sources").AsObject().Remove("navigate"))),
                ("two start pages", "spec", "only one page can be the start page", f => Edit(f, "screen.json", n => Page(n, "page.sources")["shownBy"] = "start")),
                ("no start page", "spec", "exactly one page needs", f => Edit(f, "screen.json", n => Page(n, "page.home")["shownBy"] = "program")),
                ("page and popup share an ID", "spec", "share one ID space", f => Edit(f, "screen.json", n => Popup(n, "popup.volume")["objectId"] = 100)),
                ("page and popup share a name", "spec", "share one namespace", f => Edit(f, "screen.json", n => Popup(n, "popup.volume")["name"] = "Главная")),
                ("popup named like the Offline page", "spec", "share one namespace", f => Edit(f, "screen.json", n => Popup(n, "popup.volume")["name"] = "Offline Page")),
                ("Offline page ID", "package-schema", null, f => Edit(f, "screen.json", n => Popup(n, "popup.volume")["objectId"] = 65535)),
                ("control ID used on two containers", "spec", "already used by", f => Edit(f, "screen.json", n => Element(Popup(n, "popup.sources-2"), "source.tv")["controlId"] = 8101)),
                ("element outside its popup", "spec", "inside the 600x220", f => Edit(f, "screen.json", n => Element(Popup(n, "popup.volume"), "volume.mute")["rect"]![1] = 200)),
                ("navigate on a label", "package-schema", null, f => Edit(f, "screen.json", n => Element(Page(n, "page.home"), "home.title")["navigate"] = "page.sources")),
            };
            foreach (var c in cases)
                test("exui/5 refuses " + c.Name, () => { var f = Files(); c.Edit(f); Reject(c.Code, () => { using var p = ExuiPackage.Load(Zip(work, f)); }, c.Fragment); });
            test("exui/1 package still refuses navigate (no silent upgrade)", () =>
            {
                string dir = Path.Combine(ScreenTests.Root, "examples", "exui-v1", "1025m");
                var f = Directory.GetFiles(dir, "*", SearchOption.AllDirectories).ToDictionary(x => Path.GetRelativePath(dir, x).Replace('\\', '/'), File.ReadAllBytes);
                Edit(f, "screen.json", n => n["elements"]![0]!["navigate"] = "page.home");
                Reject("package-schema", () => { using var p = ExuiPackage.Load(Zip(work, f)); });
            });
        }
        finally { Directory.Delete(work, true); }
    }

    public static void Graph(Action<string, Action> test, string realGdl)
    {
        test("PBImage reader resolves the visible background image in the stock project", () =>
        {
            // GUI Designer's PBImage paints the background image fields, while
            // PBButton states paint buttonImageField. This stock fixture was
            // authored by GUI Designer, independently of our writer.
            var model = ProjectModel.Read(ExtronContainer.ReadFile(realGdl).Payload);
            var image = model.Popups.Single(p => p.Name == "Confirmation").Controls.Single(c => c.Type == "PBImage" && c.Name == "Image1");
            Check(image.Graphic?.Image == "1600x2400_bg1-default.png");
            Check(image.Graphic?.Layout == 0 && image.Graphic.Alignment == 3);
        });
        test("Graph compare: same payload equal, edited label reported at its path, record IDs ignored", () =>
        {
            var payload = ExtronContainer.ReadFile(realGdl).Payload;
            Check(NrbfGraph.Compare(payload, payload).Count == 0);
            var edit = ButtonTextEditor.Edit(payload, 8000, "Press to begin", "Музыка");
            var diffs = NrbfGraph.Compare(payload, edit.Payload);
            Check(diffs.Count >= 1 && diffs.All(d => d.Path.EndsWith("textField", StringComparison.Ordinal) && d.Right == "Музыка"), string.Join("; ", diffs.Select(d => d.Path)));
        });
    }

    public static void Integration(Action<string, Action> test, string registryPath)
    {
        var registry = DonorRegistry.Load(registryPath);
        var adapter = new ExtronAdapter(AdapterOptions.Default());
        string work = Directory.CreateTempSubdirectory("exui2-integration-").FullName;
        var protectedFiles = registry.Data.Donors.SelectMany(d => new[] { registry.Resolve(d.File), registry.Resolve(d.Preparation.Source) })
            .Concat(Directory.GetFiles(Path.Combine(ScreenTests.Root, "examples", "exui-v2"), "*", SearchOption.AllDirectories))
            .Distinct().ToDictionary(f => f, f => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(f))));
        try
        {
            foreach (string profile in new[] { "1025m", "300m" })
                test($"exui/5 generate {profile}: all bindings verified independently, deterministic, IDs stable", () =>
                {
                    string package = Zip(work, Files(profile)), output = Path.Combine(work, profile + ".gdl");
                    var a = PackageGenerator.Generate(registry, package, output, adapter);
                    var b = PackageGenerator.Generate(registry, package, Path.Combine(work, profile + "-repeat.gdl"), adapter);
                    Check(a.Contract == "exui/5" && a.Generation.Checks.All(c => c.Passed) && a.Generation.Checks.Count > 200);
                    Check(a.Generation.OutputSha256 == b.Generation.OutputSha256, "same input, same bytes");
                    var model = ProjectModel.Read(ExtronContainer.ReadFile(output).Payload);
                    Check(model.Pages.Count == 2 && model.Popups.Count == 5 && model.Groups!.Count == 1 && model.DefaultPage == 100);
                    // Reordered package: every container and control keeps key, objectId and controlId.
                    var f = Files(profile);
                    Edit(f, "screen.json", n =>
                    {
                        foreach (string list in new[] { "pages", "popups" })
                        {
                            var arr = n[list]!.AsArray(); var items = arr.Reverse().Select(x => x!.DeepClone()).ToArray(); arr.Clear();
                            foreach (var c in items)
                            {
                                var els = c["elements"]!.AsArray(); var es = els.Reverse().Select(x => x!.DeepClone()).ToArray(); els.Clear();
                                foreach (var e in es) { if (e["states"] is JsonArray st) foreach (var s in st) s!["text"] = "Изменено"; els.Add(e); }
                                arr.Add(c);
                            }
                        }
                    });
                    var changed = PackageGenerator.Generate(registry, Zip(work, f), Path.Combine(work, profile + "-reordered.gdl"), adapter);
                    var after = ProjectModel.Read(ExtronContainer.ReadFile(changed.Generation.Output).Payload);
                    Check(changed.Generation.Checks.All(c => c.Passed));
                    IEnumerable<(string?, ulong, ulong, ushort, string)> Map(ProjectModel m) => m.Pages.Concat(m.Popups)
                        .SelectMany(p => p.Controls.Select(c => (p.Comments, p.ObjectId, c.ObjectId, c.ControlId, c.Type))).OrderBy(x => x.Item2).ThenBy(x => x.Item3);
                    Check(Map(model).SequenceEqual(Map(after)));
                    Check(after.Pages[0].ObjectId == 101, "page order follows the package");
                });
            test("exui/5: a donor without popup sources is refused with donor-element; nothing written", () =>
            {
                string dir = Directory.CreateTempSubdirectory("exui2-registry-").FullName;
                try
                {
                    var json = JsonNode.Parse(File.ReadAllText(registryPath))!;
                    foreach (var d in json["donors"]!.AsArray()) d!["elements"]!.AsObject().Remove("popupReference");
                    File.WriteAllText(Path.Combine(dir, "donors.json"), json.ToJsonString());
                    File.Copy(Path.Combine(registry.BaseDir, "manifest.json"), Path.Combine(dir, "manifest.json"));
                    foreach (var d in registry.Data.Donors)
                    {
                        string target = Path.Combine(dir, d.File); Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                        File.Copy(registry.Resolve(d.File), target);
                    }
                    string output = Path.Combine(work, "no-popup-donor.gdl");
                    Reject("donor-element", () => PackageGenerator.Generate(DonorRegistry.Load(Path.Combine(dir, "donors.json")), Zip(work, Files()), output, adapter));
                    Check(!File.Exists(output) && !File.Exists(output + ".report.json"));
                }
                finally { Directory.Delete(dir, true); }
            });
            test("exui/5: donors, sources and examples unchanged", () =>
                Check(protectedFiles.All(f => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(f.Key))) == f.Value)));
        }
        finally { Directory.Delete(work, true); }
    }

    /// <summary>pages-popups-*.gdl after the user's Save and Build in GUI Designer.</summary>
    public static void GuiBuilt(Action<string, Action> test, string folder, string registryPath)
    {
        var registry = DonorRegistry.Load(registryPath);
        foreach (string profile in new[] { "1025m", "300m" })
        {
            string file = Path.Combine(folder, $"pages-popups-{profile}.gdl");
            if (!File.Exists(file)) continue;
            test($"exui/5 GUI-built {profile}: Build output, artwork, modal references added by Build, bindings intact", () =>
            {
                var c = ExtronContainer.ReadFile(file);
                Check(c.HasBuildOutput, "Save and Build entry");
                var model = ProjectModel.Read(c.Payload);
                string temp = Directory.CreateTempSubdirectory("exui2-built-").FullName;
                using var package = ExuiPackage.Load(Zip(temp, Files(profile)));
                Directory.Delete(temp, true);
                var donor = registry.LoadDonor(package.Profile.Id);
                var failed = ScreenVerifier.Verify(package.Plan, model, donor.Model, donor.Entry.Profile, afterGuiBuild: true)
                    .Concat(ScreenGenerator.BoundsChecks(model)).Where(x => !x.Passed).ToArray();
                Check(failed.Length == 0, string.Join("; ", failed.Select(x => $"{x.Id}: {x.Detail}")));
                var modal = package.Plan.Popups.Where(p => p.Modal).Select(p => (ulong)p.ObjectId).ToHashSet();
                foreach (var page in model.Pages)
                    Check(modal.All(id => page.Controls.Any(x => x.PopupBinding is { Modal: true } b && b.PopupId == id)), $"{page.Name}: Build reference to every modal popup");
                Check(model.Pages.Concat(model.Popups).Where(p => p.ObjectId != 65535).SelectMany(p => p.Controls)
                    .Where(x => x.Type != "PBPopupPageReference").All(x => x.TlpImageId > 0), "Build artwork on every authored control");
            });
        }
    }
}
