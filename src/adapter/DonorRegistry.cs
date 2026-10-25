using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using ExtronExporter.Format;
using ExtronExporter.Screen;

namespace ExtronExporter.Adapter;

/// <summary>A donor object: a page by name, a control by page + type + control ID or name, or a popup by name.</summary>
public sealed record DonorElementRef(string? Page = null, string? Type = null, int? ControlId = null, string? Name = null);

/// <summary>PopupReference, StandardPopup and ModalPopup are needed only to author popups.</summary>
public sealed record DonorElements(DonorElementRef Page, DonorElementRef Button, DonorElementRef Label, DonorElementRef Level,
    DonorElementRef? PopupReference = null, DonorElementRef? StandardPopup = null, DonorElementRef? ModalPopup = null, DonorElementRef? Graphic = null,
    DonorElementRef? Shape = null, DonorElementRef? Line = null, DonorElementRef? Datetime = null);

public sealed record DonorPreparation(string Source, string SourceSha256, IReadOnlyList<string> KeepPages,
    IReadOnlyList<long> KeepPopupIds, string? Retarget, string ProjectName);

public sealed record DonorEntry(string Id, string Panel, string File, string? Sha256, ExpectedProfile Profile,
    DonorPreparation Preparation, DonorElements Elements, string? Notes = null);

public sealed record DonorRegistryFile(int SchemaVersion, string GuiDesignerVersion, IReadOnlyList<DonorEntry> Donors);

public sealed record LoadedDonor(DonorEntry Entry, string Path, string Sha256, ExtronContainer Container, ProjectModel Model, string GuiDesignerVersion);

/// <summary>
/// Shared folder with the private donor and reference GDL files (same relative layout as the registry:
/// donors/*.gdl, original/*.gdl). One copy serves every unpacked CLI version and every panel.
/// </summary>
public static class DonorLibrary
{
    public const string EnvironmentVariable = "EXUI_DONOR_DIR";

    public static string DefaultDir => System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Figma Extron Exporter");

    /// <summary>--donor-dir, then EXUI_DONOR_DIR, then Documents\Figma Extron Exporter.</summary>
    public static string Locate(string? explicitDir) =>
        explicitDir ?? (Environment.GetEnvironmentVariable(EnvironmentVariable) is { Length: > 0 } dir ? dir : DefaultDir);
}

/// <summary>
/// samples/donors.json: the ONLY projects whose payload is handed to the Extron deserializer. Each entry is
/// pinned by SHA-256 and derived from a local reference listed in samples/manifest.json. Donor files are
/// looked up in the donor library first, then next to the registry.
/// </summary>
public sealed class DonorRegistry
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = true
    };

    public string RegistryPath { get; }
    public string BaseDir { get; }
    public string? LibraryDir { get; }
    public DonorRegistryFile Data { get; }

    private DonorRegistry(string path, DonorRegistryFile data, string? libraryDir)
    {
        RegistryPath = System.IO.Path.GetFullPath(path); BaseDir = System.IO.Path.GetDirectoryName(RegistryPath)!; Data = data;
        LibraryDir = libraryDir == null ? null : System.IO.Path.GetFullPath(libraryDir);
    }

    public static DonorRegistry Load(string path, string? libraryDir = null)
    {
        if (!System.IO.File.Exists(path)) throw new AdapterException("registry-missing", $"Donor registry {path} not found.");
        DonorRegistryFile data;
        try { data = JsonSerializer.Deserialize<DonorRegistryFile>(System.IO.File.ReadAllText(path), Json) ?? throw new JsonException("empty"); }
        catch (JsonException e) { throw new AdapterException("registry-invalid", $"Donor registry is invalid: {e.Message}"); }
        if (data.SchemaVersion != 1 || !Compatibility.IsVersion(data.GuiDesignerVersion))
            throw new AdapterException("registry-invalid", "Donor registry has an unknown schema or GUI Designer version.");
        if (data.Donors.Select(d => d.Id).Distinct().Count() != data.Donors.Count) throw new AdapterException("registry-invalid", "Duplicate donor ids.");
        if (data.Donors.Any(d => d.Profile.Panel != d.Panel)) throw new AdapterException("registry-invalid", "Donor panel and profile panel disagree.");
        return new(path, data, libraryDir);
    }

    public DonorEntry Find(string id) => Data.Donors.SingleOrDefault(d => d.Id == id)
        ?? throw new AdapterException("donor-unknown", $"Donor '{id}' is not in {RegistryPath}. Known: {string.Join(", ", Data.Donors.Select(d => d.Id))}.");

    public string Resolve(string relative)
    {
        if (System.IO.Path.IsPathRooted(relative) || relative.Split('/', '\\').Contains(".."))
            throw new AdapterException("registry-invalid", $"Registry path '{relative}' must be relative to the registry, without '..'.");
        string local = System.IO.Path.GetFullPath(System.IO.Path.Combine(BaseDir, relative));
        if (LibraryDir == null) return local;
        // The library wins; a file next to the registry is still used when the library lacks it. New files go to the library.
        string shared = System.IO.Path.GetFullPath(System.IO.Path.Combine(LibraryDir, relative));
        return System.IO.File.Exists(shared) || !System.IO.File.Exists(local) ? shared : local;
    }

    /// <summary>Open a donor only if its hash and its real profile match the registry.</summary>
    public LoadedDonor LoadDonor(string id)
    {
        var entry = Find(id);
        string path = Resolve(entry.File);
        if (!System.IO.File.Exists(path))
            throw new AdapterException("donor-missing", $"Donor file {path} does not exist; copy it into the donor library ({LibraryDir ?? BaseDir}, set {DonorLibrary.EnvironmentVariable} or --donor-dir to use another folder) or run prepare-donor {id}.");
        if (entry.Sha256 == null) throw new AdapterException("donor-unpinned", $"Donor '{id}' has no sha256 in the registry; it is not allow-listed yet.");
        byte[] bytes = System.IO.File.ReadAllBytes(path);
        string sha = Convert.ToHexString(SHA256.HashData(bytes));
        if (!sha.Equals(entry.Sha256, StringComparison.OrdinalIgnoreCase))
            throw new AdapterException("donor-hash", $"Donor {path} has SHA-256 {sha}, registry expects {entry.Sha256}; refusing to deserialize it.");
        var container = ExtronContainer.Parse(bytes);
        if (container.HasBuildOutput) throw new AdapterException("donor-unsuitable", "Donor must be an unbuilt single-entry project.");
        var model = ProjectModel.Read(container.Payload);
        if (model.AppVersion != Data.GuiDesignerVersion)
            throw new AdapterException("donor-version", $"Donor version {model.AppVersion} differs from registry {Data.GuiDesignerVersion}.");
        var bad = ScreenVerifier.ProfileChecks(model, entry.Profile, Data.GuiDesignerVersion).Where(c => !c.Passed).ToArray();
        if (bad.Length > 0) throw new AdapterException("profile-mismatch", $"Donor '{id}' profile differs from the registry: {string.Join("; ", bad.Select(c => $"{c.Id}: {c.Detail}"))}.");
        return new(entry, path, sha, container, model, Data.GuiDesignerVersion);
    }

    /// <summary>The preparation source must be an immutable local reference listed in manifest.json.</summary>
    public (string Path, byte[] Bytes) LoadSource(DonorEntry entry)
    {
        string path = Resolve(entry.Preparation.Source);
        if (!System.IO.File.Exists(path)) throw new AdapterException("source-missing", $"Local reference {path} not found.");
        byte[] bytes = System.IO.File.ReadAllBytes(path);
        string sha = Convert.ToHexString(SHA256.HashData(bytes));
        if (!sha.Equals(entry.Preparation.SourceSha256, StringComparison.OrdinalIgnoreCase))
            throw new AdapterException("source-hash", $"Local reference {path} has SHA-256 {sha}, registry expects {entry.Preparation.SourceSha256}.");
        string manifest = System.IO.Path.Combine(BaseDir, "manifest.json");
        using var doc = JsonDocument.Parse(System.IO.File.ReadAllText(manifest));
        bool listed = doc.RootElement.GetProperty("samples").EnumerateArray().Any(s =>
            s.GetProperty("sha256").GetString()!.Equals(sha, StringComparison.OrdinalIgnoreCase) &&
            s.TryGetProperty("immutableByPolicy", out var im) && im.GetBoolean());
        if (!listed) throw new AdapterException("source-unlisted", $"{path} is not an immutable reference in {manifest}.");
        return (path, bytes);
    }
}
