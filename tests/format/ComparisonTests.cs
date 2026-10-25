using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ExtronExporter.Screen;

static class ComparisonTests
{
    static void Check(bool ok, string why = "Assertion failed") { if (!ok) throw new Exception(why); }
    static JsonObject Container(JsonNode n, string key) => n["pages"]!.AsArray().Concat(n["popups"]!.AsArray()).Single(c => (string)c!["key"]! == key)!.AsObject();
    static JsonObject Element(JsonNode n, string key) => n["pages"]!.AsArray().Concat(n["popups"]!.AsArray())
        .SelectMany(c => c!["elements"]!.AsArray()).Single(e => (string)e!["key"]! == key)!.AsObject();
    static ComparisonItem Item(PackageComparisonReport r, string key) => r.Items.Single(i => i.Before?.Key == key || i.After?.Key == key);
    static bool Changed(ComparisonItem i, string field, string? severity = null) => i.Changes.Any(c => c.Field == field && (severity == null || c.Severity == severity));

    public static void Unit(Action<string, Action> test)
    {
        string work = Directory.CreateTempSubdirectory("exui-compare-tests-").FullName;
        try
        {
            string Write(string profile = "1025m", Action<JsonNode>? edit = null, Action<Dictionary<string, byte[]>>? filesEdit = null)
            {
                var files = CurrentPackageFixture.Read(Path.Combine(ScreenTests.Root, "tests", "fixtures", "exui-v2", profile));
                var screen = JsonNode.Parse(files["screen.json"])!; edit?.Invoke(screen);
                files["screen.json"] = Encoding.UTF8.GetBytes(screen.ToJsonString()); filesEdit?.Invoke(files);
                string path = Path.Combine(work, Guid.NewGuid().ToString("N") + ".exui");
                using var stream = File.Create(path);
                using var zip = new ZipArchive(stream, ZipArchiveMode.Create);
                foreach (var (name, data) in files) { using var entry = zip.CreateEntry(name).Open(); entry.Write(data); }
                return path;
            }
            PackageComparisonReport Compare(Action<JsonNode>? edit = null, string profile = "1025m")
            {
                using var before = ExuiPackage.Load(Write(profile)); using var after = ExuiPackage.Load(Write(profile, edit));
                return PackageComparison.Compare(before, after);
            }
            foreach (string profile in new[] { "1025m", "300m" })
            {
                test($"Comparison {profile}: identical normalized exports have no changes or GCP claim", () =>
                {
                    var r = Compare(profile: profile);
                    Check(!r.RequiresReview && !r.GcpVerified && r.ProjectChanges.Count == 0);
                    Check(r.Items.Count > 20 && r.Items.All(i => i.Status == "unchanged"));
                    Check(PackageComparison.Markdown(r).Contains("GCP не проверен"));
                });
                test($"Comparison {profile}: geometry, caption and paint preserve control identity", () =>
                {
                    var r = Compare(n => { var b = Element(n, "volume.mute"); b["rect"]![0] = 1; b["states"]![0]!["text"] = "Mute zone"; b["states"]![0]!["fill"] = "#123456"; }, profile);
                    var i = Item(r, "volume.mute");
                    Check(!r.RequiresReview && i.Before!.ControlId == 8104 && i.After!.ControlId == 8104);
                    Check(i.Changes.Count == 3 && i.Changes.All(c => c.Field.StartsWith("appearance.", StringComparison.Ordinal) && c.Severity == "info"));
                });
            }
            test("Comparison: renamed element and key are matched by original object identity", () =>
            {
                var r = Compare(n => { var b = Element(n, "volume.mute"); b["key"] = "volume.mute-zone"; b["name"] = "Mute zone"; });
                var i = Item(r, "volume.mute"); Check(i.MatchedBy == "objectId" && Changed(i, "key", "info") && Changed(i, "name", "review"));
                Check(i.After!.ControlId == 8104 && r.Items.All(i => i.Status is not "added" and not "removed"));
            });
            test("Comparison: renamed page updates references without losing its elements", () =>
            {
                var r = Compare(n =>
                {
                    var page = Container(n, "page.home"); page["key"] = "page.main"; page["name"] = "Main";
                    Element(n, "nav.back")["navigate"] = "page.main";
                    foreach (var e in page["elements"]!.AsArray()) e!["key"] = "main." + ((string)e["key"]!).Replace('.', '-');
                });
                Check(r.RequiresReview && Changed(Item(r, "page.home"), "name", "review"));
                Check(r.Items.All(i => i.Status is not "added" and not "removed"));
            });
            test("Comparison: add and delete buttons keeps unrelated assignments unchanged", () =>
            {
                var r = Compare(n =>
                {
                    var list = Container(n, "popup.volume")["elements"]!.AsArray();
                    var old = Element(n, "volume.mute"); var added = old.DeepClone(); list.Remove(old);
                    added["key"] = "volume.extra"; added["name"] = "Extra"; added["objectId"] = 99; added["controlId"] = 9000; list.Add(added);
                });
                Check(Item(r, "volume.mute").Status == "removed" && Item(r, "volume.extra").Status == "added");
                Check(Item(r, "source.music").Status == "unchanged" && r.RequiresReview);
            });
            test("Comparison: redraw with the same key and new ID is breaking", () =>
            {
                var r = Compare(n => { var b = Element(n, "volume.mute"); b["controlId"] = 9000; b["objectId"] = 99; });
                var i = Item(r, "volume.mute"); Check(i.MatchedBy == "key" && Changed(i, "controlId", "breaking") && Changed(i, "objectId", "review"));
            });
            test("Comparison: swapping two IDs is detected for both controls", () =>
            {
                var r = Compare(n => { Element(n, "source.music")["controlId"] = 8102; Element(n, "source.radio")["controlId"] = 8101; });
                foreach (string key in new[] { "source.music", "source.radio" }) Check(Changed(Item(r, key), "controlIdReuse", "breaking"));
            });
            test("Comparison: a reused ID with a different key and object is never declared unchanged", () =>
            {
                var r = Compare(n => { var b = Element(n, "volume.mute"); b["key"] = "volume.different"; b["name"] = "Different function"; b["objectId"] = 99; });
                var i = Item(r, "volume.mute"); Check(i.MatchedBy == "controlId-only" && Changed(i, "identity", "breaking") && r.RequiresReview);
            });
            test("Comparison: button replaced by a level retains ID but changes type", () =>
            {
                var r = Compare(n =>
                {
                    var b = Element(n, "volume.mute"); var level = Element(n, "volume.level").DeepClone().AsObject();
                    foreach (string f in new[] { "key", "name", "objectId", "controlId", "rect" }) level[f] = b[f]!.DeepClone();
                    b.ReplaceWith(level);
                });
                Check(Changed(Item(r, "volume.mute"), "kind", "breaking"));
            });
            test("Comparison: state removal and press mapping changes require review", () =>
            {
                var r = Compare(n => { var b = Element(n, "volume.mute"); b["states"]!.AsArray().RemoveAt(2); b.Remove("press"); });
                var i = Item(r, "volume.mute"); Check(Changed(i, "states", "breaking") && Changed(i, "pressState", "breaking"));
            });
            test("Comparison: state names matter independently of role and artwork", () =>
            {
                var r = Compare(n => Element(n, "volume.mute")["states"]![1]!["name"] = "Selected");
                Check(Changed(Item(r, "volume.mute"), "stateNames", "review"));
            });
            test("Comparison: explicit state IDs make input array order irrelevant", () =>
            {
                var r = Compare(n => { var s = Element(n, "volume.mute")["states"]!.AsArray(); var first = s[0]!; s.RemoveAt(0); s.Add(first); });
                Check(!r.RequiresReview && r.Items.All(i => i.Status == "unchanged"));
            });
            test("Comparison: range and feedback instructions are not merely appearance", () =>
            {
                var r = Compare(n => { var level = Element(n, "volume.level"); level["max"] = 255; level["behavior"] = JsonNode.Parse("{\"enabled\":false}"); });
                var i = Item(r, "volume.level"); Check(Changed(i, "range", "review") && Changed(i, "behavior", "review"));
            });
            test("Comparison: popup links and navigation targets require review", () =>
            {
                var r = Compare(n =>
                {
                    var extra = Container(n, "popup.volume").DeepClone(); extra["key"] = "popup.extra"; extra["objectId"] = 205;
                    extra["name"] = "Extra"; extra["shownBy"] = "program";
                    extra["elements"] = new JsonArray(Element(n, "volume.caption").DeepClone()); extra["elements"]![0]!["key"] = "extra.caption";
                    n["popups"]!.AsArray().Add(extra);
                    var original = Element(n, "home.volume-ref"); var keep = original.DeepClone(); keep["key"] = "home.keep-volume"; keep["objectId"] = 99;
                    Container(n, "page.home")["elements"]!.AsArray().Add(keep); original["popup"] = "popup.extra";
                    Element(n, "nav.volume")["navigate"] = "popup.extra"; Container(n, "popup.volume")["shownBy"] = "program";
                });
                Check(Changed(Item(r, "home.volume-ref"), "popup", "review") && Changed(Item(r, "nav.volume"), "navigate", "review"));
            });
            test("Comparison: moved control is found by key and container change is visible", () =>
            {
                var r = Compare(n => { var b = Element(n, "volume.mute"); var copy = b.DeepClone(); b.Parent!.AsArray().Remove(b); copy["objectId"] = 99; Container(n, "popup.sources-1")["elements"]!.AsArray().Add(copy); });
                Check(Changed(Item(r, "volume.mute"), "container", "review"));
            });
            test("Comparison: stacking order changes are not hidden by sorting", () =>
            {
                var r = Compare(n => { var list = Container(n, "popup.volume")["elements"]!.AsArray(); var first = list[0]!; list.RemoveAt(0); list.Add(first); });
                Check(Changed(Item(r, "popup.volume"), "stackingOrder", "review"));
            });
            test("Comparison: changed PNG bytes are compared by hash, not temporary paths", () =>
            {
                string old = Write();
                string newer = Write(filesEdit: files =>
                {
                    files["assets/note-light.png"] = files["assets/note-dark.png"];
                    var manifest = JsonNode.Parse(files["manifest.json"])!;
                    manifest["resources"]![0]!["sha256"] = Convert.ToHexString(SHA256.HashData(files["assets/note-light.png"]));
                    files["manifest.json"] = Encoding.UTF8.GetBytes(manifest.ToJsonString());
                });
                using var a = ExuiPackage.Load(old); using var b = ExuiPackage.Load(newer);
                var r = PackageComparison.Compare(a, b);
                Check(r.Items.Any(i => i.Changes.Any(c => c.Field.EndsWith(".image", StringComparison.Ordinal))) && !r.RequiresReview);
                string markdown = PackageComparison.Markdown(r); Check(!markdown.Contains("exui-package-") && !markdown.Contains(work));
            });
            test("Comparison: different panel profile is a breaking project change", () =>
            {
                using var a = ExuiPackage.Load(Write()); using var b = ExuiPackage.Load(Write("300m"));
                var r = PackageComparison.Compare(a, b); Check(r.RequiresReview && r.ProjectChanges.Any(c => c.Field == "profile" && c.Severity == "breaking"));
            });
            test("Comparison: start page changes are explicit", () =>
            {
                var r = Compare(n => { Container(n, "page.home")["shownBy"] = "program"; Container(n, "page.sources")["shownBy"] = "start"; });
                Check(r.ProjectChanges.Any(c => c.Field == "startPage" && c.Severity == "review"));
            });
            test("Comparison: deterministic output, immutable inputs and escaped Markdown cells", () =>
            {
                string aPath = Write(), bPath = Write(edit: n => Element(n, "volume.mute")["name"] = "Mute | <b>\nnext");
                byte[] aBytes = File.ReadAllBytes(aPath), bBytes = File.ReadAllBytes(bPath);
                using var a = ExuiPackage.Load(aPath); using var b = ExuiPackage.Load(bPath);
                var r = PackageComparison.Compare(a, b); string text = PackageComparison.Markdown(r);
                Check(text == PackageComparison.Markdown(PackageComparison.Compare(a, b)));
                Check(text.Contains("Mute &#124; &lt;b&gt;") && !text.Contains("Mute | <b>"));
                Check(File.ReadAllBytes(aPath).SequenceEqual(aBytes) && File.ReadAllBytes(bPath).SequenceEqual(bBytes));
            });
        }
        finally { Directory.Delete(work, true); }
    }
}
