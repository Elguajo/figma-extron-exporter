using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ExtronExporter.Adapter;
using ExtronExporter.Format;
using ExtronExporter.Screen;

/// <summary>Checks of the multi-entry container, the screen description, the donor registry and the adapter boundary.</summary>
static class ScreenTests
{
    static void Check(bool valid, string what = "Assertion failed") { if (!valid) throw new Exception(what); }

    static T Throws<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T e) { return e; }
        throw new Exception($"Expected {typeof(T).Name}");
    }

    static void Code(string code, Action action)
    {
        var e = Throws<AdapterException>(action);
        if (e.Code != code) throw new Exception($"Expected code {code}, got {e.Code}: {e.Message}");
    }

    static void SpecError(string fragment, Action action)
    {
        var e = Throws<ScreenSpecException>(action);
        if (!e.Errors.Any(x => x.Contains(fragment, StringComparison.Ordinal))) throw new Exception($"No error containing '{fragment}': {string.Join(" | ", e.Errors)}");
    }

    // ---- multi-entry KP container ---------------------------------------------------------

    /// <summary>Standard ZIP turned into the observed KP profile by rewriting the signatures it declares.</summary>
    static byte[] Kp(params (string Name, byte[] Data)[] entries)
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
            foreach (var (name, data) in entries) { using var s = zip.CreateEntry(name, CompressionLevel.Optimal).Open(); s.Write(data); }
        var b = stream.ToArray();
        int end = b.Length - 22, count = BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(end + 10));
        int central = (int)BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(end + 16));
        void Sign(int p) { if (b[p] != 'P' || b[p + 1] != 'K') throw new Exception("not a signature"); b[p] = (byte)'K'; b[p + 1] = (byte)'P'; }
        int cursor = central;
        for (int i = 0; i < count; i++)
        {
            Sign((int)BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(cursor + 42)));
            int len = 46 + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(cursor + 28)) + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(cursor + 30)) + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(cursor + 32));
            Sign(cursor); cursor += len;
        }
        Sign(end);
        return b;
    }

    static readonly byte[] ProjectBytes = Encoding.UTF8.GetBytes("ProjectGCP payload / Музыка");
    static readonly byte[] BuiltBytes = Encoding.UTF8.GetBytes(new string('x', 5000) + "layout.json");

    static void Reject(byte[] bytes) => Throws<InvalidDataException>(() => ExtronContainer.Parse(bytes));

    static int CentralOf(byte[] b, int index)
    {
        int end = b.Length - 22, p = (int)BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(end + 16));
        for (int i = 0; i < index; i++)
            p += 46 + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(p + 28)) + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(p + 30)) + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(p + 32));
        return p;
    }

    public static void Container(Action<string, Action> test)
    {
        test("Multi-entry: ProjectGCP + build output parsed structurally", () =>
        {
            var c = ExtronContainer.Parse(Kp(("ProjectGCP", ProjectBytes), ("demo.tgz4", BuiltBytes)));
            Check(c.HasBuildOutput && c.Entries.Count == 2 && c.Payload.SequenceEqual(ProjectBytes) && c.ReadEntry("demo.tgz4").SequenceEqual(BuiltBytes));
            Check(c.Entries[1].RawBytes == BuiltBytes.Length && c.Entries[1].Crc32 == ExtronContainer.Crc32(BuiltBytes));
        });
        test("Multi-entry: repack with new payload keeps other entry bytes and fixes offsets", () =>
        {
            var source = Kp(("ProjectGCP", ProjectBytes), ("demo.tgz4", BuiltBytes));
            var c = ExtronContainer.Parse(source);
            byte[] longer = Encoding.UTF8.GetBytes(new string('Ж', 3000));
            var again = ExtronContainer.Parse(c.RepackWithPayload(longer));
            Check(again.Payload.SequenceEqual(longer) && again.ReadEntry("demo.tgz4").SequenceEqual(BuiltBytes));
            Check(ExtronContainer.Parse(again.Repack()).Payload.SequenceEqual(longer));
        });
        test("Multi-entry: reject ProjectGCP not first", () => Reject(Kp(("demo.tgz4", BuiltBytes), ("ProjectGCP", ProjectBytes))));
        test("Multi-entry: reject missing ProjectGCP", () => Reject(Kp(("a.tgz4", BuiltBytes), ("b.tgz4", BuiltBytes))));
        test("Multi-entry: reject duplicate entry names", () => Reject(Kp(("ProjectGCP", ProjectBytes), ("ProjectGCP", BuiltBytes))));
        test("Multi-entry: reject CRC mismatch in the second entry", () =>
        {
            var b = Kp(("ProjectGCP", ProjectBytes), ("demo.tgz4", BuiltBytes));
            int central = CentralOf(b, 1), local = (int)BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(central + 42));
            BinaryPrimitives.WriteUInt32LittleEndian(b.AsSpan(central + 16), 0xDEADBEEF);
            BinaryPrimitives.WriteUInt32LittleEndian(b.AsSpan(local + 14), 0xDEADBEEF);
            Reject(b);
        });
        test("Multi-entry: reject gap between entries", () =>
        {
            var b = Kp(("ProjectGCP", ProjectBytes), ("demo.tgz4", BuiltBytes));
            int central = CentralOf(b, 1);
            BinaryPrimitives.WriteUInt32LittleEndian(b.AsSpan(central + 42), BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(central + 42)) + 1);
            Reject(b);
        });
        test("Multi-entry: reject path-like entry name", () => Reject(Kp(("ProjectGCP", ProjectBytes), ("../x.tgz4", BuiltBytes))));
        test("Multi-entry: reject more than 16 entries", () =>
            Reject(Kp(new[] { ("ProjectGCP", ProjectBytes) }.Concat(Enumerable.Range(0, 16).Select(i => ($"{i}.tgz4", BuiltBytes))).ToArray())));
        test("Multi-entry: reject declared entry count larger than the directory", () =>
        {
            var b = Kp(("ProjectGCP", ProjectBytes), ("demo.tgz4", BuiltBytes));
            b[^14] = 3; b[^12] = 3; Reject(b);
        });
    }

    public static void BuiltProject(Action<string, Action> test, string path)
    {
        test("Real GUI Save and Build output: two entries, button 8000 still 'Музыка'", () =>
        {
            var c = ExtronContainer.ReadFile(path);
            Check(c.HasBuildOutput && c.Entries.Count == 2 && c.Entries[1].Name.EndsWith(".tgz4", StringComparison.Ordinal));
            var model = ProjectModel.Read(c.Payload);
            var start = model.Pages.SelectMany(p => p.Controls).Where(x => x.ControlId == 8000 && x.Type == "PBButton").ToArray();
            Check(start.Length == 1 && start[0].States.Count == 2 && start[0].States.All(s => s.Text == "Музыка"), "button 8000");
            ProjectInspection.Inspect(c.Payload);
            Check(ExtronContainer.Parse(c.Repack()).ReadEntry(c.Entries[1].Name).SequenceEqual(c.ReadEntry(c.Entries[1].Name)));
        });
    }

    /// <summary>Files generated by generate-screen and then saved with Save and Build in GUI Designer by the user.</summary>
    public static void GuiBuiltScreens(Action<string, Action> test, string folder, string registryPath)
    {
        var registry = DonorRegistry.Load(registryPath);
        string examples = ExampleDir("");
        foreach (var (example, donorId) in new[] { ("1025m", "tlp-pro-1025m"), ("300m", "tlp-pro-300m-portrait") })
        {
            string file = Path.Combine(folder, $"first-screen-{example}.gdl");
            test($"GUI-built {example}: Build output present, artwork assigned, description still matches", () =>
            {
                var c = ExtronContainer.ReadFile(file);
                Check(c.HasBuildOutput && c.Entries.Count == 2 && c.Entries[1].Name.EndsWith(".tgz4", StringComparison.Ordinal), "Save and Build entry");
                var model = ProjectModel.Read(c.Payload);
                var donor = registry.LoadDonor(donorId);
                var plan = ScreenSpecReader.Normalize(ScreenSpecReader.Load(Path.Combine(examples, $"screen-{example}.json")),
                    donor.Entry.Panel, donor.Entry.Profile.Width, donor.Entry.Profile.Height, examples);
                // afterGuiBuild: Build-owned differences (modal references, project ID, removed unused resources).
                var failed = ScreenVerifier.Verify(plan, model, donor.Model, donor.Entry.Profile, afterGuiBuild: true)
                    .Concat(ScreenGenerator.BoundsChecks(model)).Where(x => !x.Passed).ToArray();
                Check(failed.Length == 0, string.Join("; ", failed.Select(x => $"{x.Id}: {x.Detail}")));
                var controls = model.Pages.Single().Controls;
                Check(controls.All(x => x.TlpImageId > 0), "every control has Build artwork");
                foreach (var button in controls.Where(x => x.Type == "PBButton"))
                    Check(button.States.Select(s => s.TlpImageId).Distinct().Count() == button.States.Count && button.States.All(s => s.TlpImageId > 0),
                        $"{button.Name}: each state rasterized separately");
            });
        }
    }

    // ---- screen description ----------------------------------------------------------------

    static JsonObject Spec(string example) => JsonNode.Parse(File.ReadAllText(Path.Combine(ExampleDir(example), $"screen-{example}.json")))!.AsObject();
    static string ExampleDir(string _) => Path.Combine(Root, "examples", "first-screen");
    public static string Root = Directory.GetCurrentDirectory();

    static GeneratePlan Plan(JsonObject spec, string panel = "TLP Pro 1025M", int w = 1280, int h = 800, string? dir = null)
    {
        var parsed = JsonSerializer.Deserialize<ScreenSpec>(spec.ToJsonString(), ScreenSpecReader.Json)!;
        return ScreenSpecReader.Normalize(parsed, panel, w, h, dir ?? ExampleDir(""));
    }

    static Dictionary<string, (ulong, int)> Ids(GeneratePlan plan) => plan.Elements.ToDictionary(e => e.Key, e => (e.ObjectId, e.ControlId));

    static JsonObject Element(JsonObject spec, string key) => spec["elements"]!.AsArray().Select(e => e!.AsObject()).Single(e => (string)e["key"]! == key);

    public static void Spec(Action<string, Action> test)
    {
        test("Spec: both examples normalize; four kinds present; Cyrillic kept", () =>
        {
            var plan = Plan(Spec("1025m"));
            Check(plan.Elements.Count == 4 && plan.Images.Count == 2 && plan.Page.ObjectId == 100);
            Check(plan.Elements.Select(e => e.Kind).OrderBy(k => k).SequenceEqual(new[] { "button", "button", "label", "level" }));
            Check(plan.Elements.Single(e => e.Key == "source.music").States!.All(s => s.Text == "Музыка"));
            var small = Plan(Spec("300m"), "TLP Pro 300M", 320, 480);
            Check(Ids(small).OrderBy(x => x.Key).SequenceEqual(Ids(plan).OrderBy(x => x.Key)), "both panels share IDs");
        });
        test("Spec: IDs do not depend on element order, text or coordinates", () =>
        {
            var baseline = Ids(Plan(Spec("1025m")));
            var spec = Spec("1025m");
            var elements = spec["elements"]!.AsArray();
            var items = elements.Select(e => e!.DeepClone()).Reverse().ToArray();
            elements.Clear(); foreach (var e in items) elements.Add(e);
            foreach (var e in elements.Select(e => e!.AsObject()))
            {
                e["name"] = (string)e["name"]! + " v2";
                var r = e["rect"]!.AsArray(); r[0] = (int)r[0]! + 7; r[1] = (int)r[1]! + 5;
                if (e["text"] != null) e["text"] = "Новый текст";
                foreach (var s in (e["states"]?.AsArray() ?? []).Select(s => s!.AsObject())) s["text"] = "Другая подпись " + (string)s["name"]!;
            }
            var changed = Plan(spec);
            Check(Ids(changed).OrderBy(x => x.Key).SequenceEqual(baseline.OrderBy(x => x.Key)));
            Check(changed.Elements.First().Key == "volume.mute", "order really changed");
        });
        test("Spec: panel name must match the donor", () => SpecError("donor is", () => Plan(Spec("300m"))));
        test("Spec: 1025M layout does not fit the 300M canvas", () =>
        {
            var spec = Spec("1025m"); spec["panel"] = "TLP Pro 300M";
            SpecError("must lie inside the 320x480 canvas", () => Plan(spec, "TLP Pro 300M", 320, 480));
        });
        test("Spec: duplicate key / objectId / controlId rejected", () =>
        {
            var a = Spec("1025m"); Element(a, "volume.mute")["key"] = "source.music"; SpecError("is used twice", () => Plan(a));
            var b = Spec("1025m"); Element(b, "volume.mute")["objectId"] = 1; SpecError("objectId: 1 is used twice", () => Plan(b));
            var c = Spec("1025m"); Element(c, "volume.mute")["controlId"] = 8101; SpecError("already used by source.music", () => Plan(c));
        });
        test("Spec: page objectId must fit the UInt16 start page and avoid Offline 65535", () =>
        {
            var a = Spec("1025m"); a["page"]!["objectId"] = 65535; SpecError("page.objectId", () => Plan(a));
            var b = Spec("1025m"); b["page"]!["objectId"] = null; SpecError("page.objectId", () => Plan(b));
        });
        test("Spec: controlId out of UInt16 range rejected", () =>
        {
            var a = Spec("1025m"); Element(a, "volume.level")["controlId"] = 70000; SpecError("controlId", () => Plan(a));
        });
        test("Spec: missing and non-PNG resources rejected", () =>
        {
            var a = Spec("1025m"); a["assets"]![0]!["file"] = "assets/missing.png"; SpecError("not found", () => Plan(a));
            string dir = Directory.CreateTempSubdirectory("exui-spec-").FullName;
            try
            {
                Directory.CreateDirectory(Path.Combine(dir, "assets"));
                File.WriteAllText(Path.Combine(dir, "assets", "note-light.png"), "not a png");
                File.Copy(Path.Combine(ExampleDir(""), "assets", "note-dark.png"), Path.Combine(dir, "assets", "note-dark.png"));
                SpecError("must be a PNG", () => Plan(Spec("1025m"), dir: dir));
            }
            finally { Directory.Delete(dir, true); }
            var c = Spec("1025m"); c["assets"]![0]!["file"] = "../assets/note-light.png"; SpecError("without '..'", () => Plan(c));
            var d = Spec("1025m"); Element(d, "source.music")["states"]![0]!["image"] = "icon.none"; SpecError("not declared", () => Plan(d));
        });
        test("Spec: button state roles keep press feedback apart from program feedback", () =>
        {
            var a = Spec("1025m"); Element(a, "source.music")["press"] = "On"; SpecError("not the pressed state", () => Plan(a));
            var b = Spec("1025m"); Element(b, "source.music")["states"]![1]!["role"] = "pressed"; SpecError("at most one pressed", () => Plan(b));
            var c = Spec("1025m"); Element(c, "source.music")["states"]![1]!["role"] = "normal"; SpecError("only state 0", () => Plan(c));
            var d = Spec("1025m"); var st = Element(d, "volume.mute")["states"]!.AsArray(); st[1]!["fill"] = (string)st[0]!["fill"]!;
            SpecError("look identical", () => Plan(d));
            var e = Spec("1025m"); Element(e, "volume.mute")["states"]!.AsArray().RemoveAt(2); Element(e, "volume.mute")["states"]!.AsArray().RemoveAt(1);
            SpecError("2..8 required", () => Plan(e));
        });
        test("Spec: kind-specific properties and unknown kinds rejected", () =>
        {
            var a = Spec("1025m"); Element(a, "volume.caption")["press"] = "Off"; SpecError("do not apply to label", () => Plan(a));
            var b = Spec("1025m"); Element(b, "volume.level")["kind"] = "unsupported"; SpecError("is not supported", () => Plan(b));
            var c = Spec("1025m"); Element(c, "volume.level")["min"] = 100; SpecError("min < max", () => Plan(c));
            var d = Spec("1025m"); Element(d, "volume.level")["display"] = "knob"; SpecError("slider or gauge", () => Plan(d));
        });
        test("Spec: unknown JSON property rejected (no silent typos)", () =>
        {
            string file = Path.GetTempFileName();
            try
            {
                var s = Spec("1025m"); Element(s, "volume.level")["orientaton"] = "left-to-right";
                File.WriteAllText(file, s.ToJsonString());
                SpecError("JSON", () => ScreenSpecReader.Load(file));
            }
            finally { File.Delete(file); }
        });
        test("Spec: NUL and broken Unicode text rejected", () =>
        {
            var a = Spec("1025m"); Element(a, "volume.caption")["text"] = "Гром\0"; SpecError("no NUL", () => Plan(a));
            // A lone surrogate cannot survive JSON text, so it is injected after parsing.
            var parsed = JsonSerializer.Deserialize<ScreenSpec>(Spec("1025m").ToJsonString(), ScreenSpecReader.Json)!;
            var broken = parsed with { Elements = parsed.Elements!.Select(e => e.Key == "volume.caption" ? e with { Text = "Гром\uD800" } : e).ToArray() };
            SpecError("no NUL", () => ScreenSpecReader.Normalize(broken, "TLP Pro 1025M", 1280, 800, ExampleDir("")));
        });
    }

    // ---- adapter boundary without Extron ----------------------------------------------------

    public static void Boundary(Action<string, Action> test)
    {
        test("Adapter: missing GUI Designer reported as extron-missing", () =>
        {
            var o = AdapterOptions.Default(Path.Combine(Path.GetTempPath(), "no-such-extron-" + Guid.NewGuid()));
            Code(OperatingSystem.IsWindows() && File.Exists(o.PowerShellPath) && File.Exists(o.HostScript) ? "extron-missing" : "host-missing",
                () => new ExtronAdapter(o).CheckEnvironment());
        });
        test("Adapter: missing 32-bit PowerShell reported as host-missing", () =>
        {
            var o = AdapterOptions.Default() with { PowerShellPath = Path.Combine(Path.GetTempPath(), "no-powershell.exe") };
            Code("host-missing", () => new ExtronAdapter(o).CheckEnvironment());
        });
        test("Adapter: host script is deployed with the build", () => Check(File.Exists(AdapterOptions.Default().HostScript)));
        test("Adapter: host script never automates GUI Designer or Build", () =>
        {
            string script = File.ReadAllText(AdapterOptions.Default().HostScript);
            foreach (string banned in new[] { "Start-Process", "SendKeys", "UIAutomation", "BuildProject", "BuildManager", "Invoke-Item" })
                Check(!script.Contains(banned, StringComparison.OrdinalIgnoreCase), banned);
        });
        test("Adapter: passive controls get an empty Text, never null (GCP blank-page regression)", () =>
        {
            string script = File.ReadAllText(AdapterOptions.Default().HostScript);
            foreach (string kind in new[] { "slider", "shape", "line", "graphic" })
            {
                int start = script.IndexOf($"        '{kind}' {{", StringComparison.Ordinal);
                Check(start >= 0, kind);
                int end = script.IndexOf("\n        }", start, StringComparison.Ordinal);
                string block = script[start..end];
                Check(block.Contains("Set-F $c 'textField' ''", StringComparison.Ordinal) && !block.Contains("'textField' $null", StringComparison.Ordinal), kind);
            }
        });
    }

    // ---- registry and donors (need the local, git-ignored donor files) ----------------------

    static string CopyRegistry(string registry, Action<JsonObject>? edit = null, bool corruptDonor = false)
    {
        string dir = Directory.CreateTempSubdirectory("exui-registry-").FullName;
        string baseDir = Path.GetDirectoryName(Path.GetFullPath(registry))!;
        var json = JsonNode.Parse(File.ReadAllText(registry))!.AsObject();
        edit?.Invoke(json);
        File.WriteAllText(Path.Combine(dir, "donors.json"), json.ToJsonString());
        File.Copy(Path.Combine(baseDir, "manifest.json"), Path.Combine(dir, "manifest.json"));
        foreach (var d in json["donors"]!.AsArray())
        {
            string file = (string)d!["file"]!, target = Path.Combine(dir, file);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(Path.Combine(baseDir, file), target);
            if (corruptDonor) { var b = File.ReadAllBytes(target); b[^30] ^= 1; File.WriteAllBytes(target, b); }
        }
        return Path.Combine(dir, "donors.json");
    }

    static void Cleanup(string registry) => Directory.Delete(Path.GetDirectoryName(registry)!, true);

    public static void Registry(Action<string, Action> test, string registryPath)
    {
        var registry = DonorRegistry.Load(registryPath);
        foreach (var d in registry.Data.Donors)
            test($"Donor {d.Id}: hash pinned, profile {d.Profile.PlatformClass} {d.Profile.Width}x{d.Profile.Height} read independently", () =>
            {
                var donor = registry.LoadDonor(d.Id);
                Check(donor.Model.Platform.PartNumber == d.Profile.PartNumber && donor.Model.Pages.Select(p => p.Name).SequenceEqual(d.Preparation.KeepPages)
                    && donor.Model.Popups.Select(p => (long)p.ObjectId).OrderBy(x => x).SequenceEqual(d.Preparation.KeepPopupIds.OrderBy(x => x)));
                Check(ScreenGenerator.BoundsChecks(donor.Model).All(c => c.Passed), "every donor control inside the canvas");
            });
        test("Registry: unknown donor refused", () => Code("donor-unknown", () => registry.LoadDonor("tlp-pro-9999")));
        test("Registry: declared donor version must match the pinned project's real version", () =>
        {
            string copy = CopyRegistry(registryPath, j => j["guiDesignerVersion"] = "1.29.0.1");
            try { Code("donor-version", () => DonorRegistry.Load(copy).LoadDonor("tlp-pro-1025m")); }
            finally { Cleanup(copy); }
        });
        test("Verifier: app version follows the explicit donor contract, not a hardcoded GUI build", () =>
        {
            var donor = registry.LoadDonor("tlp-pro-1025m");
            var model = donor.Model with { AppVersion = "1.29.0.1" };
            Check(ScreenVerifier.ProfileChecks(model, donor.Entry.Profile, "1.29.0.1").All(c => c.Passed));
            Check(!ScreenVerifier.ProfileChecks(model, donor.Entry.Profile, "1.28.0.7").Single(c => c.Id == "profile.app-version").Passed);
        });
        test("Registry: modified donor refused before deserialization", () =>
        {
            string copy = CopyRegistry(registryPath, corruptDonor: true);
            try { Code("donor-hash", () => DonorRegistry.Load(copy).LoadDonor("tlp-pro-1025m")); } finally { Cleanup(copy); }
        });
        test("Registry: unpinned donor refused", () =>
        {
            string copy = CopyRegistry(registryPath, j => j["donors"]![0]!["sha256"] = null);
            try { Code("donor-unpinned", () => DonorRegistry.Load(copy).LoadDonor((string)JsonNode.Parse(File.ReadAllText(copy))!["donors"]![0]!["id"]!)); } finally { Cleanup(copy); }
        });
        test("Registry: renaming the model is not enough - profile mismatch detected", () =>
        {
            // Claim the 300M donor is a 1025M: the file's real platform says otherwise.
            string copy = CopyRegistry(registryPath, j =>
            {
                var d = j["donors"]!.AsArray().Single(x => (string)x!["id"]! == "tlp-pro-300m-portrait")!;
                d["panel"] = "TLP Pro 1025M";
                d["profile"] = JsonNode.Parse("""{"panel":"TLP Pro 1025M","platformClass":"PBTLP1025MPlatform","platformType":"TLP1025M","platformTypeValue":30,"partNumber":"60-1566-02","width":1280,"height":800}""");
            });
            try { Code("profile-mismatch", () => DonorRegistry.Load(copy).LoadDonor("tlp-pro-300m-portrait")); } finally { Cleanup(copy); }
        });
        test("Registry: preparation source must be an immutable manifest entry", () =>
        {
            var entry = registry.Data.Donors[0];
            Check(registry.LoadSource(entry).Bytes.Length > 0);
            Code("source-hash", () => registry.LoadSource(entry with { Preparation = entry.Preparation with { SourceSha256 = new string('0', 64) } }));
        });
        test("Registry: paths escaping the registry folder refused", () =>
        {
            Code("registry-invalid", () => registry.Resolve("../outside.gdl"));
            Code("registry-invalid", () => registry.Resolve(Path.GetFullPath("outside.gdl")));
        });
    }

    // ---- real generation through the installed GUI Designer (opt-in) ------------------------

    static string Sha(string file) => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file)));

    public static void Integration(Action<string, Action> test, string registryPath)
    {
        var registry = DonorRegistry.Load(registryPath);
        var adapter = new ExtronAdapter(AdapterOptions.Default());
        string work = Directory.CreateTempSubdirectory("exui-gen-").FullName;
        var protectedFiles = registry.Data.Donors.SelectMany(d => new[] { registry.Resolve(d.File), registry.Resolve(d.Preparation.Source) })
            .Distinct().ToDictionary(f => f, Sha);
        string examples = ExampleDir("");
        string WriteSpec(string name, JsonObject spec)
        {
            string path = Path.Combine(examples, $".test-{name}-{Guid.NewGuid():N}.json");
            File.WriteAllText(path, spec.ToJsonString());
            return path;
        }
        try
        {
            foreach (var (example, donor, panel) in new[] { ("1025m", "tlp-pro-1025m", "TLP Pro 1025M"), ("300m", "tlp-pro-300m-portrait", "TLP Pro 300M") })
            {
                test($"Generate {panel}: independent verification passes, deterministic output", () =>
                {
                    string spec = Path.Combine(examples, $"screen-{example}.json");
                    var a = ScreenGenerator.Generate(registry, donor, spec, Path.Combine(work, $"{example}-a.gdl"), adapter);
                    var b = ScreenGenerator.Generate(registry, donor, spec, Path.Combine(work, $"{example}-b.gdl"), adapter);
                    Check(a.Checks.All(c => c.Passed) && a.Checks.Count > 50);
                    Check(a.OutputSha256 == b.OutputSha256, "same input, same bytes");
                    var model = ProjectModel.Read(ExtronContainer.ReadFile(a.Output).Payload);
                    Check(model.Platform.PartNumber == registry.Find(donor).Profile.PartNumber && model.Pages.Single().Controls.Count == 4);
                    Code("output-exists", () => ScreenGenerator.Generate(registry, donor, spec, a.Output, adapter));
                });
            }
            test("Generate: IDs survive reordering, new text and moved elements", () =>
            {
                var spec = Spec("1025m");
                var elements = spec["elements"]!.AsArray();
                var items = elements.Select(e => e!.DeepClone()).Reverse().ToArray();
                elements.Clear(); foreach (var e in items) elements.Add(e);
                foreach (var e in elements.Select(e => e!.AsObject()))
                {
                    var r = e["rect"]!.AsArray(); r[0] = (int)r[0]! + 11; r[1] = (int)r[1]! + 13;
                    foreach (var s in (e["states"]?.AsArray() ?? []).Select(s => s!.AsObject())) s["text"] = "Изменено " + (string)s["name"]!;
                }
                Element(spec, "volume.caption")["text"] = "Уровень";
                string path = WriteSpec("ids", spec);
                try
                {
                    var original = ProjectModel.Read(ExtronContainer.ReadFile(Path.Combine(work, "1025m-a.gdl")).Payload).Pages.Single();
                    var r = ScreenGenerator.Generate(registry, "tlp-pro-1025m", path, Path.Combine(work, "ids.gdl"), adapter);
                    var changed = ProjectModel.Read(ExtronContainer.ReadFile(r.Output).Payload).Pages.Single();
                    var before = original.Controls.ToDictionary(c => c.Comments!, c => (c.ObjectId, c.ControlId, c.Type));
                    var after = changed.Controls.ToDictionary(c => c.Comments!, c => (c.ObjectId, c.ControlId, c.Type));
                    Check(before.OrderBy(x => x.Key).SequenceEqual(after.OrderBy(x => x.Key)));
                    Check(changed.ObjectId == original.ObjectId && changed.Controls[0].Comments == "exui-key=volume.mute");
                }
                finally { File.Delete(path); }
            });
            test("Generate: tampered expectation is caught by the verifier", () =>
            {
                var model = ProjectModel.Read(ExtronContainer.ReadFile(Path.Combine(work, "1025m-a.gdl")).Payload);
                var donor = registry.LoadDonor("tlp-pro-1025m");
                var plan = ScreenSpecReader.Normalize(ScreenSpecReader.Load(Path.Combine(examples, "screen-1025m.json")), "TLP Pro 1025M", 1280, 800, examples);
                var wrong = plan with { Pages = plan.Pages.Select(p => p with { Elements = p.Elements.Select(e => e.Key == "volume.mute" ? e with { ControlId = 8105 } : e).ToArray() }).ToArray() };
                Check(ScreenVerifier.Verify(plan, model, donor.Model, donor.Entry.Profile).All(c => c.Passed));
                Check(ScreenVerifier.Verify(wrong, model, donor.Model, donor.Entry.Profile).Single(c => !c.Passed).Id == "element.volume.mute.control-id");
            });
            foreach (var (name, edit, code) in new (string, Action<JsonObject>, string)[]
            {
                ("missing font family", s => Element(s, "volume.caption")["font"]!["family"] = "Comic Sans MS", "resource-missing"),
                ("resource name already in donor", s => s["assets"]![0]!["resourceName"] = "440x440_power.png", "resource-conflict"),
            })
                test($"Generate: host refuses {name} ({code}); nothing written", () =>
                {
                    var spec = Spec("1025m"); edit(spec);
                    string path = WriteSpec(code, spec), output = Path.Combine(work, $"{code}.gdl");
                    try { Code(code, () => ScreenGenerator.Generate(registry, "tlp-pro-1025m", path, output, adapter)); Check(!File.Exists(output)); }
                    finally { File.Delete(path); }
                });
            test("Generate: donor element missing reported as donor-element", () =>
            {
                string copy = CopyRegistry(registryPath, j =>
                {
                    foreach (var d in j["donors"]!.AsArray()) d!["elements"]!["level"]!["controlId"] = 9999;
                });
                try { Code("donor-element", () => ScreenGenerator.Generate(DonorRegistry.Load(copy), "tlp-pro-1025m", Path.Combine(examples, "screen-1025m.json"), Path.Combine(work, "noelem.gdl"), adapter)); }
                finally { Cleanup(copy); }
            });
            test("Generate: arbitrary external GDL never reaches the deserializer", () =>
            {
                // The only inputs are registry ids; a path or a foreign project is not an id.
                Code("donor-unknown", () => ScreenGenerator.Generate(registry, Path.Combine(Root, "samples", "original", "Full-Test-Project.gdl"),
                    Path.Combine(examples, "screen-1025m.json"), Path.Combine(work, "foreign.gdl"), adapter));
            });
            test("Generate: donors and local references unchanged", () =>
                Check(protectedFiles.All(f => Sha(f.Key) == f.Value)));
        }
        finally { Directory.Delete(work, true); }
    }
}
