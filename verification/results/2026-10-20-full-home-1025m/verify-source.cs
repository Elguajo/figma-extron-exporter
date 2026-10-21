using System.Text.Json;
using System.Formats.Nrbf;
using ExtronExporter.Adapter;
using ExtronExporter.Format;
using ExtronExporter.Screen;
using var package=ExuiPackage.Load(args[0]);
var donor=DonorRegistry.Load("samples/donors.json").LoadDonor("tlp-pro-1025m");
var container=ExtronContainer.ReadFile(args[1]);
var model=ProjectModel.Read(container.Payload);
var checks=ScreenVerifier.Verify(package.Plan,model,donor.Model,donor.Entry.Profile,afterGuiBuild:true);
if(checks.Any(c=>!c.Passed))throw new Exception(JsonSerializer.Serialize(checks.Where(c=>!c.Passed)));
if(!container.HasBuildOutput||model.Build.StatusValue!=0)throw new Exception("Build output missing/failed");
using var stream=new MemoryStream(container.Payload);
NrbfDecoder.Decode(stream,out var records);
var editableText=package.Plan.Elements.Where(e=>e.Kind is "button" or "label" or "value").Select(e=>
{
    string type=e.Kind=="button"?"PBButton":"PBLabel";
    var record=records.Values.OfType<ClassRecord>().Single(c=>c.TypeName.FullName=="Extron.GUICPro."+type&&c.MemberNames.Any(n=>n.EndsWith("nameField")&&Convert.ToString(c.GetRawValue(n))==e.Name));
    bool flattened=(bool)record.GetRawValue(record.MemberNames.Single(n=>n.EndsWith("flattenTextField")))!;
    if(flattened)throw new Exception(e.Name+" text flattened");
    return new {e.Name,flattened};
}).ToArray();
Console.WriteLine(JsonSerializer.Serialize(new{checks,model.Build,entries=container.Entries.Select(e=>e.Name),editableText,controls=model.Pages[0].Controls},new JsonSerializerOptions{WriteIndented=true}));
