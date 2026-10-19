using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ExtronExporter.Adapter;
using ExtronExporter.Format;
using ExtronExporter.Screen;

static class PackageTests
{
    static void Check(bool ok, string why = "Assertion failed") { if (!ok) throw new Exception(why); }
    static string Example(string p) => Path.Combine(ScreenTests.Root, "examples", "exui-v1", p);
    static Dictionary<string, byte[]> Files(string p = "1025m") => Directory.GetFiles(Example(p), "*", SearchOption.AllDirectories)
        .ToDictionary(f => Path.GetRelativePath(Example(p), f).Replace('\\', '/'), File.ReadAllBytes);
    static void Edit(Dictionary<string, byte[]> files, string name, Action<JsonNode> edit)
    {
        var node = JsonNode.Parse(files[name])!; edit(node); files[name] = Encoding.UTF8.GetBytes(node.ToJsonString());
    }
    static string Zip(string work, Dictionary<string, byte[]> files, string? duplicate = null)
    {
        string path = Path.Combine(work, Guid.NewGuid().ToString("N") + ".exui");
        using var output = File.Create(path);
        using var zip = new ZipArchive(output, ZipArchiveMode.Create);
        foreach (var (name, data) in files.Concat(duplicate == null ? [] : new[] { new KeyValuePair<string, byte[]>(duplicate, files.Values.First()) }))
        {
            var entry = zip.CreateEntry(name, CompressionLevel.NoCompression);
            entry.LastWriteTime = new DateTimeOffset(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);
            using var s = entry.Open(); s.Write(data);
        }
        return path;
    }
    static void Reject(string code, Action action)
    {
        try { action(); }
        catch (ExuiException e) { Check(e.Code == code, $"{e.Code}, expected {code}: {e.Message}"); return; }
        catch (ScreenSpecException) { Check(code == "spec"); return; }
        catch (AdapterException e) { Check(e.Code == code, e.Message); return; }
        throw new Exception("Expected refusal " + code);
    }
    static string Signature(GeneratePlan p) => System.Text.Json.JsonSerializer.Serialize(p with
    { Images = p.Images.Select(i => i with { File = Path.GetFileName(i.File) }).ToArray() });

    public static void Unit(Action<string, Action> test)
    {
        string work = Directory.CreateTempSubdirectory("exui-tests-").FullName;
        try
        {
            foreach (string profile in new[] { "1025m", "300m" })
                test($"Package {profile}: lowers to the exact experimental plan; resources cleaned up", () =>
                {
                    string resource;
                    using (var package = ExuiPackage.Load(Zip(work, Files(profile))))
                    {
                        var specPath = Path.Combine(ScreenTests.Root, "examples", "first-screen", $"screen-{profile}.json");
                        var plan = ScreenSpecReader.Normalize(ScreenSpecReader.Load(specPath), package.Profile.Panel, package.Profile.Width, package.Profile.Height, Path.GetDirectoryName(specPath)!);
                        Check(Signature(plan) == Signature(package.Plan));
                        resource = package.Plan.Images[0].File; Check(File.Exists(resource));
                    }
                    Check(!File.Exists(resource));
                });

            var cases = new (string Name, string Code, Action<Dictionary<string, byte[]>> Edit)[]
            {
                ("unknown contract", "package-schema", f => Edit(f,"manifest.json", n => n["schema"]="exui/2")),
                ("unsupported profile", "package-schema", f => Edit(f,"manifest.json", n => n["profile"]="tlp-pro-9999")),
                ("missing project", "package-schema", f => Edit(f,"screen.json", n => n.AsObject().Remove("project"))),
                ("null element", "package-schema", f => Edit(f,"screen.json", n => n["elements"]![0]=null)),
                ("unknown property", "package-schema", f => Edit(f,"screen.json", n => n["visible"]=false)),
                ("unsupported gauge", "package-schema", f => Edit(f,"screen.json", n => n["elements"]![2]!["display"]="gauge")),
                ("unsupported font", "package-schema", f => Edit(f,"screen.json", n => n["elements"]![1]!["font"]!["family"]="Other")),
                ("integer type", "package-schema", f => Edit(f,"screen.json", n => n["elements"]![0]!["objectId"]=1.5)),
                ("newline in semantic key", "package-schema", f => Edit(f,"screen.json", n => n["elements"]![0]!["key"]="source.music\n")),
                ("duplicate semantic key", "spec", f => Edit(f,"screen.json", n => n["elements"]![0]!["key"]="page.home")),
                ("duplicate objectId", "spec", f => Edit(f,"screen.json", n => n["elements"]![0]!["objectId"]=2)),
                ("duplicate controlId", "spec", f => Edit(f,"screen.json", n => n["elements"]![0]!["controlId"]=8103)),
                ("bounds", "spec", f => Edit(f,"screen.json", n => n["elements"]![0]!["rect"]![0]=1200)),
                ("overflow geometry", "package-schema", f => Edit(f,"screen.json", n => n["elements"]![0]!["rect"]![0]=int.MaxValue)),
                ("wrong state identity", "package-state", f => Edit(f,"screen.json", n => n["elements"]![0]!["states"]![1]!["stateId"]=2)),
                ("feedback used as press", "spec", f => Edit(f,"screen.json", n => n["elements"]![0]!["press"]="On")),
                ("pressed mixed with feedback", "package-state", f => Edit(f,"screen.json", n => n["elements"]![0]!["states"]![2]!["role"]="feedback")),
                ("missing image reference", "spec", f => Edit(f,"screen.json", n => n["elements"]![0]!["states"]![0]!["image"]="icon.missing")),
                ("resource name conflict", "spec", f => Edit(f,"screen.json", n => n["assets"]![1]!["resourceName"]="exui-note-light.png")),
                ("missing resource", "package-resource", f => f.Remove("assets/note-dark.png")),
                ("extra file", "package-entry", f => f.Add("plugin.dll", [1])),
                ("traversal", "package-entry", f => f.Add("../escape.png", [1])),
                ("backslash", "package-entry", f => f.Add("assets\\escape.png", [1])),
                ("absolute path", "package-entry", f => f.Add("C:/escape.png", [1])),
                ("directory", "package-entry", f => f.Add("assets/", [])),
                ("undeclared resource", "package-resource", f => f.Add("assets/extra.png", f["assets/note-dark.png"])),
                ("wrong SHA", "package-integrity", f => Edit(f,"manifest.json", n => n["resources"]![0]!["sha256"]=new string('0',64))),
                ("resource map mismatch", "package-resource", f => Edit(f,"screen.json", n => n["assets"]![0]!["file"]="assets/absent.png")),
                ("duplicate resource declaration", "package-resource", f => Edit(f,"manifest.json", n => n["resources"]!.AsArray().Add(n["resources"]![0]!.DeepClone()))),
                ("duplicate JSON", "package-json", f => f["manifest.json"]=Encoding.UTF8.GetBytes("{\"schema\":\"exui/1\",\"schema\":\"exui/2\"}")),
                ("malformed JSON", "package-json", f => f["screen.json"]=[0xFF]),
                ("expanded resource limit", "package-size", f => f["assets/note-dark.png"]=new byte[ScreenSpecReader.MaxImageBytes+1]),
            };
            foreach (var c in cases)
                test("Package refuses " + c.Name, () => { var f=Files(); c.Edit(f); Reject(c.Code, () => { using var p=ExuiPackage.Load(Zip(work,f)); }); });
            test("Package refuses duplicate/case-colliding ZIP paths", () =>
            {
                foreach (string name in new[] { "screen.json", "SCREEN.JSON", "assets/NOTE-dark.png" })
                    Reject("package-entry", () => { using var p=ExuiPackage.Load(Zip(work,Files(),name)); });
            });
            test("Package refuses corrupt PNG even with updated manifest SHA", () =>
            {
                var f=Files(); f["assets/note-dark.png"][40]^=1;
                Edit(f,"manifest.json",n => n["resources"]![1]!["sha256"]=Convert.ToHexString(SHA256.HashData(f["assets/note-dark.png"])));
                Reject("package-image", () => { using var p=ExuiPackage.Load(Zip(work,f)); });
            });
            test("Package refuses corrupt stored ZIP CRC", () =>
            {
                string path=Zip(work,Files()); var b=File.ReadAllBytes(path);
                int at=Array.IndexOf(b,(byte)'{'); b[at]^=1; File.WriteAllBytes(path,b);
                Reject("package-integrity",()=> { using var p=ExuiPackage.Load(path); });
            });
            test("Package JSON Schema integer semantics accept 1.0 and 1e0 without changing IDs", () =>
            {
                var f=Files();
                string text=Encoding.UTF8.GetString(f["screen.json"]).Replace("\"objectId\": 1,", "\"objectId\": 1.0,").Replace("\"objectId\": 2,", "\"objectId\": 2e0,");
                f["screen.json"]=Encoding.UTF8.GetBytes(text);
                using var p=ExuiPackage.Load(Zip(work,f));
                Check(p.Plan.Elements[0].ObjectId==1 && p.Plan.Elements[1].ObjectId==2);
            });
            test("Package never rounds a fractional ID to an integer", () =>
            {
                var f=Files();
                f["screen.json"]=Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(f["screen.json"]).Replace("\"objectId\": 1,", "\"objectId\": 1.0000000000000000000000000000001,"));
                Reject("package-schema",()=> { using var p=ExuiPackage.Load(Zip(work,f)); });
            });
            test("Package state order, text, geometry and element order cannot reassign IDs", () =>
            {
                var f=Files(); using var original=ExuiPackage.Load(Zip(work,f));
                Edit(f,"screen.json",n =>
                {
                    var elements=n["elements"]!.AsArray(); var reversed=elements.Reverse().Select(e=>e!.DeepClone()).ToArray();
                    elements.Clear(); foreach(var e in reversed) elements.Add(e);
                    foreach(var el in elements)
                    {
                        el!["rect"]![0]=(int)el["rect"]![0]!+1;
                        if(el["states"] is not JsonArray states) { if(el["text"]!=null) el["text"]="Уровень"; continue; }
                        var ss=states.Reverse().Select(s=>s!.DeepClone()).ToArray(); states.Clear();
                        foreach(var st in ss) { st["text"]="Изменено "+(string)st["name"]!; states.Add(st); }
                    }
                });
                using var changed=ExuiPackage.Load(Zip(work,f));
                Check(original.Plan.Elements.OrderBy(e=>e.Key).Select(e=>(e.Key,e.ObjectId,e.ControlId)).SequenceEqual(changed.Plan.Elements.OrderBy(e=>e.Key).Select(e=>(e.Key,e.ObjectId,e.ControlId))));
                Check(changed.Plan.Elements.Where(e=>e.Kind=="button").All(e=>e.PressState==2 && e.States!.Select(s=>s.Role).SequenceEqual(new[]{"normal","feedback","pressed"})));
            });
        }
        finally { Directory.Delete(work,true); }
    }

    public static void Integration(Action<string, Action> test, string registryPath)
    {
        var registry=DonorRegistry.Load(registryPath); var adapter=new ExtronAdapter(AdapterOptions.Default());
        string work=Directory.CreateTempSubdirectory("exui-integration-").FullName;
        var protectedFiles=registry.Data.Donors.SelectMany(d=>new[]{registry.Resolve(d.File),registry.Resolve(d.Preparation.Source)})
            .Concat(Directory.GetFiles(Example("1025m"),"*",SearchOption.AllDirectories)).Concat(Directory.GetFiles(Example("300m"),"*",SearchOption.AllDirectories))
            .Distinct().ToDictionary(f=>f,f=>Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(f))));
        try
        {
            foreach(string profile in new[]{"1025m","300m"})
                test($"Package generate {profile}: same GDL bytes as proven experiment, deterministic, full independent checks",()=>
                {
                    string package=Zip(work,Files(profile)), output=Path.Combine(work,profile+".gdl");
                    var a=PackageGenerator.Generate(registry,package,output,adapter);
                    var b=PackageGenerator.Generate(registry,package,Path.Combine(work,profile+"-repeat.gdl"),adapter);
                    string donor=profile=="1025m"?"tlp-pro-1025m":"tlp-pro-300m-portrait";
                    var experiment=ScreenGenerator.Generate(registry,donor,Path.Combine(ScreenTests.Root,"examples","first-screen",$"screen-{profile}.json"),Path.Combine(work,profile+"-experiment.gdl"),adapter);
                    Check(a.Generation.Checks.All(c=>c.Passed) && a.Generation.Checks.Count>=61);
                    Check(a.Generation.OutputSha256==b.Generation.OutputSha256 && a.Generation.OutputSha256==experiment.OutputSha256,"payload/container differ from existing generator");
                    Check(!a.GuiDesignerVerified && !a.HardwareVerified && File.Exists(output+".report.json"));
                    var changedFiles=Files(profile);
                    Edit(changedFiles,"screen.json",n=>
                    {
                        var elements=n["elements"]!.AsArray();
                        var reversed=elements.Reverse().Select(e=>e!.DeepClone()).ToArray(); elements.Clear();
                        foreach(var el in reversed)
                        {
                            el["rect"]![0]=(int)el["rect"]![0]!+1;
                            if(el["states"] is JsonArray states)
                            {
                                var ss=states.Reverse().Select(s=>s!.DeepClone()).ToArray(); states.Clear();
                                foreach(var st in ss) { st["text"]="Текст "+(string)st["name"]!; states.Add(st); }
                            }
                            elements.Add(el);
                        }
                    });
                    var changed=PackageGenerator.Generate(registry,Zip(work,changedFiles),Path.Combine(work,profile+"-changed.gdl"),adapter);
                    var before=ProjectModel.Read(ExtronContainer.ReadFile(output).Payload).Pages.Single();
                    var after=ProjectModel.Read(ExtronContainer.ReadFile(changed.Generation.Output).Payload).Pages.Single();
                    Check(changed.Generation.Checks.All(c=>c.Passed));
                    Check(before.Controls.OrderBy(c=>c.ObjectId).Select(c=>(c.Comments,c.ObjectId,c.ControlId,c.Type)).SequenceEqual(after.Controls.OrderBy(c=>c.ObjectId).Select(c=>(c.Comments,c.ObjectId,c.ControlId,c.Type))));
                    Check(after.Controls[0].Comments=="exui-key=volume.mute" && after.Controls[0].States.Select(s=>s.Id).SequenceEqual(new ulong[]{0,1,2}));
                    Reject("output-exists",()=>PackageGenerator.Generate(registry,package,output,adapter));
                    string reportOnly=Path.Combine(work,profile+"-blocked.gdl");File.WriteAllText(reportOnly+".report.json","keep");
                    Reject("output-exists",()=>PackageGenerator.Generate(registry,package,reportOnly,adapter)); Check(!File.Exists(reportOnly));
                    var f=Files(profile);Edit(f,"screen.json",n=>n["elements"]![0]!["controlId"]=8103);
                    string invalid=Path.Combine(work,profile+"-invalid.gdl");
                    Reject("spec",()=>PackageGenerator.Generate(registry,Zip(work,f),invalid,adapter));Check(!File.Exists(invalid) && !File.Exists(invalid+".report.json"));
                    string hostFailure=Path.Combine(work,profile+"-host-failure.gdl");
                    var missingAdapter=new ExtronAdapter(AdapterOptions.Default() with { InstallDir=Path.Combine(work,"missing-install") });
                    Reject("extron-missing",()=>PackageGenerator.Generate(registry,package,hostFailure,missingAdapter));
                    Check(!File.Exists(hostFailure) && !File.Exists(hostFailure+".report.json") && !Directory.GetDirectories(work,".exui-*").Any());
                });
            test("Package generation leaves sources, donors and examples unchanged",()=>Check(protectedFiles.All(f=>Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(f.Key)))==f.Value)));
        }
        finally {Directory.Delete(work,true);}
    }
}
