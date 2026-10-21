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
    static string RealHome => Path.Combine(ScreenTests.Root, "verification", "results", "2026-10-20-full-home-1025m", "actual-home-1025m.exui");
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
        test("Real Figma Home layout v5: separate native overlays retain original positions", () =>
        {
            using var p = ExuiPackage.Load(Path.Combine(ScreenTests.Root, "verification", "results", "2026-10-21-home-layout-1025m", "actual-home-layout.exui"));
            Check(p.Contract == "exui/5" && p.Plan.Elements.Count == 47 && p.Plan.Images.Count == 15);
            Check(p.Plan.Elements.Count(e => e.Kind == "label") == 25 && p.Plan.Elements.Count(e => e.Kind == "value") == 3);
            var blank = p.Plan.Elements.Where(e => e.Kind == "button" && e.Name is not "button_VolumeUp" and not "button_VolumeDown").ToArray();
            Check(blank.Length == 11 && blank.All(e => e.States!.All(s => s.Text == "")));
            var title = p.Plan.Elements.Single(e => e.Name == "text_CH01Title");
            Check(title.Text == "Music" && title.Rect.SequenceEqual(new[] { 419, 319, 89, 29 }));
            var channel = p.Plan.Elements.Single(e => e.Name == "text_CH01Channel");
            Check(channel.Text == "CH 01" && channel.Rect.SequenceEqual(new[] { 364, 233, 64, 19 }));
            var hall = p.Plan.Elements.Single(e => e.Name == "value_SideHallStatus");
            Check(hall.ControlId == 8116 && hall.Text == "Music - 34%" && hall.Rect.SequenceEqual(new[] { 115, 227, 113, 19 }));
            Check(p.Plan.Elements.Single(e => e.Name == "value_SideTerraceStatus").ControlId == 8117);
            Check(p.Plan.Elements.Single(e => e.Name == "value_VolumeValue").Text == "42%");
            Check(p.Plan.Elements.Single(e => e.Name == "button_VolumeUp").States!.All(s => s.Text == "+"));
            Check(p.Plan.Elements.Single(e => e.Kind == "slider").Native!.ThumbWidth == 28);
        });
        test("Real Figma Home v5: complete screen, distinct states and clean volume values", () =>
        {
            using var p = ExuiPackage.Load(RealHome);
            Check(p.Contract == "exui/5" && p.Profile.Id == "tlp-pro-1025m");
            Check(p.Plan.Pages.Count == 1 && p.Plan.Elements.Count == 26 && p.Plan.Images.Count == 15);
            Check(p.Plan.Elements.Count(e => e.Kind == "button") == 13);
            Check(p.Plan.Elements.Count(e => e.Kind == "line") == 4);
            Check(p.Plan.Elements.Count(e => e.Kind == "label") == 6);
            var channels = p.Plan.Elements.Where(e => e.Name.StartsWith("button_CH", StringComparison.Ordinal)).ToArray();
            Check(channels.Length == 8 && channels.All(e => e.States!.Select(s => s.Name).SequenceEqual(new[] { "Normal", "state_Selected", "Pressed" })));
            Check(channels.All(e => e.States![0].Image != null && e.States[1].Image == null && e.States[2].Image == null && e.PressState == 2));
            var up = p.Plan.Elements.Single(e => e.Name == "button_VolumeUp");
            Check(up.ControlId == 8112 && up.States!.All(s => s.Text == "+") && up.PressState == 1);
            var value = p.Plan.Elements.Single(e => e.Kind == "value");
            Check(value.ControlId == 8114 && value.Text == "42%" && value.Rect.SequenceEqual(new[] { 904, 695, 110, 48 }));
            var slider = p.Plan.Elements.Single(e => e.Kind == "slider");
            Check(slider.ControlId == 8113 && slider.Native!.ThumbWidth == 28 && slider.Native.ThumbHeight == 28 && slider.Native.TrackWidth == 20);
            Check(p.Plan.Elements.Where(e => e.Font != null).All(e => e.Font!.Family == "Arial"));
            var mute = p.Plan.Elements.Single(e => e.Name == "button_Mute");
            Check(mute.ControlId == 8115 && mute.States!.Select(s => s.Name).SequenceEqual(new[] { "Off", "On", "Pressed" }));
        });
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
            Dictionary<string, byte[]> V3(bool two = true)
            {
                var f=Files();
                Edit(f,"manifest.json",n=>n["schema"]="exui/3");
                Edit(f,"screen.json",n=>
                {
                    n["schema"]="exui-screen/3";
                    if(two)foreach(var e in n["elements"]!.AsArray().Where(e=>(string?)e!["kind"]=="button"))
                    { e!["states"]!.AsArray().RemoveAt(2);e.AsObject().Remove("press"); }
                });
                return f;
            }
            test("Package v3 two-state Off/On buttons disable press feedback; IDs preserved",()=>
            {
                using var p=ExuiPackage.Load(Zip(work,V3()));
                Check(p.Contract=="exui/3");
                Check(p.Plan.Elements.Where(e=>e.Kind=="button").All(e=>e.PressState==-1&&e.States!.Count==2&&e.States.Select(s=>s.Name).SequenceEqual(new[]{"Off","On"})));
                using var old=ExuiPackage.Load(Zip(work,Files()));
                Check(p.Plan.Elements.Select(e=>(e.Key,e.ObjectId,e.ControlId)).SequenceEqual(old.Plan.Elements.Select(e=>(e.Key,e.ObjectId,e.ControlId))));
            });
            test("Package v3 three-state plan equals v1; existing contracts remain strict",()=>
            {
                using var p=ExuiPackage.Load(Zip(work,V3(false)));using var old=ExuiPackage.Load(Zip(work,Files()));
                Check(Signature(p.Plan)==Signature(old.Plan));
                var f=V3();Edit(f,"manifest.json",n=>n["schema"]="exui/1");Edit(f,"screen.json",n=>n["schema"]="exui-screen/1");
                Reject("package-schema",()=>{using var invalid=ExuiPackage.Load(Zip(work,f));});
            });
            foreach(var edit in new Action<Dictionary<string,byte[]>>[]
            {
                f=>Edit(f,"screen.json",n=>n["elements"]![0]!["press"]="On"),
                f=>Edit(f,"screen.json",n=>n["elements"]![0]!["states"]![1]!["role"]="pressed"),
                f=>Edit(f,"screen.json",n=>n["elements"]![0]!["states"]![1]!["stateId"]=0),
                f=>Edit(f,"screen.json",n=>n["schema"]="exui-screen/1")
            })test("Package v3 refuses invalid two-state press/identity/version",()=>
            {
                var f=V3();edit(f);bool rejected=false;
                try{using var p=ExuiPackage.Load(Zip(work,f));}catch(ExuiException){rejected=true;}catch(ScreenSpecException){rejected=true;}
                Check(rejected);
            });
            test("Package v3 still requires pressed reference when three states are present",()=>
            {
                var f=V3(false);Edit(f,"screen.json",n=>n["elements"]![0]!.AsObject().Remove("press"));
                Reject("spec",()=>{using var p=ExuiPackage.Load(Zip(work,f));});
            });
            Dictionary<string,byte[]> V4()
            {
                var f=V3(false);Edit(f,"manifest.json",n=>n["schema"]="exui/4");
                Edit(f,"screen.json",n=>
                {
                    n["schema"]="exui-screen/4";
                    var b=n["elements"]![0]!;b["states"]!.AsArray().RemoveAt(1);b["states"]![1]!["stateId"]=1;
                    n["elements"]!.AsArray().Add(new JsonObject { ["kind"]="graphic",["key"]="home.logo",["objectId"]=5,["controlId"]=null,["name"]="logo_Company",["rect"]=new JsonArray(0,0,64,64),["image"]="icon.note-dark" });
                });return f;
            }
            test("Package v4 resolves passive graphic and two-state momentary press index",()=>
            {
                using var p=ExuiPackage.Load(Zip(work,V4()));Check(p.Contract=="exui/4");
                var graphic=p.Plan.Elements.Single(e=>e.Kind=="graphic");Check(graphic.ControlId==0&&graphic.Image=="exui-note-dark.png"&&graphic.States==null);
                Check(p.Plan.Elements[0].States!.Select(s=>s.Role).SequenceEqual(new[]{"normal","pressed"})&&p.Plan.Elements[0].PressState==1);
            });
            foreach(var edit in new Action<Dictionary<string,byte[]>>[]
            {
                f=>Edit(f,"screen.json",n=>n["elements"]![4]!["controlId"]=8109),
                f=>Edit(f,"screen.json",n=>n["elements"]![4]!["image"]="icon.missing"),
                f=>Edit(f,"screen.json",n=>n["elements"]![4]!["rect"]![2]=63),
                f=>Edit(f,"screen.json",n=>n["elements"]![4]!["text"]="not an image"),
                f=>Edit(f,"screen.json",n=>n["elements"]![0]!.AsObject().Remove("press")),
                f=>Edit(f,"screen.json",n=>n["elements"]![0]!["states"]![1]!["stateId"]=2),
                f=>Edit(f,"screen.json",n=>n["schema"]="exui-screen/3")
            })test("Package v4 rejects malformed graphic, press or version",()=>
            {
                var f=V4();edit(f);bool rejected=false;
                try{using var p=ExuiPackage.Load(Zip(work,f));}catch(ExuiException){rejected=true;}catch(ScreenSpecException){rejected=true;}
                Check(rejected);
            });
            test("Package v3 remains strict: no momentary pair or standalone graphics",()=>
            {
                var f=V4();Edit(f,"manifest.json",n=>n["schema"]="exui/3");Edit(f,"screen.json",n=>{n["schema"]="exui-screen/3";n["elements"]!.AsArray().RemoveAt(4);});
                Reject("package-state",()=>{using var p=ExuiPackage.Load(Zip(work,f));});
            });
            Dictionary<string,byte[]> V5()
            {
                var f=V4();Edit(f,"manifest.json",n=>n["schema"]="exui/5");
                Edit(f,"screen.json",n=>
                {
                    n["schema"]="exui-screen/5";
                    n["elements"]!.AsArray().Add(JsonNode.Parse("""
                    {"kind":"slider","key":"home.custom-volume","objectId":6,"controlId":8206,"name":"slider_Volume","rect":[20,20,260,32],"orientation":"left-to-right","min":0,"max":100,"fillColor":"#F47700","native":{"trackColor":"#292D30","trackWidth":16,"thumbColor":"#FFFFFF","thumbWidth":28,"thumbHeight":28,"thumbType":"ellipse","radius":8}}
                    """)!);
                    var value=n["elements"]![1]!.DeepClone();value["kind"]="value";value["key"]="home.dynamic-value";value["objectId"]=7;value["controlId"]=8207;
                    value["behavior"]=new JsonObject { ["visible"]=false,["enabled"]=true };n["elements"]!.AsArray().Add(value);
                });return f;
            }
            test("Package v5 preserves editable Slider, dynamic label ID and programmer behavior",()=>
            {
                using var p=ExuiPackage.Load(Zip(work,V5()));Check(p.Contract=="exui/5");
                var slider=p.Plan.Elements.Single(e=>e.Kind=="slider");Check(slider.Native?.TrackWidth==16&&slider.Native.ThumbWidth==28&&slider.Min==0&&slider.Max==100);
                var value=p.Plan.Elements.Single(e=>e.Kind=="value");Check(value.ControlId==8207&&value.Behavior?.Visible==false);
                Check(IdMap.Markdown(p.Plan,p.Profile.Panel).Contains("Доступен при запуске"));
            });
            test("Package v5 accepts empty Button captions for independent text overlays",()=>
            {
                var f=V5();Edit(f,"screen.json",n=>{foreach(var state in n["elements"]![0]!["states"]!.AsArray())state!["text"]="";});
                using var p=ExuiPackage.Load(Zip(work,f));
                Check(p.Plan.Elements[0].States!.All(s=>s.Text==""));
                Check(p.Plan.Elements[1].Text!=null);
            });
            test("Package v4 still refuses empty Button captions",()=>
            {
                var f=V4();Edit(f,"screen.json",n=>n["elements"]![0]!["states"]![0]!["text"]="");
                Reject("package-schema",()=>{using var p=ExuiPackage.Load(Zip(work,f));});
            });
            test("Package v5 still refuses whitespace Button captions and empty labels",()=>
            {
                var f=V5();Edit(f,"screen.json",n=>n["elements"]![0]!["states"]![0]!["text"]=" ");
                Reject("spec",()=>{using var p=ExuiPackage.Load(Zip(work,f));});
                f=V5();Edit(f,"screen.json",n=>n["elements"]![1]!["text"]="");
                Reject("package-schema",()=>{using var p=ExuiPackage.Load(Zip(work,f));});
            });
            test("Package v5 uses the same validation for container form",()=>
            {
                var f=V5();Edit(f,"screen.json",n=>{var o=n.AsObject();var page=o["page"]!.DeepClone();page["shownBy"]="start";page["elements"]=o["elements"]!.DeepClone();o.Remove("page");o.Remove("elements");o["pages"]=new JsonArray(page);o["popups"]=new JsonArray();o["groups"]=new JsonArray();});
                using var p=ExuiPackage.Load(Zip(work,f));Check(p.Plan.Pages.Count==1&&p.Plan.Elements.Any(e=>e.Kind=="slider"));
            });
            test("Native Slider verifier rejects an invisible vector thumb with no resolvable bitmap",()=>
            {
                using var p=ExuiPackage.Load(Zip(work,V5()));
                var e=p.Plan.Elements.Single(e=>e.Kind=="slider");
                var control=new ControlModel("PBSlider",(ulong)e.ObjectId,(ushort)e.ControlId!,e.Name,"exui-key="+e.Key,
                    20,20,260,32,null,null,[],null,null,null,
                    Native:new NativeControlModel(27,false,null,0xFF292D30,0,new SliderModel(0,0,100,0xFFF47700,0xFFFFFFFF,0,28,28,16,null,1),null,null));
                var page=new ContainerModel("PBPage",100,100,"Home","exui-key=page.home",1280,800,0,[control]);
                var model=new ProjectModel("PBProject","Home","1.28.0.7",0,100,new BuildInfo(1,"0.0.0",null),
                    new PlatformProfile("PBTLP1025MPlatform",30,"60-1566-02",1280,800,1280,800),[page],[],[]);
                var expected=new ExpectedProfile("TLP Pro 1025M","PBTLP1025MPlatform","TLP1025M",30,"60-1566-02",1280,800);
                bool Geometry(ProjectModel m)=>ScreenVerifier.Verify(p.Plan,m,model,expected).Single(c=>c.Id=="element."+e.Key+".thumb-geometry-resource").Passed;
                Check(!Geometry(model));
                control=control with { Native=control.Native! with { Slider=control.Native!.Slider! with { ThumbImage="Slider Thumb" } } };
                model=model with { Pages=[page with { Controls=[control] }] };
                Check(!Geometry(model));
                Check(!Geometry(model with { Resources=[new ResourceModel("PBImageResource","Slider Thumb",0,64)] }));
                Check(Geometry(model with { Resources=[new ResourceModel("PBImageResource","Slider Thumb",64,64)] }));
                var rectangular=p.Plan with { Pages=p.Plan.Pages.Select(pg=>pg with { Elements=pg.Elements.Select(el=>el.Kind=="slider" ? el with { Native=el.Native! with { ThumbWidth=20 } } : el).ToArray() }).ToArray() };
                bool Aspect(double ratio)
                {
                    var resized=control with { Native=control.Native! with { Slider=control.Native!.Slider! with { ThumbWidth=20,ThumbAspectRatio=ratio } } };
                    var m=model with { Pages=[page with { Controls=[resized] }] };
                    return ScreenVerifier.Verify(rectangular,m,model,expected).Single(c=>c.Id=="element."+e.Key+".thumb-aspect-ratio").Passed;
                }
                Check(!Aspect(20d/28));Check(Aspect(28d/20));
            });
            foreach(var (name,code,change) in new (string,string,Action<JsonNode>)[]
            {
                ("missing ID","package-schema",n=>n["elements"]![6]!["controlId"]=null),
                ("duplicate ID","spec",n=>n["elements"]![6]!["controlId"]=8206),
                ("oversized thumb","spec",n=>n["elements"]![5]!["native"]!["thumbWidth"]=300),
                ("invalid range","spec",n=>n["elements"]![5]!["min"]=100),
                ("unknown native field","package-schema",n=>n["elements"]![5]!["native"]!["arbitraryField"]=true),
                ("inappropriate native appearance","package-schema",n=>n["elements"]![6]!["native"]=new JsonObject()),
                ("behavior on passive graphic","package-schema",n=>n["elements"]![4]!["behavior"]=new JsonObject{["enabled"]=false}),
                ("unknown behavior field","package-schema",n=>n["elements"]![6]!["behavior"]!["script"]="execute"),
                ("mixed single/project forms","package-schema",n=>{n["pages"]=new JsonArray();n["popups"]=new JsonArray();n["groups"]=new JsonArray();})
            })test("Package v5 rejects "+name,()=>{var f=V5();Edit(f,"screen.json",change);Reject(code,()=>{using var p=ExuiPackage.Load(Zip(work,f));});});
            test("Package v4 rejects v5 controls instead of silently lowering them",()=>
            {
                var f=V5();Edit(f,"manifest.json",n=>n["schema"]="exui/4");Edit(f,"screen.json",n=>n["schema"]="exui-screen/4");Reject("package-schema",()=>{using var p=ExuiPackage.Load(Zip(work,f));});
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
            test("Real Figma Home: deterministic native GDL with independent verification", () =>
            {
                var a = PackageGenerator.Generate(registry, RealHome, Path.Combine(work, "real-home.gdl"), adapter);
                var b = PackageGenerator.Generate(registry, RealHome, Path.Combine(work, "real-home-repeat.gdl"), adapter);
                Check(a.Generation.Checks.All(c => c.Passed) && a.Generation.OutputSha256 == b.Generation.OutputSha256);
                using var p = ExuiPackage.Load(RealHome);
                var donor = registry.LoadDonor("tlp-pro-1025m");
                var model = ProjectModel.Read(ExtronContainer.ReadFile(a.Generation.Output).Payload);
                Check(ScreenVerifier.Verify(p.Plan, model, donor.Model, donor.Entry.Profile).All(c => c.Passed));
                Check(model.Pages.Single().Controls.Count == 26);
                Check(!a.GuiDesignerVerified && !a.HardwareVerified);
            });
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
