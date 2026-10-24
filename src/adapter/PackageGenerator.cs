using System.Text.Json;
using ExtronExporter.Screen;

namespace ExtronExporter.Adapter;

public sealed record PackageGenerationReport(string PackageSha256, string Contract, string Profile,
    GenerationReport Generation, bool GuiDesignerVerified = false, bool HardwareVerified = false);

public static class PackageGenerator
{
    public static PackageGenerationReport Generate(DonorRegistry registry, string packagePath, string outputPath, ExtronAdapter adapter)
    {
        string reportPath = outputPath + ".report.json";
        if (File.Exists(outputPath) || File.Exists(reportPath))
            throw new AdapterException("output-exists", "Output or report already exists; choose a new name.");
        string dir = Path.GetDirectoryName(Path.GetFullPath(outputPath))!;
        if (!Directory.Exists(dir)) throw new AdapterException("output-dir", $"Output folder {dir} does not exist.");
        using var package = ExuiPackage.Load(packagePath);
        // Profile IDs map to local donor IDs. A package cannot supply a registry or donor path.
        string donorId = package.Profile.Id;
        var donor = registry.LoadDonor(donorId);
        if (donor.Entry.Panel != package.Profile.Panel || donor.Entry.Profile.Width != package.Profile.Width || donor.Entry.Profile.Height != package.Profile.Height)
            throw new AdapterException("profile-mismatch", "Local donor does not match the package profile.");

        // Stage in the output filesystem. Validation/host failures leave no final artifacts; a failed
        // two-file publication removes only files created by this invocation, never pre-existing ones.
        string stage = Path.Combine(dir, ".exui-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(stage);
        bool outputCreated = false, reportCreated = false;
        try
        {
            var generated = ScreenGenerator.Generate(donor, donorId, package.Plan, package.ScreenSha256, Path.Combine(stage, "result.gdl"), adapter);
            var report = new PackageGenerationReport(package.Sha256, package.Contract, package.Profile.Id,
                generated with { Output = Path.GetFullPath(outputPath) });
            string reportStage = Path.Combine(stage, "report.json");
            File.WriteAllText(reportStage, JsonSerializer.Serialize(report, new JsonSerializerOptions
            { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));
            File.Move(generated.Output, outputPath); outputCreated = true;
            File.Move(reportStage, reportPath); reportCreated = true;
            return report;
        }
        catch
        {
            if (outputCreated) File.Delete(outputPath);
            if (reportCreated) File.Delete(reportPath);
            throw;
        }
        // Cleanup is best effort: a scanner briefly holding a staged file must not turn a
        // published result into an error, after which the same output name would be refused.
        finally { try { Directory.Delete(stage, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
    }
}
