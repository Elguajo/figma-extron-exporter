using System.Security.Cryptography;
using System.Text.Json.Nodes;
using ExtronExporter.Format;
using ExtronExporter.Screen;

namespace ExtronExporter.Adapter;

public sealed record GenerationReport(
    string Output, string OutputSha256, int OutputBytes, string DonorId, string DonorSha256, string Panel,
    string SpecSha256, IReadOnlyList<CheckResult> Checks, JsonObject AdapterResult, string HostOutput, bool GuiDesignerVerified = false);

public sealed record PreparationReport(string Output, string Sha256, int Bytes, PlatformProfile Profile,
    IReadOnlyList<string> Pages, IReadOnlyList<string> Popups, JsonObject AdapterResult, bool MatchesRegistry);

public static class ScreenGenerator
{
    /// <summary>Create the donor file of a registry entry from its local reference. Never overwrites.</summary>
    public static PreparationReport PrepareDonor(DonorRegistry registry, string id, ExtronAdapter adapter)
    {
        var entry = registry.Find(id);
        string output = registry.Resolve(entry.File);
        if (File.Exists(output)) throw new AdapterException("output-exists", $"{output} already exists; prepared donors are not overwritten.");
        var (_, sourceBytes) = registry.LoadSource(entry);
        var source = ExtronContainer.Parse(sourceBytes);
        var p = entry.Preparation;
        var run = adapter.Run("prepare-donor", source.Payload, "prepare", new
        {
            keepPages = p.KeepPages, keepPopupIds = p.KeepPopupIds, retarget = p.Retarget, projectName = p.ProjectName
        });
        var model = ProjectModel.Read(run.Output);
        CheckHostEnums(run.Result, entry.Profile);
        var bad = ScreenVerifier.ProfileChecks(model, entry.Profile).Where(c => !c.Passed).ToList();
        if (!model.Pages.Select(x => x.Name).SequenceEqual(p.KeepPages)) bad.Add(new("donor.pages", false, string.Join(", ", model.Pages.Select(x => x.Name))));
        bad.AddRange(BoundsChecks(model).Where(c => !c.Passed));
        if (bad.Count > 0) throw new AdapterException("profile-mismatch", "Prepared donor does not have the expected profile: " + string.Join("; ", bad.Select(c => $"{c.Id}: {c.Detail}")));
        byte[] packed = source.RepackWithPayload(run.Output);
        if (!ExtronContainer.Parse(packed).Payload.AsSpan().SequenceEqual(run.Output)) throw new InvalidDataException("Packaging changed the donor payload.");
        string sha = Convert.ToHexString(SHA256.HashData(packed));
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        using (var file = new FileStream(output, FileMode.CreateNew, FileAccess.Write)) file.Write(packed);
        return new(output, sha, packed.Length, model.Platform, model.Pages.Select(x => x.Name).ToArray(), model.Popups.Select(x => x.Name).ToArray(),
            run.Result, entry.Sha256 != null && entry.Sha256.Equals(sha, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Generate a NEW .gdl from a screen description on an allow-listed donor. Writes nothing on failure.</summary>
    public static GenerationReport Generate(DonorRegistry registry, string donorId, string specPath, string outputPath, ExtronAdapter adapter)
    {
        if (File.Exists(outputPath)) throw new AdapterException("output-exists", $"{outputPath} already exists; choose a new output file.");
        string? dir = Path.GetDirectoryName(Path.GetFullPath(outputPath));
        if (dir == null || !Directory.Exists(dir)) throw new AdapterException("output-dir", $"Output folder {dir} does not exist.");
        var donor = registry.LoadDonor(donorId);
        byte[] specBytes = File.ReadAllBytes(specPath);
        var spec = ScreenSpecReader.Load(specPath);
        var plan = ScreenSpecReader.Normalize(spec, donor.Entry.Panel, donor.Entry.Profile.Width, donor.Entry.Profile.Height,
            Path.GetDirectoryName(Path.GetFullPath(specPath))!);
        return Generate(donor, donorId, plan, Convert.ToHexString(SHA256.HashData(specBytes)), outputPath, adapter);
    }

    // Both inputs converge here; package data never becomes an Extron deserialization input.
    internal static GenerationReport Generate(LoadedDonor donor, string donorId, GeneratePlan plan, string specSha256, string outputPath, ExtronAdapter adapter)
    {
        var e = donor.Entry;
        var run = adapter.Run("generate", donor.Container.Payload, "generate", new
        {
            projectName = plan.ProjectName,
            page = plan.Page,
            images = plan.Images,
            elements = plan.Elements,
            expectedProfile = new { platformType = e.Profile.PlatformType, partNumber = e.Profile.PartNumber, width = e.Profile.Width, height = e.Profile.Height },
            donorElements = new { page = e.Elements.Page, button = e.Elements.Button, label = e.Elements.Label, level = e.Elements.Level }
        });
        CheckHostEnums(run.Result, e.Profile);
        var model = ProjectModel.Read(run.Output);
        var checks = ScreenVerifier.Verify(plan, model, donor.Model, e.Profile).ToList();
        checks.AddRange(BoundsChecks(model));
        byte[] packed = donor.Container.RepackWithPayload(run.Output);
        checks.Add(new("container.payload-roundtrip", ExtronContainer.Parse(packed).Payload.AsSpan().SequenceEqual(run.Output), "packed payload decodes back unchanged"));
        string donorAfter = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(donor.Path)));
        checks.Add(new("donor.unchanged", donorAfter == donor.Sha256, donorAfter));
        var failed = checks.Where(c => !c.Passed).ToArray();
        if (failed.Length > 0)
            throw new AdapterException("verification-failed", "Generated project failed independent verification; nothing written: " +
                string.Join("; ", failed.Select(c => $"{c.Id}: {c.Detail}")));
        using (var file = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write)) file.Write(packed);
        return new(Path.GetFullPath(outputPath), Convert.ToHexString(SHA256.HashData(packed)), packed.Length, donorId, donor.Sha256,
            e.Panel, specSha256, checks, run.Result, run.HostOutput);
    }

    /// <summary>Build silently moves a control outside its page to 0,0, so every container must fit the canvas.</summary>
    public static IEnumerable<CheckResult> BoundsChecks(ProjectModel model) =>
        model.Pages.Concat(model.Popups).Select(p =>
        {
            var outside = p.Controls.Where(c => c.Left < 0 || c.Top < 0 || c.Width < 1 || c.Height < 1 || c.Left + c.Width > p.Width || c.Top + c.Height > p.Height).ToArray();
            bool fits = p.Width <= model.Platform.ScreenWidth && p.Height <= model.Platform.ScreenHeight;
            return new CheckResult($"bounds.{p.Name}", outside.Length == 0 && fits,
                outside.Length == 0 ? $"{p.Controls.Count} control(s) inside {p.Width}x{p.Height}" : "outside: " + string.Join(", ", outside.Select(c => $"{c.Name} {c.Left},{c.Top},{c.Width},{c.Height}")));
        });

    /// <summary>The NRBF reader sees enum numbers only; the host reports names → numbers from Extron's own types.</summary>
    private static void CheckHostEnums(JsonObject result, ExpectedProfile profile)
    {
        var enums = result["enumValues"]?.AsObject() ?? throw new AdapterException("host-failed", "Adapter result has no enumValues.");
        if (enums["platformType"]?.GetValue<int>() != profile.PlatformTypeValue)
            throw new AdapterException("profile-mismatch", $"PlatformProTypeEnum.{profile.PlatformType} is {enums["platformType"]} in this install; registry expects {profile.PlatformTypeValue}.");
        foreach (var (group, expected) in new[] { ("levelDisplay", ScreenVerifier.LevelDisplay), ("levelOrientation", ScreenVerifier.LevelOrientation) })
            foreach (var (name, value) in expected)
                if (enums[group]?[name]?.GetValue<int>() != value)
                    throw new AdapterException("extron-version", $"Extron enum {group}.{name} is {enums[group]?[name]}, expected {value}.");
    }
}
