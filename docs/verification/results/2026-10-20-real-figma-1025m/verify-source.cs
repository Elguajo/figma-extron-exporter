using System.Formats.Nrbf;
using System.Text.Json;
using ExtronExporter.Adapter;
using ExtronExporter.Format;
using ExtronExporter.Screen;
var folder="output/figma-live-1025m-20261020/";
using var package=ExuiPackage.Load(folder+"actual-volume-1025m-wide.exui");
var donor=DonorRegistry.Load("samples/donors.json").LoadDonor("tlp-pro-1025m");
var before=ProjectModel.Read(ExtronContainer.ReadFile(folder+"actual-volume-1025m.gdl").Payload);
using var first=ExuiPackage.Load(folder+"actual-volume-1025m.exui");
var originalFailure=ScreenVerifier.Verify(first.Plan,before,donor.Model,donor.Entry.Profile).Where(c=>!c.Passed).ToArray();
if(!originalFailure.Any(c=>c.Id.EndsWith(".image")))throw new Exception("Invisible logo not rejected");
var final=ProjectModel.Read(ExtronContainer.ReadFile(folder+"volume-final.gdl").Payload);
var finalChecks=ScreenVerifier.Verify(package.Plan,final,donor.Model,donor.Entry.Profile);
if(finalChecks.Any(c=>!c.Passed))throw new Exception("Generated final file failed");
var expected=package.Plan with { Pages=package.Plan.Pages.Select(pg=>pg with { Elements=pg.Elements.Select(e=>e.Kind switch {
 "slider"=>e with { Native=e.Native! with { ThumbWidth=32 } },
 "value"=>e with { Text="43%" },
 "button" when e.Key=="homevolumeready.volumeup"=>e with { States=e.States!.Select(s=>s with { Text="UP" }).ToArray() },
 _=>e }).ToArray() }).ToArray() };
var builtFile=ExtronContainer.ReadFile(folder+"volume-final-gui.gdl");
var built=ProjectModel.Read(builtFile.Payload);
var builtChecks=ScreenVerifier.Verify(expected,built,donor.Model,donor.Entry.Profile,afterGuiBuild:true);
if(builtChecks.Any(c=>!c.Passed))throw new Exception(JsonSerializer.Serialize(builtChecks.Where(c=>!c.Passed)));
using var stream=new MemoryStream(builtFile.Payload);
NrbfDecoder.Decode(stream,out var records);
ClassRecord Named(string type,string name)=>records.Values.OfType<ClassRecord>().Single(c=>c.TypeName.FullName=="Extron.GUICPro."+type && c.MemberNames.Any(n=>n.EndsWith("nameField") && Convert.ToString(c.GetRawValue(n))==name));
var label=Named("PBLabel","value_VolumeValue");
var flattened=(bool)label.GetRawValue(label.MemberNames.Single(n=>n.EndsWith("flattenTextField")))!;
if(flattened)throw new Exception("Value flattened");
if(!builtFile.HasBuildOutput||built.Build.StatusValue!=0)throw new Exception("Build not completed");
Console.WriteLine(JsonSerializer.Serialize(new { boundary="Real Figma Desktop 126.10.10, stock plugin 0.2.0, adapted user design copy; real GUI Designer 1.28.0.7; no hardware", package.Sha256,originalFailure,finalChecks,builtChecks,built.Build,entries=builtFile.Entries.Select(e=>e.Name),valueFlattened=flattened,controls=built.Pages[0].Controls.Select(c=>new{c.Name,c.ObjectId,c.ControlId,c.Text,c.TextAlignment,c.TlpImageId,c.Graphic,c.Native,c.States}) },new JsonSerializerOptions{WriteIndented=true}));
