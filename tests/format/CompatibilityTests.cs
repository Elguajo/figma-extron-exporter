using System.Text.Json.Nodes;
using ExtronExporter.Adapter;

static class CompatibilityTests
{
    static void Check(bool valid) { if (!valid) throw new Exception("Assertion failed"); }
    static void Code(string code, Action action)
    {
        try { action(); }
        catch (AdapterException e) when (e.Code == code) { return; }
        throw new Exception($"Expected AdapterException {code}");
    }

    static void WithFile(string text, Action<string> action)
    {
        string dir = Directory.CreateTempSubdirectory("exui-compatibility-").FullName;
        try
        {
            string path = Path.Combine(dir, "profiles.json");
            File.WriteAllText(path, text);
            action(path);
        }
        finally { Directory.Delete(dir, true); }
    }

    public static void Unit(Action<string, Action> test)
    {
        test("Compatibility: deployed baseline selects the exact installed build only", () =>
        {
            var data = Compatibility.Load();
            var p = Compatibility.Select(data, "1.28.0.7");
            Check(p.Status == "baseline");
            p.RequireDonorVersion("1.28.0.7");
            foreach (var version in new[] { "1.28.0.8", "1.29.0.0", "2.0.0.0", null })
                Code("extron-version", () => Compatibility.Select(data, version));
            Code("donor-version", () => p.RequireDonorVersion("1.29.0.0"));
        });
        const string candidate = """
            {"schemaVersion":1,"profiles":[{"id":"candidate","adapter":"gui-designer-nrbf-x86/1","guiDesignerVersion":"1.29.0.1","donorVersions":["1.28.0.7","1.29.0.1"],"status":"experimental"}]}
            """;
        test("Compatibility: a local profile routes a future build and explicitly allows older donors without rebuilding", () =>
            WithFile(candidate, path =>
            {
                var p = Compatibility.Select(Compatibility.Load(path), "1.29.0.1");
                Check(p.Id == "candidate" && p.Status == "experimental");
                p.RequireDonorVersion("1.28.0.7");
                p.RequireDonorVersion("1.29.0.1");
                Code("donor-version", () => p.RequireDonorVersion("1.27.0.0"));
            }));
        foreach (var (name, invalid) in new (string, string)[]
        {
            ("schema", candidate.Replace("\"schemaVersion\":1", "\"schemaVersion\":2")),
            ("adapter", candidate.Replace("gui-designer-nrbf-x86/1", "unknown/1")),
            ("range", candidate.Replace("1.29.0.1", "1.29.*")),
            ("short version", candidate.Replace("1.29.0.1", "1.29")),
            ("status", candidate.Replace("experimental", "automatically-verified")),
            ("typo", candidate.Replace("\"status\"", "\"staTus\"")),
            ("null profiles", """{"schemaVersion":1,"profiles":null}"""),
            ("null profile", """{"schemaVersion":1,"profiles":[null]}"""),
            ("empty profiles", """{"schemaVersion":1,"profiles":[]}"""),
            ("null donor versions", candidate.Replace("[\"1.28.0.7\",\"1.29.0.1\"]", "null")),
            ("ambiguous version", candidate.Replace("}]}", "},{\"id\":\"other\",\"adapter\":\"gui-designer-nrbf-x86/1\",\"guiDesignerVersion\":\"1.29.0.1\",\"donorVersions\":[\"1.29.0.1\"],\"status\":\"experimental\"}]}")),
            ("malformed JSON", "{")
        })
            test($"Compatibility: refuses {name}", () => WithFile(invalid, path => Code("compatibility-invalid", () => Compatibility.Load(path))));
        test("Compatibility: a missing explicit file never falls back to baseline", () =>
            Code("compatibility-missing", () => Compatibility.Load(Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".json"))));
        test("Compatibility: changed enum values require an adapter update", () =>
        {
            var result = JsonNode.Parse("""{"contract":{"enums":{"LevelDisplayTypeEnum":{"Gauge":0,"Slider":1},"LevelOrientationEnum":{"LeftToRight":0,"RightToLeft":1,"BottomToTop":2,"TopToBottom":3}}}}""")!.AsObject();
            Compatibility.ValidateProbe(result);
            result["contract"]!["enums"]!["LevelDisplayTypeEnum"]!["Slider"] = 7;
            Code("adapter-contract", () => Compatibility.ValidateProbe(result));
            Code("adapter-contract", () => Compatibility.ValidateProbe(new()));
        });
        test("Doctor: missing Extron returns actionable diagnostics; missing GCP is optional", () =>
        {
            var report = CompatibilityDoctor.Inspect(new(AdapterOptions.Default(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString()))), Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString()));
            Check(!report.Ready && !report.GuiDesigner.Exists && !report.Gcp.Exists && report.Checks.Single(c => c.Id == "gcp").Passed);
            Check(!report.GuiDesignerVerified && !report.GcpVerified && report.Probe == null);
        });
    }

    public static void Integration(Action<string, Action> test)
    {
        test("Doctor: real x86 contract probe is stable and never claims GUI or GCP verification", () =>
        {
            var adapter = new ExtronAdapter(AdapterOptions.Default());
            var a = CompatibilityDoctor.Inspect(adapter);
            var b = CompatibilityDoctor.Inspect(adapter, Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString()));
            Check(a.Ready && b.Ready && !b.Gcp.Exists && !a.GuiDesignerVerified && !a.GcpVerified);
            Check(a.Probe!["contract"]!["fingerprint"]!.GetValue<string>() == b.Probe!["contract"]!["fingerprint"]!.GetValue<string>());
            Check(a.Probe["contract"]!["components"]!.AsArray().Count == 2);
            Check(a.Probe["contract"]!["components"]!.AsArray().All(c => c!["sha256"]!.GetValue<string>() != a.Probe["contract"]!["fingerprint"]!.GetValue<string>()));
        });
        test("Doctor: explicit experimental profile is used without changing the bundled catalog", () =>
        {
            var profile = Compatibility.Select(Compatibility.Load(), "1.28.0.7");
            var data = new CompatibilityFile(1, [profile with { Id = "local-candidate", Status = "experimental" }]);
            string json = System.Text.Json.JsonSerializer.Serialize(data, ExtronAdapter.RequestJson);
            WithFile(json, path =>
            {
                var report = CompatibilityDoctor.Inspect(new(AdapterOptions.Default() with { CompatibilityPath = path }));
                Check(report.Ready && report.Profile!.Id == "local-candidate" && report.Profile.Status == "experimental");
                Check(report.Probe!["compatibility"]!["id"]!.GetValue<string>() == "local-candidate");
                Check(!report.GuiDesignerVerified && !report.GcpVerified);
                Check(Compatibility.Select(Compatibility.Load(), "1.28.0.7").Status == "baseline");
            });
        });
    }
}
