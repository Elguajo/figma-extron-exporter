using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ExtronExporter.Adapter;

public sealed record CompatibilityProfile(string Id, string Adapter, string GuiDesignerVersion,
    IReadOnlyList<string> DonorVersions, string Status)
{
    public void RequireDonorVersion(string version)
    {
        if (!DonorVersions.Contains(version, StringComparer.Ordinal))
            throw new AdapterException("donor-version", $"Profile '{Id}' does not accept donors from GUI Designer {version}.");
    }
}

public sealed record CompatibilityFile(int SchemaVersion, IReadOnlyList<CompatibilityProfile> Profiles);

/// <summary>Exact, local version routing. A new build is never inferred compatible from its version number.</summary>
public static class Compatibility
{
    public const string AdapterId = "gui-designer-nrbf-x86/1";
    public static string DefaultPath => Path.Combine(AppContext.BaseDirectory, "compatibility", "extron.json");
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public static bool IsVersion(string? value) => value != null && Version.TryParse(value, out var v) &&
        v.Build >= 0 && v.Revision >= 0 && v.ToString(4) == value;

    public static CompatibilityFile Load(string? path = null)
    {
        path ??= DefaultPath;
        if (!File.Exists(path)) throw new AdapterException("compatibility-missing", $"Compatibility file not found: {path}.");
        CompatibilityFile data;
        try { data = JsonSerializer.Deserialize<CompatibilityFile>(File.ReadAllText(path), Json) ?? throw new JsonException("empty"); }
        catch (JsonException e) { throw new AdapterException("compatibility-invalid", $"Invalid compatibility file: {e.Message}"); }
        if (data.SchemaVersion != 1 || data.Profiles == null || data.Profiles.Count == 0 ||
            data.Profiles.Any(p => p == null || string.IsNullOrWhiteSpace(p.Id) || p.Adapter != AdapterId ||
                !IsVersion(p.GuiDesignerVersion) || p.Status is not ("baseline" or "experimental") ||
                p.DonorVersions == null || p.DonorVersions.Count == 0 || p.DonorVersions.Any(v => !IsVersion(v)) ||
                p.DonorVersions.Distinct().Count() != p.DonorVersions.Count) ||
            data.Profiles.Select(p => p.Id).Distinct().Count() != data.Profiles.Count ||
            data.Profiles.Select(p => p.GuiDesignerVersion).Distinct().Count() != data.Profiles.Count)
            throw new AdapterException("compatibility-invalid", "Unknown schema/adapter, invalid versions/status, or ambiguous compatibility profiles.");
        return data;
    }

    public static CompatibilityProfile Select(CompatibilityFile data, string? installedVersion) =>
        data.Profiles.SingleOrDefault(p => p.GuiDesignerVersion == installedVersion) ??
        throw new AdapterException("extron-version", $"GUI Designer {installedVersion ?? "(unknown version)"} has no compatibility profile. Run doctor; qualify an exact-version profile with --compatibility <file>.");

    public static InstalledSoftware InspectSoftware(string directory, string executable)
    {
        string path = Path.GetFullPath(Path.Combine(directory, executable));
        bool exists = File.Exists(path);
        return new(path, exists, exists ? FileVersionInfo.GetVersionInfo(path).FileVersion : null);
    }

    public static void ValidateProbe(System.Text.Json.Nodes.JsonObject result)
    {
        foreach (var (group, expected) in new[]
        {
            ("LevelDisplayTypeEnum", ExtronExporter.Screen.ScreenVerifier.LevelDisplay),
            ("LevelOrientationEnum", ExtronExporter.Screen.ScreenVerifier.LevelOrientation)
        })
            foreach (var (name, value) in expected)
                if (result["contract"]?["enums"]?[group]?[name]?.GetValue<int>() != value)
                    throw new AdapterException("adapter-contract", $"Extron enum {group}.{name} differs from the implemented adapter contract ({value}). A code adapter update is required.");
    }
}

public sealed record InstalledSoftware(string Path, bool Exists, string? Version);
public sealed record DiagnosticCheck(string Id, bool Passed, string Detail);
public sealed record CompatibilityReport(bool Ready, InstalledSoftware GuiDesigner, InstalledSoftware Gcp,
    CompatibilityProfile? Profile, string CompatibilityFile, IReadOnlyList<DiagnosticCheck> Checks,
    System.Text.Json.Nodes.JsonObject? Probe, bool GuiDesignerVerified = false, bool GcpVerified = false);

public static class CompatibilityDoctor
{
    public static CompatibilityReport Inspect(ExtronAdapter adapter, string? gcpDir = null)
    {
        var gui = Compatibility.InspectSoftware(adapter.Options.InstallDir, "GUI Designer.exe");
        var gcp = Compatibility.InspectSoftware(gcpDir ?? Environment.GetEnvironmentVariable("EXTRON_GCP_DIR") ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Extron", "GCP"), "GCP.exe");
        var checks = new List<DiagnosticCheck>();
        CompatibilityProfile? profile = null;
        System.Text.Json.Nodes.JsonObject? probe = null;
        try
        {
            profile = adapter.CheckEnvironment();
            checks.Add(new("environment", true, $"Profile {profile.Id} ({profile.Status})."));
            probe = adapter.Probe();
            checks.Add(new("adapter-contract", true, "Core types, serialized fields, factory and enums available; no donor deserialized."));
        }
        catch (AdapterException e) { checks.Add(new(e.Code, false, e.Message)); }
        // GCP is an import consumer, not a conversion dependency. Presence never proves import compatibility.
        checks.Add(new("gcp", true, gcp.Exists ? $"Installed {gcp.Version}; import/binding preservation requires a separate manual test." : "Not found; optional for EXUI to GDL conversion."));
        return new(checks.All(c => c.Passed), gui, gcp, profile,
            Path.GetFullPath(adapter.Options.CompatibilityPath ?? Compatibility.DefaultPath), checks, probe);
    }
}
