using System.Security.Cryptography;
using System.Text.Json;
using ExtronExporter.Adapter;
using ExtronExporter.Format;
using ExtronExporter.Screen;

var json = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
const string Usage = """
Usage:
  inspect <input.gdl|glt>
  list-controls <input.gdl>
  repack <input> <new-output>
  set-button-text <input> <new-output> <button-id> <expected-text> <new-text>
  prepare-donor <donor-id> [--registry samples/donors.json] [--extron-dir <dir>]
  generate-screen <screen.json> <donor-id> <new-output.gdl> [--registry samples/donors.json] [--extron-dir <dir>]
  validate-package <input.exui>
  convert-package <input.exui> <new-output.gdl> [--registry samples/donors.json] [--extron-dir <dir>]
""";

// Options are only accepted by the adapter commands; everything else is positional.
var positional = new List<string>();
string registryPath = Path.Combine("samples", "donors.json");
string? extronDir = null;
for (int i = 0; i < args.Length; i++)
{
    if (args[i] is "--registry" or "--extron-dir")
    {
        if (i + 1 >= args.Length) { Console.Error.Write(Usage); return 2; }
        if (args[i] == "--registry") registryPath = args[++i]; else extronDir = args[++i];
    }
    else positional.Add(args[i]);
}
string command = positional.Count > 0 ? positional[0] : "";
bool adapterCommand = command is "prepare-donor" or "generate-screen" or "convert-package";
int expected = command switch
{
    "inspect" or "list-controls" or "prepare-donor" or "validate-package" => 2, "repack" or "convert-package" => 3, "generate-screen" => 4, "set-button-text" => 6, _ => -1
};
if (expected < 0 || positional.Count != expected || (!adapterCommand && args.Length != positional.Count) ||
    (command == "set-button-text" && !int.TryParse(positional[3], out _)))
{
    Console.Error.Write(Usage);
    return 2;
}

try
{
    switch (command)
    {
        case "validate-package":
        {
            using var package = ExuiPackage.Load(positional[1]);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                contract = "exui/1", package.Sha256, package.Profile,
                elements = package.Plan.Elements.Count, resources = package.Plan.Images.Count,
                validation = "ZIP + schemas + semantic checks; no Extron required; GUI/device unverified"
            }, json));
            break;
        }
        case "convert-package":
        {
            var report = PackageGenerator.Generate(DonorRegistry.Load(registryPath), positional[1], positional[2], new ExtronAdapter(AdapterOptions.Default(extronDir)));
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                report.Contract, report.Profile, report.PackageSha256, report.Generation.Output, report.Generation.OutputSha256,
                checks = $"{report.Generation.Checks.Count(c => c.Passed)}/{report.Generation.Checks.Count} passed",
                reportFile = Path.GetFullPath(positional[2] + ".report.json"), report.GuiDesignerVerified, report.HardwareVerified,
                next = "Open a copy in GUI Designer; Verify, Save and Build and reopen manually"
            }, json));
            break;
        }
        case "inspect":
        {
            var container = ExtronContainer.ReadFile(positional[1]);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                input = Path.GetFullPath(positional[1]),
                container = container.HasBuildOutput ? "KP-multi-entry-v1" : "KP-single-entry-v1",
                entries = container.Entries,
                entry = container.EntryName,
                compression = container.CompressionMethod,
                payloadBytes = container.Payload.Length,
                payloadSha256 = Convert.ToHexString(SHA256.HashData(container.Payload)),
                project = ProjectInspection.Inspect(container.Payload),
                validation = "container + NRBF decode; GUI Designer not verified"
            }, json));
            break;
        }
        case "list-controls":
        {
            var container = ExtronContainer.ReadFile(positional[1]);
            var model = ProjectModel.Read(container.Payload);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                input = Path.GetFullPath(positional[1]), entries = container.Entries.Select(e => e.Name), model,
                validation = "NRBF decode only; GUI Designer not verified"
            }, json));
            break;
        }
        case "repack":
        {
            var container = ExtronContainer.ReadFile(positional[1]);
            byte[] output = container.Repack();
            var check = ExtronContainer.Parse(output);
            if (!check.Payload.AsSpan().SequenceEqual(container.Payload)) throw new InvalidDataException("Repack changed payload.");
            using (var file = new FileStream(positional[2], FileMode.CreateNew, FileAccess.Write)) file.Write(output);
            Console.WriteLine(JsonSerializer.Serialize(new { output = Path.GetFullPath(positional[2]), bytes = output.Length, payloadUnchanged = true, guiDesignerVerified = false }));
            break;
        }
        case "set-button-text":
        {
            var container = ExtronContainer.ReadFile(positional[1]);
            var edit = ButtonTextEditor.Edit(container.Payload, int.Parse(positional[3]), positional[4], positional[5]);
            byte[] output = container.RepackWithPayload(edit.Payload);
            var check = ExtronContainer.Parse(output);
            if (!check.Payload.AsSpan().SequenceEqual(edit.Payload)) throw new InvalidDataException("Packaging changed edited payload.");
            using (var file = new FileStream(positional[2], FileMode.CreateNew, FileAccess.Write)) file.Write(output);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                output = Path.GetFullPath(positional[2]), bytes = output.Length, edit.ButtonId, edit.ButtonName,
                edit.StateCount, edit.OldText, edit.NewText, edit.Patches,
                payloadSha256 = Convert.ToHexString(SHA256.HashData(edit.Payload)),
                preserved = "All bytes outside selected NRBF string values; record IDs; all other decoded class members",
                guiDesignerVerified = false
            }, json));
            break;
        }
        case "prepare-donor":
        {
            var registry = DonorRegistry.Load(registryPath);
            var report = ScreenGenerator.PrepareDonor(registry, positional[1], new ExtronAdapter(AdapterOptions.Default(extronDir)));
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                report.Output, report.Sha256, report.Bytes, report.Profile, report.Pages, report.Popups, report.MatchesRegistry,
                adapter = report.AdapterResult,
                note = report.MatchesRegistry ? "SHA-256 matches samples/donors.json" : "Record this sha256 in samples/donors.json to allow-list the donor",
                guiDesignerVerified = false
            }, json));
            break;
        }
        case "generate-screen":
        {
            var registry = DonorRegistry.Load(registryPath);
            var report = ScreenGenerator.Generate(registry, positional[2], positional[1], positional[3], new ExtronAdapter(AdapterOptions.Default(extronDir)));
            string text = JsonSerializer.Serialize(report, json);
            // Report next to the output; never overwrite one.
            using (var file = new FileStream(positional[3] + ".report.json", FileMode.CreateNew, FileAccess.Write))
                file.Write(System.Text.Encoding.UTF8.GetBytes(text));
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                report.Output, report.OutputSha256, report.OutputBytes, report.Panel, report.DonorId,
                checks = $"{report.Checks.Count(c => c.Passed)}/{report.Checks.Count} passed",
                reportFile = Path.GetFullPath(positional[3] + ".report.json"),
                next = "Open in GUI Designer, edit, Verify, Save and Build, reopen (manual)",
                report.GuiDesignerVerified
            }, json));
            break;
        }
    }
    return 0;
}
catch (AdapterException e)
{
    Console.Error.WriteLine($"ERROR [{e.Code}]: {e.Message}");
    return 1;
}
catch (ExuiException e)
{
    Console.Error.WriteLine($"ERROR [{e.Code}]: {e.Message}");
    return 1;
}
catch (ScreenSpecException e)
{
    Console.Error.WriteLine($"ERROR [spec]: {e.Message}");
    return 1;
}
catch (Exception e) when (e is IOException or InvalidDataException or UnauthorizedAccessException or ArgumentException or NotSupportedException or System.Runtime.Serialization.SerializationException)
{
    Console.Error.WriteLine($"ERROR: {e.Message}");
    return 1;
}
